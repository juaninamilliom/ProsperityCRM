import { describe, expect, it } from 'vitest';
import { createCompanySchema, updateCompanySchema } from './company.schema.js';

describe('createCompanySchema', () => {
  it('requires a name', () => {
    expect(createCompanySchema.safeParse({}).success).toBe(false);
  });

  it('defaults a new company to prospect', () => {
    const result = createCompanySchema.safeParse({ name: 'Northwind Robotics' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.relationship).toBe('prospect');
  });

  it('rejects a relationship outside the four states', () => {
    expect(createCompanySchema.safeParse({ name: 'X', relationship: 'lead' }).success).toBe(false);
  });

  it('normalises the LinkedIn URL rather than storing it as typed', () => {
    const result = createCompanySchema.safeParse({
      name: 'Northwind Robotics',
      linkedin_url: 'linkedin.com/company/Northwind-Robotics/about/',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.linkedin_url).toBe(
      'https://www.linkedin.com/company/northwind-robotics',
    );
  });

  it('allows a partial update', () => {
    expect(updateCompanySchema.safeParse({ relationship: 'client' }).success).toBe(true);
  });
});
