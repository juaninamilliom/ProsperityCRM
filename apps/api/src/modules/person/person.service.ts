import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  activities,
  bdOpportunities,
  companies,
  db,
  jobRequisitions,
  opportunityContacts,
  people,
  pipelineEntries,
  statusConfig,
} from '../../db/drizzle.js';
import { ensureOrganizationSkills, normalizeSkillNames } from '../skill/skill.service.js';
import type { CreatePersonInput, UpdatePersonInput } from './person.schema.js';

export async function listPeople(filters: { search?: string; company_id?: string }) {
  const conditions = [];

  if (filters.company_id) {
    conditions.push(eq(people.current_company_id, filters.company_id));
  }
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        ilike(people.full_name, term),
        ilike(people.email, term),
        ilike(people.linkedin_url, term)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      person_id: people.person_id,
      organization_id: people.organization_id,
      full_name: people.full_name,
      email: people.email,
      phone: people.phone,
      linkedin_url: people.linkedin_url,
      headline: people.headline,
      location: people.location,
      current_company_id: people.current_company_id,
      current_title: people.current_title,
      skills: people.skills,
      notes: people.notes,
      source: people.source,
      created_at: people.created_at,
      updated_at: people.updated_at,
      company_name: companies.name,
      company_relationship: companies.relationship,
      entry_count: sql<number>`(select count(*) from pipeline_entries e where e.person_id = people.person_id)::int`,
      deal_count: sql<number>`(select count(*) from opportunity_contacts oc where oc.person_id = people.person_id)::int`,
      last_touch: sql<string | null>`(select max(a.occurred_at) from activities a where a.person_id = people.person_id)`,
    })
    .from(people)
    .leftJoin(companies, eq(companies.company_id, people.current_company_id))
    .where(whereClause)
    .orderBy(asc(people.full_name));

  return result;
}

/** The flywheel page: every pitch this person has been in, every deal they are
 *  a contact on, and one timeline spanning both funnels. */
export async function getPerson(personId: string) {
  const [personRows, entries, deals, activity] = await Promise.all([
    db
      .select({
        person_id: people.person_id,
        organization_id: people.organization_id,
        full_name: people.full_name,
        email: people.email,
        phone: people.phone,
        linkedin_url: people.linkedin_url,
        headline: people.headline,
        location: people.location,
        current_company_id: people.current_company_id,
        current_title: people.current_title,
        skills: people.skills,
        notes: people.notes,
        source: people.source,
        created_at: people.created_at,
        updated_at: people.updated_at,
        company_name: companies.name,
        company_relationship: companies.relationship,
        company_location: companies.location,
      })
      .from(people)
      .leftJoin(companies, eq(companies.company_id, people.current_company_id))
      .where(eq(people.person_id, personId)),

    db
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
        status_name: statusConfig.name,
        is_terminal: statusConfig.is_terminal,
        company_name: companies.name,
        company_relationship: companies.relationship,
        job_title: jobRequisitions.title,
      })
      .from(pipelineEntries)
      .innerJoin(statusConfig, eq(statusConfig.status_id, pipelineEntries.current_status_id))
      .innerJoin(companies, eq(companies.company_id, pipelineEntries.company_id))
      .leftJoin(jobRequisitions, eq(jobRequisitions.job_id, pipelineEntries.job_id))
      .where(eq(pipelineEntries.person_id, personId))
      .orderBy(desc(pipelineEntries.created_at)),

    db
      .select({
        opportunity_id: bdOpportunities.opportunity_id,
        organization_id: bdOpportunities.organization_id,
        company_id: bdOpportunities.company_id,
        name: bdOpportunities.name,
        stage: bdOpportunities.stage,
        fee_percent: bdOpportunities.fee_percent,
        est_annual_value: bdOpportunities.est_annual_value,
        expected_close: bdOpportunities.expected_close,
        owner_id: bdOpportunities.owner_id,
        lost_reason: bdOpportunities.lost_reason,
        closed_at: bdOpportunities.closed_at,
        created_at: bdOpportunities.created_at,
        updated_at: bdOpportunities.updated_at,
        role: opportunityContacts.role,
        company_name: companies.name,
        company_relationship: companies.relationship,
      })
      .from(opportunityContacts)
      .innerJoin(
        bdOpportunities,
        eq(bdOpportunities.opportunity_id, opportunityContacts.opportunity_id)
      )
      .innerJoin(companies, eq(companies.company_id, bdOpportunities.company_id))
      .where(eq(opportunityContacts.person_id, personId))
      .orderBy(asc(bdOpportunities.expected_close)),

    db
      .select({
        activity_id: activities.activity_id,
        organization_id: activities.organization_id,
        person_id: activities.person_id,
        company_id: activities.company_id,
        opportunity_id: activities.opportunity_id,
        entry_id: activities.entry_id,
        channel: activities.channel,
        direction: activities.direction,
        occurred_at: activities.occurred_at,
        subject: activities.subject,
        body: activities.body,
        created_by: activities.created_by,
        created_at: activities.created_at,
        company_name: companies.name,
        opportunity_name: bdOpportunities.name,
      })
      .from(activities)
      .leftJoin(companies, eq(companies.company_id, activities.company_id))
      .leftJoin(bdOpportunities, eq(bdOpportunities.opportunity_id, activities.opportunity_id))
      .where(eq(activities.person_id, personId))
      .orderBy(desc(activities.occurred_at))
      .limit(100),
  ]);

  if (!personRows[0]) return null;
  return {
    ...personRows[0],
    entries,
    deals,
    activity,
  };
}

export async function createPerson(organizationId: string, input: CreatePersonInput) {
  const skills = normalizeSkillNames(input.skills ?? []);
  await ensureOrganizationSkills(organizationId, skills);

  const [row] = await db
    .insert(people)
    .values({
      organization_id: organizationId,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      linkedin_url: input.linkedin_url,
      headline: input.headline,
      location: input.location,
      current_company_id: input.current_company_id,
      current_title: input.current_title,
      skills,
      notes: input.notes,
      source: input.source,
    })
    .returning();
  return row;
}

export async function updatePerson(
  personId: string,
  organizationId: string,
  input: UpdatePersonInput
) {
  const updateValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (key === 'skills') {
      const skills = normalizeSkillNames((value as string[] | undefined) ?? []);
      await ensureOrganizationSkills(organizationId, skills);
      updateValues.skills = skills;
    } else {
      updateValues[key] = value;
    }
  }

  if (Object.keys(updateValues).length === 0) {
    const [current] = await db.select().from(people).where(eq(people.person_id, personId));
    return current ?? null;
  }

  updateValues.updated_at = new Date();

  const [updated] = await db
    .update(people)
    .set(updateValues)
    .where(eq(people.person_id, personId))
    .returning();
  return updated ?? null;
}

export async function findDuplicatePerson(
  organizationId: string,
  linkedinUrl: string | null | undefined,
  email: string | null | undefined
) {
  if (!linkedinUrl && !email) return null;

  const duplicateConditions = [];
  if (linkedinUrl) {
    const cleanUrl = linkedinUrl.split('?')[0].replace(/\/+$/, '').toLowerCase();
    const slugMatch = cleanUrl.match(/\/(in|sales\/lead|sales\/people|talent\/profile)\/([^/?#]+)/i);
    const slug = slugMatch ? slugMatch[2].toLowerCase() : null;

    if (slug) {
      duplicateConditions.push(
        or(
          sql`lower(${people.linkedin_url}) = ${cleanUrl}`,
          ilike(people.linkedin_url, `%/in/${slug}%`),
          ilike(people.linkedin_url, `%/${slug}`)
        )
      );
    } else {
      duplicateConditions.push(sql`lower(${people.linkedin_url}) = ${cleanUrl}`);
    }
  }
  if (email) {
    duplicateConditions.push(sql`lower(${people.email}) = lower(${email})`);
  }

  const [row] = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.organization_id, organizationId),
        or(...duplicateConditions)
      )
    )
    .limit(1);

  return row ?? null;
}
