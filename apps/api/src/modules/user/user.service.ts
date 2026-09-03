import { asc, desc, eq } from 'drizzle-orm';
import { db, organizations, users } from '../../db/drizzle.js';
import type { User } from '../../types.js';

export async function getUserBySsoId(ssoId: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.sso_id, ssoId));
  return (row as unknown as User | undefined) ?? undefined;
}

export async function getUserById(userId: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.user_id, userId));
  // The cast used to swallow the undefined: TypeScript inferred Promise<User>
  // while the body could return nothing, so the middleware's `!user` check
  // looked redundant to the type system. It is not - a deleted user reaches it.
  return (row as unknown as User | undefined) ?? undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email));
  return (row as unknown as User | undefined) ?? undefined;
}

export async function updateUserRoleAndOrg({
  userId,
  organizationId,
  role,
}: {
  userId: string;
  organizationId: string;
  role: 'OrgAdmin' | 'OrgEmployee';
}): Promise<User | undefined> {
  const [row] = await db
    .update(users)
    .set({
      organization_id: organizationId,
      role,
    })
    .where(eq(users.user_id, userId))
    .returning();

  return (row as unknown as User | undefined) ?? undefined;
}

export async function listUsersByOrg(organizationId: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.organization_id, organizationId))
    .orderBy(asc(users.name));

  return rows as unknown as User[];
}

export async function createLocalUser(input: {
  email: string;
  password: string;
  name: string;
  organization_id: string;
  role: 'OrgAdmin' | 'OrgEmployee';
}) {
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      password: input.password,
      organization_id: input.organization_id,
      role: input.role,
    })
    .returning();

  return row as unknown as User;
}

export async function listAllUsers() {
  const rows = await db
    .select({
      user_id: users.user_id,
      email: users.email,
      name: users.name,
      role: users.role,
      sso_id: users.sso_id,
      is_active: users.is_active,
      organization_id: users.organization_id,
      created_at: users.created_at,
      organization_name: organizations.name,
    })
    .from(users)
    .leftJoin(organizations, eq(organizations.organization_id, users.organization_id))
    .orderBy(desc(users.created_at));

  return rows;
}

export async function deleteUser(userId: string) {
  await db.delete(users).where(eq(users.user_id, userId));
}
