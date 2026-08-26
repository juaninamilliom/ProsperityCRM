import crypto from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import type { Role } from '../../common/types.js';
import { db, orgInviteCodes, users } from '../../db/drizzle.js';
import type { User } from '../../types.js';
import { assertInviteUsable, nextInviteState } from './invite.rules.js';

export interface InviteRecord {
  code_id: string;
  organization_id: string;
  code: string;
  role: Role;
  max_uses: number;
  used_count: number;
  status: 'active' | 'used' | 'revoked';
}

function generateCode() {
  return crypto.randomBytes(5).toString('hex');
}

export async function createInviteCode({
  organizationId,
  role,
  createdBy,
  maxUses = 1,
}: {
  organizationId: string;
  role: Role;
  createdBy?: string;
  maxUses?: number;
}): Promise<InviteRecord> {
  const code = generateCode();
  const [row] = await db
    .insert(orgInviteCodes)
    .values({
      organization_id: organizationId,
      code,
      role,
      created_by: createdBy ?? null,
      max_uses: maxUses,
    })
    .returning();

  return row as unknown as InviteRecord;
}

export async function revokeInviteCode({
  code,
  revokedBy,
}: {
  code: string;
  revokedBy?: string;
}) {
  await db
    .update(orgInviteCodes)
    .set({
      status: 'revoked',
      revoked_at: new Date(),
      revoked_by: revokedBy ?? null,
    })
    .where(eq(orgInviteCodes.code, code));
}

export async function redeemInviteCode({
  code,
  userPayload,
}: {
  code: string;
  userPayload: {
    email: string;
    name: string;
    sso_id: string;
  };
}) {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(orgInviteCodes)
      .where(eq(orgInviteCodes.code, code))
      .for('update');

    if (!invite) {
      throw new Error('Invalid passcode');
    }
    if (invite.status !== 'active') {
      throw new Error(`Passcode ${invite.status}`);
    }
    if (invite.used_count >= invite.max_uses) {
      throw new Error('Passcode exhausted');
    }

    const [user] = await tx
      .insert(users)
      .values({
        email: userPayload.email,
        name: userPayload.name,
        role: invite.role as 'OrgAdmin' | 'OrgEmployee',
        sso_id: userPayload.sso_id,
        organization_id: invite.organization_id,
      })
      .onConflictDoUpdate({
        target: users.sso_id,
        set: {
          email: userPayload.email,
          name: userPayload.name,
          role: invite.role as 'OrgAdmin' | 'OrgEmployee',
          organization_id: invite.organization_id,
        },
      })
      .returning();

    const newUsedCount = invite.used_count + 1;
    const newStatus = newUsedCount >= invite.max_uses ? 'used' : invite.status;

    await tx
      .update(orgInviteCodes)
      .set({
        used_count: newUsedCount,
        status: newStatus,
        metadata: sql`jsonb_set(${orgInviteCodes.metadata}, '{last_user_id}', to_jsonb(${user.user_id}::text), true)`,
      })
      .where(eq(orgInviteCodes.code_id, invite.code_id));

    return { user: user as unknown as User, invite: invite as unknown as InviteRecord };
  });
}

export async function redeemInviteForLocalSignup({
  code,
  email,
  name,
  password,
}: {
  code: string;
  email: string;
  name: string;
  password: string;
}) {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(orgInviteCodes)
      .where(eq(orgInviteCodes.code, code))
      .for('update');

    assertInviteUsable(invite as unknown as InviteRecord);

    const [user] = await tx
      .insert(users)
      .values({
        email,
        name,
        role: invite.role as 'OrgAdmin' | 'OrgEmployee',
        organization_id: invite.organization_id,
        password,
      })
      .returning();

    const next = nextInviteState(invite as unknown as InviteRecord);
    await tx
      .update(orgInviteCodes)
      .set({
        used_count: next.used_count,
        status: next.status,
        metadata: sql`jsonb_set(${orgInviteCodes.metadata}, '{last_user_id}', to_jsonb(${user.user_id}::text), true)`,
      })
      .where(eq(orgInviteCodes.code_id, invite.code_id));

    return { user: user as unknown as User, invite: invite as unknown as InviteRecord };
  });
}

export async function getInviteCodesForOrg(organizationId: string): Promise<InviteRecord[]> {
  const rows = await db
    .select()
    .from(orgInviteCodes)
    .where(eq(orgInviteCodes.organization_id, organizationId))
    .orderBy(desc(orgInviteCodes.created_at));

  return rows as unknown as InviteRecord[];
}

export async function getInviteByCode(code: string): Promise<InviteRecord | undefined> {
  const [row] = await db
    .select()
    .from(orgInviteCodes)
    .where(eq(orgInviteCodes.code, code));

  return (row as unknown as InviteRecord) ?? undefined;
}
