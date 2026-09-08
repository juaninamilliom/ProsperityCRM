import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  activities,
  bdOpportunities,
  companies,
  db,
  jobRequisitions,
  people,
} from '../../db/drizzle.js';
import type { DbOrTx } from '../../db/drizzle.js';
import type { CompanyDependents } from '../../common/pg-errors.js';
import type { CreateCompanyInput, UpdateCompanyInput } from './company.schema.js';

export async function listCompanies(filters: { relationship?: string; search?: string }) {
  const conditions = [];

  if (filters.relationship) {
    conditions.push(
      eq(
        companies.relationship,
        filters.relationship as 'prospect' | 'client' | 'former' | 'do_not_contact'
      )
    );
  }
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    conditions.push(or(ilike(companies.name, term), ilike(companies.domain, term)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      company_id: companies.company_id,
      organization_id: companies.organization_id,
      name: companies.name,
      linkedin_url: companies.linkedin_url,
      domain: companies.domain,
      industry: companies.industry,
      headcount: companies.headcount,
      location: companies.location,
      relationship: companies.relationship,
      contact_email: companies.contact_email,
      notes: companies.notes,
      created_at: companies.created_at,
      updated_at: companies.updated_at,
      contact_count: sql<number>`(select count(*) from people p where p.current_company_id = companies.company_id)::int`,
      open_deals: sql<number>`(select count(*) from bd_opportunities o where o.company_id = companies.company_id and o.stage not in ('signed','lost'))::int`,
      open_reqs: sql<number>`(select count(*) from job_requisitions j where j.company_id = companies.company_id and j.status = 'open')::int`,
      last_touch: sql<string | null>`(select max(a.occurred_at) from activities a where a.company_id = companies.company_id)`,
    })
    .from(companies)
    .where(whereClause)
    .orderBy(asc(companies.name));

  return result;
}

export async function getCompany(companyId: string) {
  const [companyRows, contacts, deals, reqs, activity] = await Promise.all([
    db.select().from(companies).where(eq(companies.company_id, companyId)),

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
        role: sql<string | null>`(
          select oc.role from opportunity_contacts oc
          join bd_opportunities o on o.opportunity_id = oc.opportunity_id
          where oc.person_id = ${people.person_id} and o.company_id = ${companyId}
          order by oc.created_at asc limit 1
        )`,
        last_touch: sql<string | null>`(select max(a.occurred_at) from activities a where a.person_id = ${people.person_id})`,
      })
      .from(people)
      .where(eq(people.current_company_id, companyId))
      .orderBy(asc(people.full_name)),

    db
      .select()
      .from(bdOpportunities)
      .where(eq(bdOpportunities.company_id, companyId))
      .orderBy(asc(bdOpportunities.expected_close)),

    db
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
        entry_count: sql<number>`(select count(*) from pipeline_entries e where e.job_id = ${jobRequisitions.job_id})::int`,
      })
      .from(jobRequisitions)
      .where(eq(jobRequisitions.company_id, companyId))
      .orderBy(desc(jobRequisitions.created_at)),

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
        person_name: people.full_name,
        opportunity_name: bdOpportunities.name,
      })
      .from(activities)
      .leftJoin(people, eq(people.person_id, activities.person_id))
      .leftJoin(bdOpportunities, eq(bdOpportunities.opportunity_id, activities.opportunity_id))
      .where(eq(activities.company_id, companyId))
      .orderBy(desc(activities.occurred_at))
      .limit(50),
  ]);

  if (!companyRows[0]) return null;
  return {
    ...companyRows[0],
    contacts,
    deals,
    requisitions: reqs,
    activity,
  };
}

export async function createCompany(organizationId: string, input: CreateCompanyInput) {
  const [row] = await db
    .insert(companies)
    .values({
      organization_id: organizationId,
      name: input.name,
      linkedin_url: input.linkedin_url,
      domain: input.domain,
      industry: input.industry,
      headcount: input.headcount,
      location: input.location,
      relationship: input.relationship,
      contact_email: input.contact_email,
      notes: input.notes,
    })
    .returning();
  return row;
}

export async function updateCompany(companyId: string, input: UpdateCompanyInput) {
  const updateValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      updateValues[key] = value;
    }
  }

  if (Object.keys(updateValues).length === 0) {
    const [current] = await db
      .select()
      .from(companies)
      .where(eq(companies.company_id, companyId));
    return current ?? null;
  }

  updateValues.updated_at = new Date();

  const [updated] = await db
    .update(companies)
    .set(updateValues)
    .where(eq(companies.company_id, companyId))
    .returning();
  return updated ?? null;
}

export async function findDuplicateCompany(
  organizationId: string,
  name: string | undefined,
  linkedinUrl: string | null | undefined,
  domain: string | null | undefined
) {
  const duplicateConditions = [];
  if (name) {
    duplicateConditions.push(sql`lower(${companies.name}) = lower(${name})`);
  }
  if (linkedinUrl) {
    duplicateConditions.push(eq(companies.linkedin_url, linkedinUrl));
  }
  if (domain) {
    duplicateConditions.push(sql`lower(${companies.domain}) = lower(${domain})`);
  }

  if (duplicateConditions.length === 0) return null;

  const [row] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.organization_id, organizationId),
        or(...duplicateConditions)
      )
    )
    .limit(1);

  return row ?? null;
}

/** Five foreign keys point at companies. Three block a delete (people,
 *  job_requisitions, pipeline_entries) and two cascade: bd_opportunities
 *  (0010:64) and activities (0010:125).
 *
 *  All five are counted. Deals are counted even though they cascade, because a
 *  deal has its own identity and its own page, and cascading one also takes
 *  the deal-won activity that records how the company became a client
 *  (0010:126).
 *
 *  Activities are counted only when they would OUTLIVE the company, meaning
 *  they also carry a person_id or an entry_id. An activity naming only this
 *  company dies with it and that is right. One that also names a person is
 *  part of that person's timeline, and the person can survive the delete: the
 *  people count above only sees people whose CURRENT company is this one
 *  (0010:44), so somebody who has since moved on, or was never assigned, is
 *  invisible to it while ActivityComposer has been writing person_id and
 *  company_id together the whole time (ActivityComposer.tsx:58-59, reached
 *  from PersonDetailPage.tsx:283).
 *
 *  An earlier version of this comment claimed the touch log "has no
 *  independent identity". That is true only of the rows that name nothing
 *  else.
 *
 *  One round trip, in the correlated-subquery form this module already uses
 *  at :46-49. Selecting from companies gives existence in the same statement,
 *  so a missing company still gets today's idempotent 204 without a second
 *  query.
 *
 *  `::int` AND Number(): count(*) is bigint, node-postgres returns bigint as a
 *  string, and dependentsMessage compares with === 1 to choose the singular.
 *  A string "1" would render "1 contacts". */
export async function countCompanyDependents(
  companyId: string,
  runner: DbOrTx = db
): Promise<CompanyDependents | null> {
  const [row] = await runner
    .select({
      people: sql<number>`(select count(*) from people p where p.current_company_id = companies.company_id)::int`,
      requisitions: sql<number>`(select count(*) from job_requisitions j where j.company_id = companies.company_id)::int`,
      entries: sql<number>`(select count(*) from pipeline_entries e where e.company_id = companies.company_id)::int`,
      deals: sql<number>`(select count(*) from bd_opportunities o where o.company_id = companies.company_id)::int`,
      activities: sql<number>`(select count(*) from activities a where a.company_id = companies.company_id and (a.person_id is not null or a.entry_id is not null))::int`,
    })
    .from(companies)
    .where(eq(companies.company_id, companyId));

  if (!row) return null;

  return {
    people: Number(row.people),
    requisitions: Number(row.requisitions),
    entries: Number(row.entries),
    deals: Number(row.deals),
    activities: Number(row.activities),
  };
}

export type DeleteCompanyResult =
  | { deleted: true }
  | { deleted: false; dependents: CompanyDependents };

/** Counts and deletes under one transaction, holding a row lock on the parent.
 *
 *  The lock is what makes the count true at the moment of the delete. Inserting
 *  a deal takes FOR KEY SHARE on the referenced companies row, and FOR UPDATE
 *  conflicts with it, so a deal created between the count and the delete has to
 *  wait. Measured: with FOR UPDATE held for 3s, the child insert returned after
 *  2013ms; with no lock held, 46ms.
 *
 *  Without it there is no error to catch, because the cascade IS the success
 *  path — the deal is destroyed and the delete reports 204.
 *
 *  The runner parameter is required rather than stylistic: db.transaction holds
 *  a pooled client for the whole callback, and a statement issued on the
 *  module-level `db` from inside it asks for a second connection. See the
 *  deadlock note in db/drizzle.ts. */
export async function deleteCompanyIfUnreferenced(companyId: string): Promise<DeleteCompanyResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ company_id: companies.company_id })
      .from(companies)
      .where(eq(companies.company_id, companyId))
      .for('update');

    if (!row) return { deleted: true };

    const dependents = await countCompanyDependents(companyId, tx);
    if (!dependents) return { deleted: true };

    const total =
      dependents.people +
      dependents.requisitions +
      dependents.entries +
      dependents.deals +
      dependents.activities;
    if (total > 0) return { deleted: false, dependents };

    await tx.delete(companies).where(eq(companies.company_id, companyId));
    return { deleted: true };
  });
}
