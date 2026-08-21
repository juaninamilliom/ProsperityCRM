import type { Role } from '../../common/types.js';

export interface UsableInvite {
  code_id: string;
  organization_id: string;
  role: Role;
  max_uses: number;
  used_count: number;
  status: 'active' | 'used' | 'revoked';
}

export type InviteRejection = 'not_found' | 'revoked' | 'exhausted';

export class InviteError extends Error {
  constructor(public readonly reason: InviteRejection) {
    super(MESSAGES[reason]);
    this.name = 'InviteError';
  }
}

const MESSAGES: Record<InviteRejection, string> = {
  not_found: 'That invite code is not valid.',
  revoked: 'That invite code has been revoked.',
  exhausted: 'That invite code has already been used.',
};

/** Whether a code may still be redeemed. Extracted from the redeem transaction
 *  so the rules can be tested without a database. */
export function checkInvite(invite: UsableInvite | undefined | null): InviteRejection | null {
  if (!invite) return 'not_found';
  if (invite.status === 'revoked') return 'revoked';
  if (invite.status === 'used') return 'exhausted';
  if (invite.used_count >= invite.max_uses) return 'exhausted';
  return null;
}

export function assertInviteUsable(invite: UsableInvite | undefined | null): asserts invite is UsableInvite {
  const rejection = checkInvite(invite);
  if (rejection) throw new InviteError(rejection);
}

/** A code is spent when this redemption takes it to its limit. */
export function nextInviteState(invite: UsableInvite): { used_count: number; status: 'active' | 'used' } {
  const used_count = invite.used_count + 1;
  return { used_count, status: used_count >= invite.max_uses ? 'used' : 'active' };
}
