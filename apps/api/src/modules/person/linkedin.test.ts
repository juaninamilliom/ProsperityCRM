import { describe, expect, it } from 'vitest';
import { normalizeLinkedInUrl } from './linkedin.js';

describe('normalizeLinkedInUrl', () => {
  it('returns null for empty input', () => {
    expect(normalizeLinkedInUrl(null)).toBeNull();
    expect(normalizeLinkedInUrl(undefined)).toBeNull();
    expect(normalizeLinkedInUrl('   ')).toBeNull();
  });

  it('collapses the spellings LinkedIn serves for one profile', () => {
    const canonical = 'https://www.linkedin.com/in/jane-doe-8a72b1';
    for (const variant of [
      'https://www.linkedin.com/in/jane-doe-8a72b1',
      'https://www.linkedin.com/in/jane-doe-8a72b1/',
      'http://www.linkedin.com/in/jane-doe-8a72b1',
      'https://linkedin.com/in/jane-doe-8a72b1',
      'https://m.linkedin.com/in/jane-doe-8a72b1',
      'https://uk.linkedin.com/in/jane-doe-8a72b1',
      'https://www.linkedin.com/in/jane-doe-8a72b1?originalSubdomain=uk',
      'https://www.linkedin.com/in/jane-doe-8a72b1/?miniProfileUrn=urn%3Ali%3A123',
      '  https://www.linkedin.com/in/Jane-Doe-8a72b1  ',
      'www.linkedin.com/in/jane-doe-8a72b1',
      'linkedin.com/in/jane-doe-8a72b1',
    ]) {
      expect(normalizeLinkedInUrl(variant)).toBe(canonical);
    }
  });

  it('keeps company pages distinct from profiles', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/company/acme/about/')).toBe(
      'https://www.linkedin.com/company/acme',
    );
  });

  it('preserves percent-encoded non-ASCII slugs', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/jos%C3%A9-p%C3%A9rez/')).toBe(
      'https://www.linkedin.com/in/jos%C3%A9-p%C3%A9rez',
    );
  });

  it('returns null for a URL that is not a LinkedIn profile or company', () => {
    expect(normalizeLinkedInUrl('https://example.com/in/jane')).toBeNull();
    expect(normalizeLinkedInUrl('https://www.linkedin.com/feed/')).toBeNull();
    expect(normalizeLinkedInUrl('not a url at all')).toBeNull();
  });
});
