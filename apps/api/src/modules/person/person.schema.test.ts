import { describe, expect, it } from 'vitest';
import { createPersonSchema } from './person.schema.js';

describe('createPersonSchema', () => {
  it('requires a name', () => {
    expect(createPersonSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a person with no email, which is the LinkedIn case', () => {
    const result = createPersonSchema.safeParse({
      full_name: 'Nadia Brooks',
      linkedin_url: 'https://www.linkedin.com/in/nadiabrooks/',
      headline: 'VP Engineering at Meridian',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBeNull();
  });

  it('normalises the LinkedIn URL', () => {
    const result = createPersonSchema.safeParse({
      full_name: 'Nadia Brooks',
      linkedin_url: 'uk.linkedin.com/in/NadiaBrooks?originalSubdomain=uk',
    });
    expect(result.success && result.data.linkedin_url).toBe(
      'https://www.linkedin.com/in/nadiabrooks',
    );
  });

  it('rejects a malformed email but allows its absence', () => {
    expect(createPersonSchema.safeParse({ full_name: 'X', email: 'nope' }).success).toBe(false);
    expect(createPersonSchema.safeParse({ full_name: 'X' }).success).toBe(true);
  });

  it('defaults source to manual', () => {
    const result = createPersonSchema.safeParse({ full_name: 'X' });
    expect(result.success && result.data.source).toBe('manual');
  });
});
