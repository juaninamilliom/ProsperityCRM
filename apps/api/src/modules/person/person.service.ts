import type { Person } from '../../types.js';
import { query } from '../../utils/sql.js';
import { ensureOrganizationSkills, normalizeSkillNames } from '../skill/skill.service.js';
import type { CreatePersonInput, UpdatePersonInput } from './person.schema.js';

export async function listPeople(filters: { search?: string; company_id?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.company_id) {
    params.push(filters.company_id);
    conditions.push(`p.current_company_id = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(
      `(lower(p.full_name) like $${idx} or lower(coalesce(p.email,'')) like $${idx} or lower(coalesce(p.linkedin_url,'')) like $${idx})`,
    );
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const result = await query(
    `select p.*, c.name as company_name,
        (select count(*) from pipeline_entries e where e.person_id = p.person_id)::int as entry_count,
        (select count(*) from opportunity_contacts oc where oc.person_id = p.person_id)::int as deal_count,
        (select max(a.occurred_at) from activities a where a.person_id = p.person_id) as last_touch
      from people p
      left join companies c on c.company_id = p.current_company_id
      ${where} order by p.full_name asc`,
    params,
  );
  return result.rows;
}

/** The flywheel page: every pitch this person has been in, every deal they are
 *  a contact on, and one timeline spanning both funnels. */
export async function getPerson(personId: string) {
  const [person, entries, deals, activity] = await Promise.all([
    query<Person>(
      `select p.*, c.name as company_name from people p
        left join companies c on c.company_id = p.current_company_id
        where p.person_id = $1`,
      [personId],
    ),
    query(
      `select e.*, s.name as status_name, s.is_terminal, co.name as company_name, j.title as job_title
         from pipeline_entries e
         join status_config s on s.status_id = e.current_status_id
         join companies co on co.company_id = e.company_id
         left join job_requisitions j on j.job_id = e.job_id
        where e.person_id = $1 order by e.created_at desc`,
      [personId],
    ),
    query(
      `select o.*, oc.role, c.name as company_name
         from opportunity_contacts oc
         join bd_opportunities o on o.opportunity_id = oc.opportunity_id
         join companies c on c.company_id = o.company_id
        where oc.person_id = $1 order by o.expected_close asc nulls last`,
      [personId],
    ),
    query(
      `select a.*, c.name as company_name, o.name as opportunity_name
         from activities a
         left join companies c on c.company_id = a.company_id
         left join bd_opportunities o on o.opportunity_id = a.opportunity_id
        where a.person_id = $1 order by a.occurred_at desc limit 100`,
      [personId],
    ),
  ]);

  if (!person.rows[0]) return null;
  return {
    ...person.rows[0],
    entries: entries.rows,
    deals: deals.rows,
    activity: activity.rows,
  };
}

export async function createPerson(organizationId: string, input: CreatePersonInput) {
  const skills = normalizeSkillNames(input.skills ?? []);
  await ensureOrganizationSkills(organizationId, skills);

  const result = await query<Person>(
    `insert into people (organization_id, full_name, email, phone, linkedin_url, headline,
        location, current_company_id, current_title, skills, notes, source)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12) returning *`,
    [
      organizationId, input.full_name, input.email, input.phone, input.linkedin_url,
      input.headline, input.location, input.current_company_id, input.current_title,
      JSON.stringify(skills), input.notes, input.source,
    ],
  );
  return result.rows[0];
}

export async function updatePerson(personId: string, organizationId: string, input: UpdatePersonInput) {
  const fields: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (key === 'skills') {
      const skills = normalizeSkillNames((value as string[] | undefined) ?? []);
      await ensureOrganizationSkills(organizationId, skills);
      params.push(JSON.stringify(skills));
    } else {
      params.push(value);
    }
    fields.push(`${key} = $${params.length}`);
  }

  if (!fields.length) {
    const current = await query<Person>('select * from people where person_id = $1', [personId]);
    return current.rows[0] ?? null;
  }

  params.push(personId);
  const result = await query<Person>(
    `update people set ${fields.join(', ')}, updated_at = now()
      where person_id = $${params.length} returning *`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function findDuplicatePerson(
  organizationId: string,
  linkedinUrl: string | null | undefined,
  email: string | null | undefined,
) {
  if (!linkedinUrl && !email) return null;
  const result = await query<Person>(
    `select * from people
      where organization_id = $1
        and ((linkedin_url is not null and linkedin_url = $2)
          or (email is not null and lower(email) = lower(coalesce($3, ''))))
      limit 1`,
    [organizationId, linkedinUrl ?? null, email ?? null],
  );
  return result.rows[0] ?? null;
}
