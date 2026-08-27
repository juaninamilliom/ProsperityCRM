import { asc, desc, eq, sql } from 'drizzle-orm';
import {
  companies,
  db,
  jobDealSplits,
  jobRequisitions,
  people,
  pipelineEntries,
  statusConfig,
} from '../../db/drizzle.js';
import type { JobInput } from './job.schema.js';

export async function listJobs() {
  const result = await db
    .select({
      job_id: jobRequisitions.job_id,
      title: jobRequisitions.title,
      department: jobRequisitions.department,
      location: jobRequisitions.location,
      status: jobRequisitions.status,
      description: jobRequisitions.description,
      close_date: jobRequisitions.close_date,
      deal_amount: jobRequisitions.deal_amount,
      weighted_deal_amount: jobRequisitions.weighted_deal_amount,
      owner_name: jobRequisitions.owner_name,
      stage: jobRequisitions.stage,
      company_id: jobRequisitions.company_id,
      opportunity_id: jobRequisitions.opportunity_id,
      created_at: jobRequisitions.created_at,
      company_name: companies.name,
      total_entries: sql<number>`coalesce((select count(*) from pipeline_entries e where e.job_id = job_requisitions.job_id), 0)::int`,
    })
    .from(jobRequisitions)
    .leftJoin(companies, eq(companies.company_id, jobRequisitions.company_id))
    .orderBy(desc(jobRequisitions.created_at));

  return result.map((row) => ({
    ...row,
    total_entries: Number(row.total_entries ?? 0),
  }));
}

export async function createJob(input: JobInput) {
  const dealAmount = input.deal_amount ? String(input.deal_amount) : null;
  const weightedAmount = input.weighted_deal_amount ? String(input.weighted_deal_amount) : null;

  const [row] = await db
    .insert(jobRequisitions)
    .values({
      title: input.title,
      department: input.department ?? null,
      location: input.location ?? null,
      status: input.status ?? 'open',
      description: input.description ?? null,
      close_date: input.close_date ?? null,
      deal_amount: dealAmount,
      weighted_deal_amount: weightedAmount,
      owner_name: input.owner_name ?? null,
      stage: input.stage ?? null,
      company_id: input.company_id ?? null,
      opportunity_id: input.opportunity_id ?? null,
    })
    .returning();
  return row;
}

export async function updateJob(jobId: string, input: JobInput) {
  const dealAmount = input.deal_amount ? String(input.deal_amount) : null;
  const weightedAmount = input.weighted_deal_amount ? String(input.weighted_deal_amount) : null;

  const [row] = await db
    .update(jobRequisitions)
    .set({
      title: input.title,
      department: input.department ?? null,
      location: input.location ?? null,
      status: input.status ?? 'open',
      description: input.description ?? null,
      close_date: input.close_date ?? null,
      deal_amount: dealAmount,
      weighted_deal_amount: weightedAmount,
      owner_name: input.owner_name ?? null,
      stage: input.stage ?? null,
      company_id: input.company_id ?? null,
      opportunity_id: input.opportunity_id ?? null,
    })
    .where(eq(jobRequisitions.job_id, jobId))
    .returning();
  return row;
}

export async function deleteJob(jobId: string) {
  await db.delete(jobRequisitions).where(eq(jobRequisitions.job_id, jobId));
}

export async function getJobWithStats(jobId: string) {
  const [row] = await db
    .select({
      job_id: jobRequisitions.job_id,
      title: jobRequisitions.title,
      department: jobRequisitions.department,
      location: jobRequisitions.location,
      status: jobRequisitions.status,
      description: jobRequisitions.description,
      close_date: jobRequisitions.close_date,
      deal_amount: jobRequisitions.deal_amount,
      weighted_deal_amount: jobRequisitions.weighted_deal_amount,
      owner_name: jobRequisitions.owner_name,
      stage: jobRequisitions.stage,
      company_id: jobRequisitions.company_id,
      opportunity_id: jobRequisitions.opportunity_id,
      created_at: jobRequisitions.created_at,
      company_name: companies.name,
      total_entries: sql<number>`coalesce(count(${pipelineEntries.entry_id}), 0)::int`,
      placements: sql<number>`coalesce(count(${pipelineEntries.entry_id}) filter (where ${statusConfig.is_terminal}), 0)::int`,
    })
    .from(jobRequisitions)
    .leftJoin(companies, eq(companies.company_id, jobRequisitions.company_id))
    .leftJoin(pipelineEntries, eq(pipelineEntries.job_id, jobRequisitions.job_id))
    .leftJoin(statusConfig, eq(statusConfig.status_id, pipelineEntries.current_status_id))
    .where(eq(jobRequisitions.job_id, jobId))
    .groupBy(jobRequisitions.job_id, companies.name);

  if (!row) {
    return null;
  }
  return {
    ...row,
    total_entries: Number(row.total_entries ?? 0),
    placements: Number(row.placements ?? 0),
  };
}

export async function getJobEntries(jobId: string) {
  const result = await db
    .select({
      entry_id: pipelineEntries.entry_id,
      person_id: pipelineEntries.person_id,
      full_name: people.full_name,
      email: people.email,
      skills: people.skills,
      current_status_id: pipelineEntries.current_status_id,
      status_name: statusConfig.name,
      flags: pipelineEntries.flags,
    })
    .from(pipelineEntries)
    .innerJoin(people, eq(people.person_id, pipelineEntries.person_id))
    .innerJoin(statusConfig, eq(statusConfig.status_id, pipelineEntries.current_status_id))
    .where(eq(pipelineEntries.job_id, jobId))
    .orderBy(desc(pipelineEntries.created_at));

  return result;
}

export async function listJobSplits(jobId: string) {
  const result = await db
    .select({
      split_id: jobDealSplits.split_id,
      job_id: jobDealSplits.job_id,
      teammate_name: jobDealSplits.teammate_name,
      teammate_status: jobDealSplits.teammate_status,
      split_percent: jobDealSplits.split_percent,
      role: jobDealSplits.role,
      total_deal: jobDealSplits.total_deal,
      weighted_deal: jobDealSplits.weighted_deal,
    })
    .from(jobDealSplits)
    .where(eq(jobDealSplits.job_id, jobId))
    .orderBy(asc(jobDealSplits.created_at));

  return result;
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
  return db.transaction(async (tx) => {
    const [jobInfo] = await tx
      .select({
        deal_amount: jobRequisitions.deal_amount,
        weighted_deal_amount: jobRequisitions.weighted_deal_amount,
      })
      .from(jobRequisitions)
      .where(eq(jobRequisitions.job_id, jobId));

    const dealBase = Number(jobInfo?.deal_amount ?? 0);
    const weightedBase = Number(jobInfo?.weighted_deal_amount ?? 0);
    let leadDealAccumulator = 0;
    let leadWeightedAccumulator = 0;

    await tx.delete(jobDealSplits).where(eq(jobDealSplits.job_id, jobId));

    for (const split of splits) {
      const normalizedRole = split.role?.toLowerCase() === 'secondary' ? 'secondary' : 'lead';
      const percentValue = Number(split.split_percent ?? 0);
      const ratio = percentValue / 100;
      let totalDeal: number;
      let weightedDeal: number;
      if (normalizedRole === 'secondary' && leadDealAccumulator > 0) {
        totalDeal = split.total_deal ? Number(split.total_deal) : leadDealAccumulator * ratio;
        weightedDeal = split.weighted_deal
          ? Number(split.weighted_deal)
          : leadWeightedAccumulator * ratio;
      } else {
        totalDeal = split.total_deal ? Number(split.total_deal) : dealBase * ratio;
        weightedDeal = split.weighted_deal ? Number(split.weighted_deal) : weightedBase * ratio;
        if (normalizedRole === 'lead') {
          leadDealAccumulator += totalDeal;
          leadWeightedAccumulator += weightedDeal;
        }
      }
      await tx.insert(jobDealSplits).values({
        job_id: jobId,
        teammate_name: split.teammate_name,
        teammate_status: split.teammate_status ?? 'active',
        split_percent: String(percentValue),
        role: normalizedRole,
        total_deal: String(totalDeal),
        weighted_deal: String(weightedDeal),
      });
    }

    return tx
      .select({
        split_id: jobDealSplits.split_id,
        job_id: jobDealSplits.job_id,
        teammate_name: jobDealSplits.teammate_name,
        teammate_status: jobDealSplits.teammate_status,
        split_percent: jobDealSplits.split_percent,
        role: jobDealSplits.role,
        total_deal: jobDealSplits.total_deal,
        weighted_deal: jobDealSplits.weighted_deal,
      })
      .from(jobDealSplits)
      .where(eq(jobDealSplits.job_id, jobId))
      .orderBy(asc(jobDealSplits.created_at));
  });
}
