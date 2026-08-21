import { describe, expect, it } from 'vitest';
import { createEntrySchema } from './entry.schema.js';

describe('createEntrySchema', () => {
  it('requires mandatory fields', () => {
    expect(createEntrySchema.safeParse({}).success).toBe(false);
  });

  it('accepts an entry with no requisition', () => {
    const result = createEntrySchema.safeParse({
      person_id: 'p1',
      company_id: 'c1',
      current_status_id: 'status-1',
      recruiter_id: 'user-1',
      flags: ['Hot Prospect'],
      notes: 'Team lead referral',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an entry against a requisition', () => {
    const result = createEntrySchema.safeParse({
      person_id: 'p1',
      company_id: 'c1',
      job_id: '550e8400-e29b-41d4-a716-446655440000',
      current_status_id: 'status-1',
      recruiter_id: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('does not carry a name, which belongs to the person', () => {
    const result = createEntrySchema.safeParse({
      person_id: 'p1',
      company_id: 'c1',
      current_status_id: 'status-1',
      recruiter_id: 'user-1',
      full_name: 'Ada Lovelace',
    });
    expect(result.success).toBe(true);
    expect(result.success && 'full_name' in result.data).toBe(false);
  });
});
