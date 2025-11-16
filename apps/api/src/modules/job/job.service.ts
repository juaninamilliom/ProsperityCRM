import type { JobRequisition, JobRequisitionWithStats } from '../../types.js';
import { query } from '../../utils/sql.js';
import type { JobInput } from './job.schema.js';

export async function listJobs() {
  const result = await query(
    `select j.*,
            coalesce(c.cnt,0)::int as total_candidates
     from job_requisitions j
     left join (
       select job_requisition_id, count(*) cnt
       from candidates
       group by job_requisition_id
     ) c on c.job_requisition_id = j.job_id
     order by j.created_at desc`
  );
  return result.rows.map((row) => ({
    ...(row as JobRequisition),
    total_candidates: Number((row as any).total_candidates ?? 0),
  }));
}

export async function createJob(input: JobInput) {
  const dealAmount = input.deal_amount ? Number(input.deal_amount) : null;
  const weightedAmount = input.weighted_deal_amount ? Number(input.weighted_deal_amount) : null;
  const result = await query<JobRequisition>(
    `insert into job_requisitions (title, department, location, status, description, close_date, deal_amount, weighted_deal_amount, owner_name, stage)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning *`,
    [
      input.title,
      input.department ?? null,
      input.location ?? null,
      input.status ?? 'open',
      input.description ?? null,
      input.close_date ?? null,
      dealAmount,
      weightedAmount,
      input.owner_name ?? null,
      input.stage ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateJob(jobId: string, input: JobInput) {
  const dealAmount = input.deal_amount ? Number(input.deal_amount) : null;
  const weightedAmount = input.weighted_deal_amount ? Number(input.weighted_deal_amount) : null;
  const result = await query<JobRequisition>(
    `update job_requisitions
     set title=$1,
         department=$2,
         location=$3,
         status=$4,
         description=$5,
         close_date=$6,
         deal_amount=$7,
         weighted_deal_amount=$8,
         owner_name=$9,
         stage=$10
     where job_id=$11
     returning *`,
    [
      input.title,
      input.department ?? null,
      input.location ?? null,
      input.status ?? 'open',
      input.description ?? null,
      input.close_date ?? null,
      dealAmount,
      weightedAmount,
      input.owner_name ?? null,
      input.stage ?? null,
      jobId,
    ]
  );
  return result.rows[0];
}

export async function deleteJob(jobId: string) {
  await query('delete from job_requisitions where job_id = $1', [jobId]);
}

export async function getJobWithStats(jobId: string) {
  const result = await query(
    `select j.*,
            coalesce(count(c.candidate_id), 0)::int as total_candidates,
            coalesce(count(c.candidate_id) filter (where sc.is_terminal), 0)::int as placements
     from job_requisitions j
     left join candidates c on c.job_requisition_id = j.job_id
     left join status_config sc on c.current_status_id = sc.status_id
     where j.job_id = $1
     group by j.job_id`,
    [jobId]
  );
  if (!result.rows[0]) {
    return null;
  }
  const row = result.rows[0] as JobRequisitionWithStats;
  return {
    ...row,
    total_candidates: Number((row as any).total_candidates ?? 0),
    placements: Number((row as any).placements ?? 0),
  };
}

export async function getJobCandidates(jobId: string) {
  const result = await query(
    `select c.candidate_id, c.name, c.email, c.current_status_id, s.name as status_name, c.flags
     from candidates c
     join status_config s on c.current_status_id = s.status_id
     where c.job_requisition_id = $1
     order by c.created_at desc`,
    [jobId]
  );
  return result.rows;
}

export async function listJobSplits(jobId: string) {
  const result = await query(
    `select split_id, job_id, teammate_name, teammate_status, split_percent, role, total_deal, weighted_deal
     from job_deal_splits
     where job_id = $1
     order by created_at asc`,
    [jobId]
  );
  return result.rows;
}

export async function replaceJobSplits(
  jobId: string,
  splits: Array<{
    teammate_name: string;
    teammate_status?: string;
    split_percent?: string;
    role?: string;
    total_deal?: string;
    weighted_deal?: string;
  }>
) {
  const jobInfo = await query<{ deal_amount: number | null; weighted_deal_amount: number | null }>(
    `select deal_amount, weighted_deal_amount from job_requisitions where job_id = $1`,
    [jobId]
  );
  const dealBase = Number(jobInfo.rows[0]?.deal_amount ?? 0);
  const weightedBase = Number(jobInfo.rows[0]?.weighted_deal_amount ?? 0);

  await query('delete from job_deal_splits where job_id = $1', [jobId]);
  for (const split of splits) {
    const percent = Number(split.split_percent ?? 0);
    const totalDeal = split.total_deal ? Number(split.total_deal) : (dealBase * percent) / 100;
    const weightedDeal = split.weighted_deal ? Number(split.weighted_deal) : (weightedBase * percent) / 100;
    await query(
      `insert into job_deal_splits (job_id, teammate_name, teammate_status, split_percent, role, total_deal, weighted_deal)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [jobId, split.teammate_name, split.teammate_status ?? 'active', percent, split.role ?? null, totalDeal, weightedDeal]
    );
  }
  return listJobSplits(jobId);
}
