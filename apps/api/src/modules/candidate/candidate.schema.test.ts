import { describe, expect, it } from 'vitest';
import { createCandidateSchema } from './candidate.schema.js';

describe('createCandidateSchema', () => {
  it('requires mandatory fields', () => {
    const result = createCandidateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts valid payloads', () => {
    const result = createCandidateSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '555-0101',
      target_agency_id: 'agency-1',
      current_status_id: 'status-1',
      recruiter_id: 'user-1',
      job_requisition_id: '550e8400-e29b-41d4-a716-446655440000',
      flags: ['Hot Prospect'],
      notes: 'Team lead referral',
    });

    expect(result.success).toBe(true);
  });
});
