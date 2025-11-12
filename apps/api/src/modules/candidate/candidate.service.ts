import type { Candidate } from '../../types';
import { query } from '../../utils/sql';
import { withTransaction } from '../../utils/transaction';
import type { CreateCandidateInput, UpdateCandidateInput } from './candidate.schema';

const candidateSelect = `select c.*, s.name as status_name, s.order_index, a.name as agency_name
  from candidates c
  join status_config s on c.current_status_id = s.status_id
  join target_agency a on c.target_agency_id = a.agency_id`;

export async function listCandidates(filters: { flag?: string; agency_id?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.flag) {
    params.push(filters.flag);
    conditions.push(`c.flags ? $${params.length}`);
  }

  if (filters.agency_id) {
    params.push(filters.agency_id);
    conditions.push(`c.target_agency_id = $${params.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const sql = `${candidateSelect} ${where} order by s.order_index asc, c.created_at desc`;

  const result = await query(sql, params);
  return result.rows;
}

export async function createCandidate(input: CreateCandidateInput) {
  const result = await query<Candidate>(
    `insert into candidates (name, email, phone, target_agency_id, current_status_id, recruiter_id, flags, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning *`,
    [
      input.name,
      input.email,
      input.phone ?? null,
      input.target_agency_id,
      input.current_status_id,
      input.recruiter_id,
      JSON.stringify(input.flags ?? []),
      input.notes ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateCandidate(id: string, input: UpdateCandidateInput) {
  const fields: string[] = [];
  const params: unknown[] = [];

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    params.push(key === 'flags' ? JSON.stringify(value) : value);
    fields.push(`${key} = $${params.length}`);
  });

  if (!fields.length) {
    const current = await query<Candidate>('select * from candidates where candidate_id = $1', [id]);
    return current.rows[0];
  }

  params.push(id);
  const sql = `update candidates set ${fields.join(', ')} where candidate_id = $${params.length} returning *`;
  const result = await query<Candidate>(sql, params);
  return result.rows[0];
}

export async function deleteCandidate(id: string) {
  await query('delete from candidates where candidate_id = $1', [id]);
}

export async function moveCandidate({
  candidateId,
  toStatusId,
  changedBy,
}: {
  candidateId: string;
  toStatusId: string;
  changedBy: string;
}) {
  return withTransaction(async (client) => {
    const currentCandidate = await client.query<Candidate>('select * from candidates where candidate_id = $1 for update', [candidateId]);
    const candidate = currentCandidate.rows[0];
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    await client.query('update candidates set current_status_id = $1 where candidate_id = $2', [toStatusId, candidateId]);
    await client.query(
      `insert into candidate_status_history (candidate_id, from_status_id, to_status_id, change_date, changed_by)
       values ($1,$2,$3, now(), $4)`,
      [candidateId, candidate.current_status_id, toStatusId, changedBy]
    );

    return { ...candidate, current_status_id: toStatusId };
  });
}
