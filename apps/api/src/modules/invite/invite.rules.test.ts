import { describe, expect, it } from 'vitest';
import { checkInvite, nextInviteState, type UsableInvite } from './invite.rules.js';

const base: UsableInvite = {
  code_id: 'c1',
  organization_id: 'o1',
  role: 'OrgEmployee',
  max_uses: 1,
  used_count: 0,
  status: 'active',
};

describe('checkInvite', () => {
  it('accepts a fresh active code', () => {
    expect(checkInvite(base)).toBeNull();
  });

  it('rejects a missing code', () => {
    expect(checkInvite(undefined)).toBe('not_found');
    expect(checkInvite(null)).toBe('not_found');
  });

  it('rejects a revoked code', () => {
    expect(checkInvite({ ...base, status: 'revoked' })).toBe('revoked');
  });

  it('rejects a code already marked used', () => {
    expect(checkInvite({ ...base, status: 'used' })).toBe('exhausted');
  });

  it('rejects a code at its use limit even if still marked active', () => {
    expect(checkInvite({ ...base, used_count: 1, max_uses: 1 })).toBe('exhausted');
  });

  it('accepts a multi-use code with uses remaining', () => {
    expect(checkInvite({ ...base, max_uses: 5, used_count: 2 })).toBeNull();
  });
});

describe('nextInviteState', () => {
  it('marks a single-use code spent', () => {
    expect(nextInviteState(base)).toEqual({ used_count: 1, status: 'used' });
  });

  it('leaves a multi-use code active while uses remain', () => {
    expect(nextInviteState({ ...base, max_uses: 3, used_count: 0 })).toEqual({
      used_count: 1,
      status: 'active',
    });
  });

  it('marks a multi-use code spent on its final use', () => {
    expect(nextInviteState({ ...base, max_uses: 3, used_count: 2 })).toEqual({
      used_count: 3,
      status: 'used',
    });
  });
});
