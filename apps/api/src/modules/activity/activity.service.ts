import type { Activity } from '../../types.js';
import { query } from '../../utils/sql.js';
import type { CreateActivityInput } from './activity.schema.js';

export async function listActivities(filters: {
  person_id?: string;
  company_id?: string;
  opportunity_id?: string;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const key of ['person_id', 'company_id', 'opportunity_id'] as const) {
    const value = filters[key];
    if (value) {
      params.push(value);
      conditions.push(`a.${key} = $${params.length}`);
    }
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const result = await query(
    `select a.*, p.full_name as person_name, c.name as company_name, o.name as opportunity_name
       from activities a
       left join people p on p.person_id = a.person_id
       left join companies c on c.company_id = a.company_id
       left join bd_opportunities o on o.opportunity_id = a.opportunity_id
       ${where} order by a.occurred_at desc limit 200`,
    params,
  );
  return result.rows;
}

export async function createActivity(
  organizationId: string,
  userId: string,
  input: CreateActivityInput,
) {
  const result = await query<Activity>(
    `insert into activities (organization_id, person_id, company_id, opportunity_id, entry_id,
        channel, direction, occurred_at, subject, body, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,coalesce($8::timestamptz, now()),$9,$10,$11) returning *`,
    [
      organizationId, input.person_id, input.company_id, input.opportunity_id, input.entry_id,
      input.channel, input.direction, input.occurred_at ?? null, input.subject, input.body, userId,
    ],
  );
  return result.rows[0];
}
