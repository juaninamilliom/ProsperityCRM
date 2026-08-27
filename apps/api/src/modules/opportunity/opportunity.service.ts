import { and, asc, eq, ne, sql } from 'drizzle-orm';
import {
  activities,
  bdOpportunities,
  companies,
  db,
  opportunityContacts,
} from '../../db/drizzle.js';
import type { CreateOpportunityInput, UpdateOpportunityInput } from './opportunity.schema.js';


export async function listOpportunities(filters: { company_id?: string; stage?: string }) {
  const conditions = [];

  if (filters.company_id) {
    conditions.push(eq(bdOpportunities.company_id, filters.company_id));
  }
  if (filters.stage) {
    conditions.push(
      eq(
        bdOpportunities.stage,
        filters.stage as
          | 'prospect'
          | 'contacted'
          | 'meeting'
          | 'proposal'
          | 'negotiation'
          | 'signed'
          | 'lost'
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
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
      company_name: companies.name,
      relationship: companies.relationship,
      contacts: sql<unknown[]>`coalesce((
        select json_agg(json_build_object(
          'person_id', p.person_id, 'full_name', p.full_name, 'role', oc.role)
          order by oc.created_at)
          from opportunity_contacts oc
          join people p on p.person_id = oc.person_id
         where oc.opportunity_id = bd_opportunities.opportunity_id
      ), '[]'::json)`,
      last_touch: sql<string | null>`(
        select max(a.occurred_at) from activities a
        where a.opportunity_id = bd_opportunities.opportunity_id
      )`,
    })
    .from(bdOpportunities)
    .innerJoin(companies, eq(companies.company_id, bdOpportunities.company_id))
    .where(whereClause)
    .orderBy(asc(bdOpportunities.expected_close));

  return result;
}

export async function getOpportunity(opportunityId: string) {
  const [row] = await db
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
      company_name: companies.name,
      relationship: companies.relationship,
      contacts: sql<unknown[]>`coalesce((
        select json_agg(json_build_object(
          'person_id', p.person_id, 'full_name', p.full_name, 'role', oc.role)
          order by oc.created_at)
          from opportunity_contacts oc
          join people p on p.person_id = oc.person_id
         where oc.opportunity_id = bd_opportunities.opportunity_id
      ), '[]'::json)`,
      last_touch: sql<string | null>`(
        select max(a.occurred_at) from activities a
        where a.opportunity_id = bd_opportunities.opportunity_id
      )`,
    })
    .from(bdOpportunities)
    .innerJoin(companies, eq(companies.company_id, bdOpportunities.company_id))
    .where(eq(bdOpportunities.opportunity_id, opportunityId));

  return row ?? null;
}

export async function getOpportunityRaw(opportunityId: string) {
  const [row] = await db
    .select()
    .from(bdOpportunities)
    .where(eq(bdOpportunities.opportunity_id, opportunityId));
  return row ?? null;
}

export async function createOpportunity(organizationId: string, input: CreateOpportunityInput) {
  const [row] = await db
    .insert(bdOpportunities)
    .values({
      organization_id: organizationId,
      company_id: input.company_id,
      name: input.name,
      stage:
        (input.stage as
          | 'prospect'
          | 'contacted'
          | 'meeting'
          | 'proposal'
          | 'negotiation'
          | 'signed'
          | 'lost'
          | undefined) ?? 'prospect',
      fee_percent:
        input.fee_percent !== undefined && input.fee_percent !== null
          ? String(input.fee_percent)
          : null,
      est_annual_value:
        input.est_annual_value !== undefined && input.est_annual_value !== null
          ? String(input.est_annual_value)
          : null,
      expected_close: input.expected_close ?? null,
      owner_id: input.owner_id ?? null,
    })
    .returning();
  return row;
}


export async function updateOpportunity(opportunityId: string, input: UpdateOpportunityInput) {
  const updateValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === 'fee_percent' || key === 'est_annual_value') {
        updateValues[key] = value !== null ? String(value) : null;
      } else {
        updateValues[key] = value;
      }
    }
  }

  if (Object.keys(updateValues).length === 0) {
    return getOpportunityRaw(opportunityId);
  }

  updateValues.updated_at = new Date();

  const [updated] = await db
    .update(bdOpportunities)
    .set(updateValues)
    .where(eq(bdOpportunities.opportunity_id, opportunityId))
    .returning();

  return updated ?? null;
}

export async function addContact(opportunityId: string, personId: string, role?: string) {
  await db
    .insert(opportunityContacts)
    .values({
      opportunity_id: opportunityId,
      person_id: personId,
      role: role as
        | 'champion'
        | 'decision_maker'
        | 'influencer'
        | 'blocker'
        | 'intro'
        | undefined,
    })
    .onConflictDoUpdate({
      target: [opportunityContacts.opportunity_id, opportunityContacts.person_id],
      set: {
        role: role as
          | 'champion'
          | 'decision_maker'
          | 'influencer'
          | 'blocker'
          | 'intro'
          | undefined,
      },
    });

  return getOpportunity(opportunityId);
}

export async function removeContact(opportunityId: string, personId: string) {
  await db
    .delete(opportunityContacts)
    .where(
      and(
        eq(opportunityContacts.opportunity_id, opportunityId),
        eq(opportunityContacts.person_id, personId)
      )
    );
}

export async function deleteOpportunity(opportunityId: string) {
  await db.delete(bdOpportunities).where(eq(bdOpportunities.opportunity_id, opportunityId));
}

export async function transitionOpportunityStage({
  deal,
  nextStage,
  lostReason,
  userId,
  move,
}: {
  deal: {
    opportunity_id: string;
    organization_id: string;
    company_id: string;
    name: string;
  };
  nextStage: 'prospect' | 'contacted' | 'meeting' | 'proposal' | 'negotiation' | 'signed' | 'lost';
  lostReason?: string | null;
  userId: string;
  move: { closed_at: string | null; promoteCompanyToClient: boolean };
}) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(bdOpportunities)
      .set({
        stage: nextStage,
        closed_at: move.closed_at ? new Date(move.closed_at) : null,
        lost_reason: lostReason ?? null,
        updated_at: new Date(),
      })
      .where(eq(bdOpportunities.opportunity_id, deal.opportunity_id))
      .returning();

    if (move.promoteCompanyToClient) {
      await tx
        .update(companies)
        .set({
          relationship: 'client',
          updated_at: new Date(),
        })
        .where(
          and(
            eq(companies.company_id, deal.company_id),
            ne(companies.relationship, 'client')
          )
        );

      await tx.insert(activities).values({
        organization_id: deal.organization_id,
        company_id: deal.company_id,
        opportunity_id: deal.opportunity_id,
        channel: 'note',
        direction: 'internal',
        occurred_at: new Date(),
        subject: 'Deal won',
        body: `${deal.name} signed. Relationship moved to client.`,
        created_by: userId,
      });
    }

    return row;
  });
}

