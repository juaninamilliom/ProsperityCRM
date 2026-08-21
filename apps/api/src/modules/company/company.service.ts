import type { Company } from '../../types.js';
import { query } from '../../utils/sql.js';
import type { CreateCompanyInput, UpdateCompanyInput } from './company.schema.js';

export async function listCompanies(filters: { relationship?: string; search?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.relationship) {
    params.push(filters.relationship);
    conditions.push(`c.relationship = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(`(lower(c.name) like $${idx} or lower(coalesce(c.domain,'')) like $${idx})`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  // The list shows four derived numbers per row; doing them as subqueries keeps
  // the table from firing a request per company.
  const result = await query(
    `select c.*,
        (select count(*) from people p where p.current_company_id = c.company_id)::int as contact_count,
        (select count(*) from bd_opportunities o
           where o.company_id = c.company_id and o.stage not in ('signed','lost'))::int as open_deals,
        (select count(*) from job_requisitions j
           where j.company_id = c.company_id and j.status = 'open')::int as open_reqs,
        (select max(a.occurred_at) from activities a where a.company_id = c.company_id) as last_touch
      from companies c ${where} order by c.name asc`,
    params,
  );
  return result.rows;
}

export async function getCompany(companyId: string) {
  const [company, contacts, deals, reqs, activity] = await Promise.all([
    query<Company>('select * from companies where company_id = $1', [companyId]),
    query(
      `select p.*,
          (select oc.role from opportunity_contacts oc
             join bd_opportunities o on o.opportunity_id = oc.opportunity_id
            where oc.person_id = p.person_id and o.company_id = $1
            order by oc.created_at asc limit 1) as role,
          (select max(a.occurred_at) from activities a where a.person_id = p.person_id) as last_touch
        from people p
       where p.current_company_id = $1
       order by p.full_name asc`,
      [companyId],
    ),
    query(
      `select o.* from bd_opportunities o
        where o.company_id = $1 order by o.expected_close asc nulls last`,
      [companyId],
    ),
    query(
      `select j.*,
          (select count(*) from pipeline_entries e where e.job_id = j.job_id)::int as entry_count
        from job_requisitions j where j.company_id = $1 order by j.created_at desc`,
      [companyId],
    ),
    query(
      `select a.*, p.full_name as person_name, o.name as opportunity_name
         from activities a
         left join people p on p.person_id = a.person_id
         left join bd_opportunities o on o.opportunity_id = a.opportunity_id
        where a.company_id = $1 order by a.occurred_at desc limit 50`,
      [companyId],
    ),
  ]);

  if (!company.rows[0]) return null;
  return {
    ...company.rows[0],
    contacts: contacts.rows,
    deals: deals.rows,
    requisitions: reqs.rows,
    activity: activity.rows,
  };
}

export async function createCompany(organizationId: string, input: CreateCompanyInput) {
  const result = await query<Company>(
    `insert into companies (organization_id, name, linkedin_url, domain, industry,
        headcount, location, relationship, contact_email, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [
      organizationId, input.name, input.linkedin_url, input.domain, input.industry,
      input.headcount, input.location, input.relationship, input.contact_email, input.notes,
    ],
  );
  return result.rows[0];
}

export async function updateCompany(companyId: string, input: UpdateCompanyInput) {
  const fields: string[] = [];
  const params: unknown[] = [];

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    params.push(value);
    fields.push(`${key} = $${params.length}`);
  });

  if (!fields.length) {
    const current = await query<Company>('select * from companies where company_id = $1', [companyId]);
    return current.rows[0] ?? null;
  }

  params.push(companyId);
  const result = await query<Company>(
    `update companies set ${fields.join(', ')}, updated_at = now()
      where company_id = $${params.length} returning *`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function findDuplicateCompany(
  organizationId: string,
  name: string | undefined,
  linkedinUrl: string | null | undefined,
  domain: string | null | undefined,
) {
  const result = await query<Company>(
    `select * from companies
      where organization_id = $1
        and (lower(name) = lower(coalesce($2, ''))
          or (linkedin_url is not null and linkedin_url = $3)
          or (domain is not null and lower(domain) = lower(coalesce($4, ''))))
      limit 1`,
    [organizationId, name ?? null, linkedinUrl ?? null, domain ?? null],
  );
  return result.rows[0] ?? null;
}

export async function countEntriesForCompany(companyId: string) {
  const result = await query<{ count: string }>(
    'select count(*) as count from pipeline_entries where company_id = $1',
    [companyId],
  );
  return Number(result.rows[0].count);
}

export async function deleteCompany(companyId: string) {
  await query('delete from companies where company_id = $1', [companyId]);
}
