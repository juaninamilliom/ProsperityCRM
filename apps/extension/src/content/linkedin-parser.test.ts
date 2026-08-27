import { describe, expect, it } from 'vitest';
import { normalizeLinkedInUrl } from './linkedin-parser';

describe('LinkedIn Parser Utilities', () => {
  it('normalizes various LinkedIn URL formats to canonical profile URLs', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/sarah-jenkins-12345/')).toBe(
      'https://www.linkedin.com/in/sarah-jenkins-12345'
    );
    expect(normalizeLinkedInUrl('http://uk.linkedin.com/in/JOHN-DOE?trackingId=abc&ref=xyz')).toBe(
      'https://www.linkedin.com/in/john-doe'
    );
    expect(normalizeLinkedInUrl('linkedin.com/in/juan-the-man/')).toBe(
      'https://www.linkedin.com/in/juan-the-man'
    );
  });

  it('handles company URLs', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/company/stripe/about/')).toBe(
      'https://www.linkedin.com/company/stripe'
    );
  });

  it('gracefully handles non-standard URLs', () => {
    expect(normalizeLinkedInUrl('https://example.com/profile')).toBe('https://example.com/profile');
  });
});
