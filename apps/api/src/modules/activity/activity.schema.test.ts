import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createActivitySchema } from './activity.schema.js';

const base = { channel: 'li_message', direction: 'outbound', body: 'Followed up.' };

describe('createActivitySchema', () => {
  it('accepts an activity attached to a person', () => {
    expect(createActivitySchema.safeParse({ ...base, person_id: randomUUID() }).success).toBe(true);
  });

  it('accepts an activity attached only to a company', () => {
    expect(createActivitySchema.safeParse({ ...base, company_id: randomUUID() }).success).toBe(true);
  });

  it('rejects an activity attached to neither', () => {
    // The database has a check constraint for this; catching it in zod means a
    // 400 with a readable message instead of a 500 out of Postgres.
    const result = createActivitySchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0].message).toBe(
      'An activity must be attached to a person or a company',
    );
  });

  it('rejects a channel outside the seven', () => {
    expect(
      createActivitySchema.safeParse({ ...base, channel: 'carrier_pigeon', person_id: randomUUID() })
        .success,
    ).toBe(false);
  });

  it('defaults direction to outbound', () => {
    const result = createActivitySchema.safeParse({ channel: 'call', person_id: randomUUID() });
    expect(result.success && result.data.direction).toBe('outbound');
  });
});
