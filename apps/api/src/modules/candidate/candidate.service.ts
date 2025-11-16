import type { Candidate } from '../../types.js';
import { query } from '../../utils/sql.js';
import { withTransaction } from '../../utils/transaction.js';
import type { CreateCandidateInput, UpdateCandidateInput } from './candidate.schema.js';
import { ensureOrganizationSkills, normalizeSkillNames } from '../skill/skill.service.js';

const candidateSelect = `select c.*, s.name as status_name, s.order_index, a.name as agency_name, j.title as job_title, j.status as job_status
  from candidates c
  join status_config s on c.current_status_id = s.status_id
  join target_agency a on c.target_agency_id = a.agency_id
  left join job_requisitions j on c.job_requisition_id = j.job_id`;

export async function listCandidates(filters: {
  flag?: string;
  agency_id?: string;
  job_id?: string;
  status_id?: string;
  search?: string;
  skills?: string[];
}) {
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

  if (filters.job_id) {
    params.push(filters.job_id);
    conditions.push(`c.job_requisition_id = $${params.length}`);
  }

  if (filters.status_id) {
    params.push(filters.status_id);
    conditions.push(`c.current_status_id = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(`(lower(c.name) like $${idx} or lower(c.email) like $${idx} or lower(coalesce(j.title, '')) like $${idx})`);
  }

  if (filters.skills?.length) {
    params.push(JSON.stringify(filters.skills));
    conditions.push(`c.skills @> $${params.length}::jsonb`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const sql = `${candidateSelect} ${where} order by s.order_index asc, c.created_at desc`;

  const result = await query(sql, params);
  return result.rows;
}

export async function createCandidate(input: CreateCandidateInput, organizationId: string) {
  const normalizedSkills = normalizeSkillNames(input.skills ?? []);
  await ensureOrganizationSkills(organizationId, normalizedSkills);
  const result = await query<Candidate>(
    `insert into candidates (name, email, phone, target_agency_id, current_status_id, recruiter_id, job_requisition_id, flags, skills, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning *`,
    [
      input.name,
      input.email,
      input.phone ?? null,
      input.target_agency_id,
      input.current_status_id,
      input.recruiter_id,
      input.job_requisition_id ?? null,
      JSON.stringify(input.flags ?? []),
      JSON.stringify(normalizedSkills),
      input.notes ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateCandidate(id: string, input: UpdateCandidateInput, organizationId: string) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let normalizedSkills: string[] | null = null;

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    if (key === 'flags') {
      params.push(JSON.stringify(value));
    } else if (key === 'skills') {
      const nextSkills = normalizeSkillNames((value as string[] | undefined) ?? []);
      normalizedSkills = nextSkills;
      params.push(JSON.stringify(nextSkills));
    } else {
      params.push(value);
    }
    fields.push(`${key} = $${params.length}`);
  });

  if (!fields.length) {
    const current = await query<Candidate>('select * from candidates where candidate_id = $1', [id]);
    return current.rows[0];
  }

  if (normalizedSkills) {
    await ensureOrganizationSkills(organizationId, normalizedSkills);
  }

  params.push(id);
  const sql = `update candidates set ${fields.join(', ')} where candidate_id = $${params.length} returning *`;
  const result = await query<Candidate>(sql, params);
  return result.rows[0];
}

export async function deleteCandidate(id: string) {
  await query('delete from candidates where candidate_id = $1', [id]);
}

export async function getCandidateById(id: string) {
  const result = await query(`${candidateSelect} where c.candidate_id = $1`, [id]);
  return result.rows[0] ?? null;
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
