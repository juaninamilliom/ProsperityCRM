import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  companies,
  db,
  entryStatusHistory,
  jobRequisitions,
  people,
  pipelineEntries,
  statusConfig,
} from '../../db/drizzle.js';
import type { CreateEntryInput, UpdateEntryInput } from './entry.schema.js';

export async function listEntries(filters: {
  flag?: string;
  company_id?: string;
  person_id?: string;
  job_id?: string;
  status_id?: string;
  search?: string;
  skills?: string[];
}) {
  const conditions = [];

  if (filters.flag) {
    conditions.push(sql`${pipelineEntries.flags} ? ${filters.flag}`);
  }
  if (filters.company_id) {
    conditions.push(eq(pipelineEntries.company_id, filters.company_id));
  }
  if (filters.person_id) {
    conditions.push(eq(pipelineEntries.person_id, filters.person_id));
  }
  if (filters.job_id) {
    conditions.push(eq(pipelineEntries.job_id, filters.job_id));
  }
  if (filters.status_id) {
    conditions.push(eq(pipelineEntries.current_status_id, filters.status_id));
  }
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        ilike(people.full_name, term),
        ilike(people.email, term),
        ilike(jobRequisitions.title, term)
      )
    );
  }
  if (filters.skills?.length) {
    conditions.push(sql`${people.skills} @> ${JSON.stringify(filters.skills)}::jsonb`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      entry_id: pipelineEntries.entry_id,
      organization_id: pipelineEntries.organization_id,
      person_id: pipelineEntries.person_id,
      company_id: pipelineEntries.company_id,
      job_id: pipelineEntries.job_id,
      current_status_id: pipelineEntries.current_status_id,
      recruiter_id: pipelineEntries.recruiter_id,
      flags: pipelineEntries.flags,
      notes: pipelineEntries.notes,
      created_at: pipelineEntries.created_at,
      updated_at: pipelineEntries.updated_at,
      full_name: people.full_name,
      email: people.email,
      phone: people.phone,
      linkedin_url: people.linkedin_url,
      skills: people.skills,
      status_name: statusConfig.name,
      order_index: statusConfig.order_index,
      company_name: companies.name,
      job_title: jobRequisitions.title,
      job_status: jobRequisitions.status,
    })
    .from(pipelineEntries)
    .innerJoin(people, eq(people.person_id, pipelineEntries.person_id))
    .innerJoin(statusConfig, eq(statusConfig.status_id, pipelineEntries.current_status_id))
    .innerJoin(companies, eq(companies.company_id, pipelineEntries.company_id))
    .leftJoin(jobRequisitions, eq(jobRequisitions.job_id, pipelineEntries.job_id))
    .where(whereClause)
    .orderBy(asc(statusConfig.order_index), desc(pipelineEntries.created_at));

  return result;
}

export async function createEntry(input: CreateEntryInput, organizationId: string) {
  const [row] = await db
    .insert(pipelineEntries)
    .values({
      organization_id: organizationId,
      person_id: input.person_id,
      company_id: input.company_id,
      job_id: input.job_id ?? null,
      current_status_id: input.current_status_id,
      recruiter_id: input.recruiter_id,
      flags: input.flags ?? [],
      notes: input.notes ?? null,
    })
    .returning();
  return row;
}

export async function updateEntry(id: string, input: UpdateEntryInput) {
  const updateValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      updateValues[key] = value;
    }
  }

  if (Object.keys(updateValues).length === 0) {
    const [current] = await db
      .select()
      .from(pipelineEntries)
      .where(eq(pipelineEntries.entry_id, id));
    return current;
  }

  updateValues.updated_at = new Date();

  const [updated] = await db
    .update(pipelineEntries)
    .set(updateValues)
    .where(eq(pipelineEntries.entry_id, id))
    .returning();
  return updated;
}

export async function deleteEntry(id: string) {
  await db.delete(pipelineEntries).where(eq(pipelineEntries.entry_id, id));
}

export async function getEntryById(id: string) {
  const [row] = await db
    .select({
      entry_id: pipelineEntries.entry_id,
      organization_id: pipelineEntries.organization_id,
      person_id: pipelineEntries.person_id,
      company_id: pipelineEntries.company_id,
      job_id: pipelineEntries.job_id,
      current_status_id: pipelineEntries.current_status_id,
      recruiter_id: pipelineEntries.recruiter_id,
      flags: pipelineEntries.flags,
      notes: pipelineEntries.notes,
      created_at: pipelineEntries.created_at,
      updated_at: pipelineEntries.updated_at,
      full_name: people.full_name,
      email: people.email,
      phone: people.phone,
      linkedin_url: people.linkedin_url,
      skills: people.skills,
      status_name: statusConfig.name,
      order_index: statusConfig.order_index,
      company_name: companies.name,
      job_title: jobRequisitions.title,
      job_status: jobRequisitions.status,
    })
    .from(pipelineEntries)
    .innerJoin(people, eq(people.person_id, pipelineEntries.person_id))
    .innerJoin(statusConfig, eq(statusConfig.status_id, pipelineEntries.current_status_id))
    .innerJoin(companies, eq(companies.company_id, pipelineEntries.company_id))
    .leftJoin(jobRequisitions, eq(jobRequisitions.job_id, pipelineEntries.job_id))
    .where(eq(pipelineEntries.entry_id, id));

  return row ?? null;
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
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(pipelineEntries)
      .where(eq(pipelineEntries.entry_id, entryId))
      .for('update');

    if (!entry) {
      throw new Error('Pipeline entry not found');
    }

    await tx
      .update(pipelineEntries)
      .set({ current_status_id: toStatusId, updated_at: new Date() })
      .where(eq(pipelineEntries.entry_id, entryId));

    await tx.insert(entryStatusHistory).values({
      entry_id: entryId,
      from_status_id: entry.current_status_id,
      to_status_id: toStatusId,
      changed_by: changedBy,
    });

    return { ...entry, current_status_id: toStatusId };
  });
}
