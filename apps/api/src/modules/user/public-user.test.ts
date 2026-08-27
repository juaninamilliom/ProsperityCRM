import { describe, expect, it } from 'vitest';
import { toPublicUser } from './public-user.js';

const row = {
  user_id: 'u1',
  email: 'ana@example.com',
  name: 'Ana',
  role: 'OrgAdmin' as const,
  sso_id: null,
  password: 'hunter2',
  organization_id: 'o1',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('toPublicUser', () => {
  it('drops the password and keeps every other field', () => {
    const pub = toPublicUser(row);
    expect(pub).not.toHaveProperty('password');
    // toEqual treats an undefined property as absent, so this asserts every
    // other field survived without needing a second destructure.
    expect(pub).toEqual({ ...row, password: undefined });
  });

  it('leaves a user that never had a password untouched', () => {
    const sso = { ...row, password: undefined };
    delete (sso as { password?: string }).password;
    expect(toPublicUser(sso)).toEqual(sso);
  });

  it('does not mutate the row it was given', () => {
    toPublicUser(row);
    expect(row.password).toBe('hunter2');
  });
});
