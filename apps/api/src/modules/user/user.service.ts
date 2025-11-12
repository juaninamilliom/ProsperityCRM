import type { QueryResult } from 'pg';
import type { User } from '../../types';
import { query } from '../../utils/sql';
import type { UpsertUserInput } from './user.schema';

export async function upsertUser(input: UpsertUserInput): Promise<User> {
  const result: QueryResult<User> = await query(
    `insert into users (email, name, role, sso_id, organization_id)
     values ($1, $2, $3, $4, $5)
     on conflict (sso_id) do update set email = excluded.email,
                                      name = excluded.name,
                                      role = excluded.role,
                                      organization_id = excluded.organization_id
     returning *`,
    [input.email, input.name, input.role, input.sso_id, input.organization_id]
  );
  return result.rows[0];
}

export async function getUserBySsoId(ssoId: string) {
  const result = await query<User>(`select * from users where sso_id = $1`, [ssoId]);
  return result.rows[0];
}

export async function getUserById(userId: string) {
  const result = await query<User>(`select * from users where user_id = $1`, [userId]);
  return result.rows[0];
}

export async function updateUserRoleAndOrg({
  userId,
  organizationId,
  role,
}: {
  userId: string;
  organizationId: string;
  role: 'OrgAdmin' | 'OrgEmployee';
}) {
  const result = await query<User>(
    `update users set organization_id = $1, role = $2 where user_id = $3 returning *`,
    [organizationId, role, userId]
  );
  return result.rows[0];
}
