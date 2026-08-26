import { desc, eq } from 'drizzle-orm';
import { db, organizations } from '../../db/drizzle.js';
import type { Organization } from '../../types.js';
import type { OrganizationInput } from './organization.schema.js';

export async function listOrganizations(): Promise<Organization[]> {
  const rows = await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.created_at));
  return rows as unknown as Organization[];
}

export async function createOrganization(input: OrganizationInput): Promise<Organization> {
  const [row] = await db
    .insert(organizations)
    .values({
      name: input.name,
      slug: input.slug.toLowerCase(),
    })
    .returning();
  return row as unknown as Organization;
}

export async function updateOrganization(
  id: string,
  input: OrganizationInput
): Promise<Organization> {
  const [row] = await db
    .update(organizations)
    .set({
      name: input.name,
      slug: input.slug.toLowerCase(),
    })
    .where(eq(organizations.organization_id, id))
    .returning();
  return row as unknown as Organization;
}

export async function getOrganizationById(id: string): Promise<Organization | undefined> {
  const [row] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.organization_id, id));
  return (row as unknown as Organization) ?? undefined;
}
