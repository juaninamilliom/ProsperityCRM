import type { BdOpportunity } from '../../types.js';
import { query } from '../../utils/sql.js';
import type { CreateOpportunityInput, UpdateOpportunityInput } from './opportunity.schema.js';

/** The board card needs the company, the contacts and the last touch, so they
 *  come back with the deal rather than as a request per card. */
const opportunitySelect = `select o.*, c.name as company_name, c.relationship,
    coalesce((
      select json_agg(json_build_object(
        'person_id', p.person_id, 'full_name', p.full_name, 'role', oc.role)
        order by oc.created_at)
        from opportunity_contacts oc
        join people p on p.person_id = oc.person_id
       where oc.opportunity_id = o.opportunity_id
    ), '[]'::json) as contacts,
    (select max(a.occurred_at) from activities a
      where a.opportunity_id = o.opportunity_id) as last_touch
  from bd_opportunities o
  join companies c on c.company_id = o.company_id`;

export async function listOpportunities(filters: { company_id?: string; stage?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.company_id) {
    params.push(filters.company_id);
    conditions.push(`o.company_id = $${params.length}`);
  }
  if (filters.stage) {
    params.push(filters.stage);
    conditions.push(`o.stage = $${params.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const result = await query(
    `${opportunitySelect} ${where} order by o.expected_close asc nulls last`,
    params,
  );
  return result.rows;
}

export async function getOpportunity(opportunityId: string) {
  const result = await query(`${opportunitySelect} where o.opportunity_id = $1`, [opportunityId]);
  return result.rows[0] ?? null;
}

export async function getOpportunityRaw(opportunityId: string) {
  const result = await query<BdOpportunity>(
    'select * from bd_opportunities where opportunity_id = $1',
    [opportunityId],
  );
  return result.rows[0] ?? null;
}

export async function createOpportunity(organizationId: string, input: CreateOpportunityInput) {
  const result = await query<BdOpportunity>(
    `insert into bd_opportunities (organization_id, company_id, name, stage, fee_percent,
        est_annual_value, expected_close, owner_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [
      organizationId, input.company_id, input.name, input.stage, input.fee_percent,
      input.est_annual_value, input.expected_close, input.owner_id,
    ],
  );
  return result.rows[0];
}

export async function updateOpportunity(opportunityId: string, input: UpdateOpportunityInput) {
  const fields: string[] = [];
  const params: unknown[] = [];

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    params.push(value);
    fields.push(`${key} = $${params.length}`);
  });

  if (!fields.length) return getOpportunityRaw(opportunityId);

  params.push(opportunityId);
  const result = await query<BdOpportunity>(
    `update bd_opportunities set ${fields.join(', ')}, updated_at = now()
      where opportunity_id = $${params.length} returning *`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function addContact(opportunityId: string, personId: string, role?: string) {
  await query(
    `insert into opportunity_contacts (opportunity_id, person_id, role)
     values ($1,$2,$3)
     on conflict (opportunity_id, person_id) do update set role = excluded.role`,
    [opportunityId, personId, role ?? null],
  );
  return getOpportunity(opportunityId);
}

export async function removeContact(opportunityId: string, personId: string) {
  await query(
    'delete from opportunity_contacts where opportunity_id = $1 and person_id = $2',
    [opportunityId, personId],
  );
}

export async function deleteOpportunity(opportunityId: string) {
  await query('delete from bd_opportunities where opportunity_id = $1', [opportunityId]);
}
