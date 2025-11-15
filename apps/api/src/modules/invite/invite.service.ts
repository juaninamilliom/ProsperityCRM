import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Role } from '../../common/types.js';
import { query } from '../../utils/sql.js';
import { withTransaction } from '../../utils/transaction.js';
import type { User } from '../../types.js';

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
}) {
  const code = generateCode();
  const result = await query<InviteRecord>(
    `insert into org_invite_codes (organization_id, code, role, created_by, max_uses)
     values ($1,$2,$3,$4,$5)
     returning *`,
    [organizationId, code, role, createdBy ?? null, maxUses]
  );
  return result.rows[0];
}

export async function revokeInviteCode({ code, revokedBy }: { code: string; revokedBy?: string }) {
  await query(
    `update org_invite_codes
     set status = 'revoked', revoked_at = now(), revoked_by = $2
     where code = $1`,
    [code, revokedBy ?? null]
  );
}

async function fetchInviteForUpdate(client: PoolClient, code: string) {
  const result = await client.query<InviteRecord>(`select * from org_invite_codes where code = $1 for update`, [code]);
  return result.rows[0];
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
  return withTransaction(async (client) => {
    const invite = await fetchInviteForUpdate(client, code);
    if (!invite) {
      throw new Error('Invalid passcode');
    }
    if (invite.status !== 'active') {
      throw new Error(`Passcode ${invite.status}`);
    }
    if (invite.used_count >= invite.max_uses) {
      throw new Error('Passcode exhausted');
    }

    const userResult = await client.query<User>(
      `insert into users (email, name, role, sso_id, organization_id)
       values ($1,$2,$3,$4,$5)
       on conflict (sso_id) do update set email = excluded.email,
                                         name = excluded.name,
                                         role = excluded.role,
                                         organization_id = excluded.organization_id
       returning *`,
      [userPayload.email, userPayload.name, invite.role, userPayload.sso_id, invite.organization_id]
    );
    const user = userResult.rows[0];

    const newUsedCount = invite.used_count + 1;
    const newStatus = newUsedCount >= invite.max_uses ? 'used' : invite.status;

    await client.query(
      `update org_invite_codes
       set used_count = $1, status = $2, metadata = jsonb_set(metadata, '{last_user_id}', to_jsonb($3::text), true)
       where code_id = $4`,
      [newUsedCount, newStatus, user.user_id, invite.code_id]
    );

    return { user, invite };
  });
}

export async function getInviteCodesForOrg(organizationId: string) {
  const result = await query<InviteRecord>(
    `select * from org_invite_codes where organization_id = $1 order by created_at desc`,
    [organizationId]
  );
  return result.rows;
}

export async function getInviteByCode(code: string) {
  const result = await query<InviteRecord>(`select * from org_invite_codes where code = $1`, [code]);
  return result.rows[0];
}
