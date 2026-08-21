import { describe, expect, it } from 'vitest';
import { signupSchema } from './auth.schema.js';

const valid = {
  email: 'dana@example.com',
  password: 'hunter22',
  name: 'Dana Whitfield',
  invite_code: 'a1b2c3d4e5',
};

describe('signupSchema', () => {
  it('accepts a signup with an invite code', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it('requires an invite code', () => {
    const withoutCode = { ...valid };
    delete (withoutCode as Partial<typeof valid>).invite_code;
    expect(signupSchema.safeParse(withoutCode).success).toBe(false);
  });

  it('rejects an empty invite code', () => {
    expect(signupSchema.safeParse({ ...valid, invite_code: '' }).success).toBe(false);
  });

  it('ignores a role supplied by the client', () => {
    const parsed = signupSchema.parse({ ...valid, role: 'OrgAdmin' });
    expect(parsed).not.toHaveProperty('role');
  });

  it('ignores an organization_id supplied by the client', () => {
    const parsed = signupSchema.parse({ ...valid, organization_id: 'some-other-org' });
    expect(parsed).not.toHaveProperty('organization_id');
  });

  it('still enforces a minimum password length', () => {
    expect(signupSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });
});
