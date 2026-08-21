import type { PipelineEntry } from '../../types.js';
import { query } from '../../utils/sql.js';
import { withTransaction } from '../../utils/transaction.js';
import type { CreateEntryInput, UpdateEntryInput } from './entry.schema.js';

/** The person is joined in rather than duplicated on the entry: full_name and
 *  skills describe the human, flags and notes describe this particular pitch. */
const entrySelect = `select e.*, p.full_name, p.email, p.phone, p.linkedin_url, p.skills,
    s.name as status_name, s.order_index,
    co.name as company_name,
    j.title as job_title, j.status as job_status
  from pipeline_entries e
  join people p on p.person_id = e.person_id
  join status_config s on s.status_id = e.current_status_id
  join companies co on co.company_id = e.company_id
  left join job_requisitions j on j.job_id = e.job_id`;

export async function listEntries(filters: {
  flag?: string;
  company_id?: string;
  person_id?: string;
  job_id?: string;
  status_id?: string;
  search?: string;
  skills?: string[];
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.flag) {
    params.push(filters.flag);
    conditions.push(`e.flags ? $${params.length}`);
  }

  if (filters.company_id) {
    params.push(filters.company_id);
    conditions.push(`e.company_id = $${params.length}`);
  }

  if (filters.person_id) {
    params.push(filters.person_id);
    conditions.push(`e.person_id = $${params.length}`);
  }

  if (filters.job_id) {
    params.push(filters.job_id);
    conditions.push(`e.job_id = $${params.length}`);
  }

  if (filters.status_id) {
    params.push(filters.status_id);
    conditions.push(`e.current_status_id = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(
      `(lower(p.full_name) like $${idx} or lower(coalesce(p.email, '')) like $${idx} or lower(coalesce(j.title, '')) like $${idx})`,
    );
  }

  if (filters.skills?.length) {
    params.push(JSON.stringify(filters.skills));
    conditions.push(`p.skills @> $${params.length}::jsonb`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const sql = `${entrySelect} ${where} order by s.order_index asc, e.created_at desc`;

  const result = await query(sql, params);
  return result.rows;
}

export async function createEntry(input: CreateEntryInput, organizationId: string) {
  const result = await query<PipelineEntry>(
    `insert into pipeline_entries (organization_id, person_id, company_id, job_id,
        current_status_id, recruiter_id, flags, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning *`,
    [
      organizationId,
      input.person_id,
      input.company_id,
      input.job_id ?? null,
      input.current_status_id,
      input.recruiter_id,
      JSON.stringify(input.flags ?? []),
      input.notes ?? null,
    ],
  );
  return result.rows[0];
}

export async function updateEntry(id: string, input: UpdateEntryInput) {
  const fields: string[] = [];
  const params: unknown[] = [];

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    params.push(key === 'flags' ? JSON.stringify(value) : value);
    fields.push(`${key} = $${params.length}`);
  });

  if (!fields.length) {
    const current = await query<PipelineEntry>(
      'select * from pipeline_entries where entry_id = $1',
      [id],
    );
    return current.rows[0];
  }

  params.push(id);
  const result = await query<PipelineEntry>(
    `update pipeline_entries set ${fields.join(', ')}, updated_at = now()
      where entry_id = $${params.length} returning *`,
    params,
  );
  return result.rows[0];
}

export async function deleteEntry(id: string) {
  await query('delete from pipeline_entries where entry_id = $1', [id]);
}

export async function getEntryById(id: string) {
  const result = await query(`${entrySelect} where e.entry_id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function moveEntry({
  entryId,
  toStatusId,
  changedBy,
}: {
  entryId: string;
  toStatusId: string;
  changedBy: string;
}) {
  return withTransaction(async (client) => {
    const current = await client.query<PipelineEntry>(
      'select * from pipeline_entries where entry_id = $1 for update',
      [entryId],
    );
    const entry = current.rows[0];
    if (!entry) {
      throw new Error('Pipeline entry not found');
    }

    await client.query(
      'update pipeline_entries set current_status_id = $1, updated_at = now() where entry_id = $2',
      [toStatusId, entryId],
    );
    await client.query(
      `insert into entry_status_history (entry_id, from_status_id, to_status_id, change_date, changed_by)
       values ($1,$2,$3, now(), $4)`,
      [entryId, entry.current_status_id, toStatusId, changedBy],
    );

    return { ...entry, current_status_id: toStatusId };
  });
}
