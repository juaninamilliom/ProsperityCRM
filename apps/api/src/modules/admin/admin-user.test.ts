import { describe, expect, it } from 'vitest';
import { adminCreateUserSchema, createUserSchema } from '../user/user.schema.js';

describe('createUserSchema (Direct OrgAdmin user creation)', () => {
  it('accepts a valid user payload', () => {
    const parsed = createUserSchema.safeParse({
      email: 'recruiter@company.com',
      name: 'Alex Recruiter',
      password: 'strongpassword123',
      role: 'OrgEmployee',
    });
    expect(parsed.success).toBe(true);
  });

  it('defaults role to OrgEmployee if omitted', () => {
    const parsed = createUserSchema.parse({
      email: 'recruiter@company.com',
      name: 'Alex Recruiter',
      password: 'strongpassword123',
    });
    expect(parsed.role).toBe('OrgEmployee');
  });

  it('rejects invalid email', () => {
    const parsed = createUserSchema.safeParse({
      email: 'invalid-email',
      name: 'Alex Recruiter',
      password: 'strongpassword123',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects short passwords', () => {
    const parsed = createUserSchema.safeParse({
      email: 'recruiter@company.com',
      name: 'Alex Recruiter',
      password: '123',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('adminCreateUserSchema (Direct RootAdmin user creation)', () => {
  it('accepts a valid user payload with optional organization_id', () => {
    const parsed = adminCreateUserSchema.safeParse({
      email: 'admin@company.com',
      name: 'Admin User',
      password: 'adminpassword123',
      role: 'OrgAdmin',
      organization_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.organization_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(parsed.data.role).toBe('OrgAdmin');
    }
  });

  it('allows omitting organization_id for root admin fallback', () => {
    const parsed = adminCreateUserSchema.safeParse({
      email: 'solo@company.com',
      name: 'Solo Recruiter',
      password: 'solopassword123',
    });
    expect(parsed.success).toBe(true);
  });
});
