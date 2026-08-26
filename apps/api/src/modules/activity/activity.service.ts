import { and, desc, eq } from 'drizzle-orm';
import {
  activities,
  bdOpportunities,
  companies,
  db,
  people,
} from '../../db/drizzle.js';
import type { CreateActivityInput } from './activity.schema.js';

export async function listActivities(filters: {
  person_id?: string;
  company_id?: string;
  opportunity_id?: string;
}) {
  const conditions = [];

  if (filters.person_id) {
    conditions.push(eq(activities.person_id, filters.person_id));
  }
  if (filters.company_id) {
    conditions.push(eq(activities.company_id, filters.company_id));
  }
  if (filters.opportunity_id) {
    conditions.push(eq(activities.opportunity_id, filters.opportunity_id));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
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
      company_name: companies.name,
      opportunity_name: bdOpportunities.name,
    })
    .from(activities)
    .leftJoin(people, eq(people.person_id, activities.person_id))
    .leftJoin(companies, eq(companies.company_id, activities.company_id))
    .leftJoin(bdOpportunities, eq(bdOpportunities.opportunity_id, activities.opportunity_id))
    .where(whereClause)
    .orderBy(desc(activities.occurred_at))
    .limit(200);

  return result;
}

export async function createActivity(
  organizationId: string,
  userId: string,
  input: CreateActivityInput
) {
  const [row] = await db
    .insert(activities)
    .values({
      organization_id: organizationId,
      person_id: input.person_id,
      company_id: input.company_id,
      opportunity_id: input.opportunity_id,
      entry_id: input.entry_id,
      channel: input.channel,
      direction: input.direction,
      occurred_at: input.occurred_at ? new Date(input.occurred_at) : new Date(),
      subject: input.subject,
      body: input.body,
      created_by: userId,
    })
    .returning();

  return row;
}
