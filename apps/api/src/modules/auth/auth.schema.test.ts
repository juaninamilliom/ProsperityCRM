import { describe, expect, it } from 'vitest';
import {
  magicLinkRequestSchema,
  magicLinkVerifySchema,
  passkeyLoginOptionsSchema,
  passkeyLoginVerifySchema,
  signupSchema,
} from './auth.schema.js';

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

describe('magicLinkRequestSchema', () => {
  it('accepts valid email', () => {
    expect(magicLinkRequestSchema.safeParse({ email: 'user@prosperity.test' }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(magicLinkRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('magicLinkVerifySchema', () => {
  it('requires token string', () => {
    expect(magicLinkVerifySchema.safeParse({ token: 'abc123token' }).success).toBe(true);
    expect(magicLinkVerifySchema.safeParse({ token: '' }).success).toBe(false);
  });
});

describe('passkey schemas', () => {
  it('validates passkey login options schema', () => {
    expect(passkeyLoginOptionsSchema.safeParse({ email: 'test@example.com' }).success).toBe(true);
    expect(passkeyLoginOptionsSchema.safeParse({}).success).toBe(true);
  });

  it('validates passkey login verify schema', () => {
    expect(
      passkeyLoginVerifySchema.safeParse({
        response: { id: 'cred-123', rawId: 'raw-123' },
        challengeId: '00000000-0000-0000-0000-000000000000',
      }).success
    ).toBe(true);
  });
});
