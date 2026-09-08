import { asc, desc, eq, or, sql } from 'drizzle-orm';
import {
  activities,
  bdOpportunities,
  db,
  entryStatusHistory,
  organizations,
  orgInviteCodes,
  pipelineEntries,
  users,
} from '../../db/drizzle.js';
import type { DbOrTx } from '../../db/drizzle.js';
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

/** `runner` lets a caller that already holds a transaction read on THAT handle.
 *  Reading on the module-level `db` from inside a transaction asks the pool for
 *  a second connection while the first is held, which deadlocks - see the note
 *  on `Tx` in db/drizzle.ts. */
export async function getUserByEmail(
  email: string,
  runner: DbOrTx = db
): Promise<User | undefined> {
  const [row] = await runner.select().from(users).where(eq(users.email, email));
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

export interface UserDependents {
  entries: number;
  history: number;
  activities: number;
  deals: number;
  invites: number;
}

/** Counted only after the delete has failed. Six foreign keys point at users
 *  and none of them cascades: pipeline_entries.recruiter_id, which is NOT NULL
 *  (0010:97), entry_status_history.changed_by (0010:116),
 *  activities.created_by (0010:136), bd_opportunities.owner_id (0010:72), and
 *  both org_invite_codes audit columns (0004:9,:11).
 *
 *  recruiter_id being NOT NULL is why this blocks rather than nulling the
 *  references out. Reassigning a departing recruiter's pipeline is a feature,
 *  and it is not this guard's job to improvise one.
 *
 *  passkeys (0014:5) and auth_challenges (0014:33) cascade and are not
 *  counted. magic_links does NOT: it is keyed by email and carries no user_id
 *  and no foreign key to users at all (0014:18-26). An earlier version of this
 *  comment named magic_links as cascading, which would tell the next reader a
 *  gap was closed that is not. Deleting a user leaves their outstanding links
 *  alive, and verifyMagicLink recreates the account from the link's invite_code
 *  and issues a token (magic-link.service.ts:105-128). That path predates this
 *  guard and is recorded as F14 in the remediation plan; it belongs to the
 *  auth module, not here. */
export async function countUserDependents(userId: string): Promise<UserDependents> {
  const [entryRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pipelineEntries)
    .where(eq(pipelineEntries.recruiter_id, userId));

  const [historyRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(entryStatusHistory)
    .where(eq(entryStatusHistory.changed_by, userId));

  const [activityRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activities)
    .where(eq(activities.created_by, userId));

  const [dealRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bdOpportunities)
    .where(eq(bdOpportunities.owner_id, userId));

  const [inviteRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgInviteCodes)
    .where(or(eq(orgInviteCodes.created_by, userId), eq(orgInviteCodes.revoked_by, userId)));

  return {
    entries: Number(entryRow?.count ?? 0),
    history: Number(historyRow?.count ?? 0),
    activities: Number(activityRow?.count ?? 0),
    deals: Number(dealRow?.count ?? 0),
    invites: Number(inviteRow?.count ?? 0),
  };
}

export async function deleteUser(userId: string) {
  await db.delete(users).where(eq(users.user_id, userId));
}
