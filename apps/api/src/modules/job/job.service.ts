import type { JobRequisition } from '../../types.js';
import { query } from '../../utils/sql.js';
import type { JobInput } from './job.schema.js';

export async function listJobs() {
  const result = await query<JobRequisition>('select * from job_requisitions order by created_at desc');
  return result.rows;
}

export async function createJob(input: JobInput) {
  const result = await query<JobRequisition>(
    `insert into job_requisitions (title, department, location, status, description)
     values ($1,$2,$3,$4,$5)
     returning *`,
    [input.title, input.department ?? null, input.location ?? null, input.status ?? 'open', input.description ?? null]
  );
  return result.rows[0];
}

export async function updateJob(jobId: string, input: JobInput) {
  const result = await query<JobRequisition>(
    `update job_requisitions
     set title=$1,
         department=$2,
         location=$3,
         status=$4,
         description=$5
     where job_id=$6
     returning *`,
    [input.title, input.department ?? null, input.location ?? null, input.status ?? 'open', input.description ?? null, jobId]
  );
  return result.rows[0];
}

export async function deleteJob(jobId: string) {
  await query('delete from job_requisitions where job_id = $1', [jobId]);
}
