import { beforeEach, describe, expect, it } from 'vitest';
import { extractLinkedInProfile, isLinkedInProfileUrl, normalizeLinkedInUrl } from './linkedin-parser';

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

  it('detects profile URLs across standard, sales navigator, and recruiter formats', () => {
    expect(isLinkedInProfileUrl('https://www.linkedin.com/in/juan-guardado')).toBe(true);
    expect(isLinkedInProfileUrl('https://www.linkedin.com/sales/lead/ACwAABC123')).toBe(true);
    expect(isLinkedInProfileUrl('https://www.linkedin.com/talent/profile/AEMAAXYZ')).toBe(true);
    expect(isLinkedInProfileUrl('https://www.linkedin.com/feed/')).toBe(false);
  });

  describe('extractLinkedInProfile DOM & Hydration Parser', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('extracts name, headline, title, and company from top-card and headline pattern', () => {
      document.body.innerHTML = `
        <main>
          <section class="artdeco-card">
            <div data-view-name="profile-top-card">
              <h1 class="text-heading-xlarge">Sarah Jenkins</h1>
              <div class="text-body-medium break-words">Principal Engineer at Stripe | Ex-Apple</div>
              <span class="text-body-small inline t-black--light break-words">San Francisco, California</span>
            </div>
            <div class="pv-text-details__right-panel">
              <ul class="pv-text-details__right-panel">
                <li><button><span>Stripe</span></button></li>
              </ul>
            </div>
          </section>
        </main>
      `;

      const profile = extractLinkedInProfile();
      expect(profile).not.toBeNull();
      expect(profile?.full_name).toBe('Sarah Jenkins');
      expect(profile?.headline).toBe('Principal Engineer at Stripe | Ex-Apple');
      expect(profile?.current_title).toBe('Principal Engineer');
      expect(profile?.current_company).toBe('Stripe');
      expect(profile?.location).toBe('San Francisco, California');
    });

    it('extracts contact info (email and phone) from about section and mailto links', () => {
      document.body.innerHTML = `
        <main>
          <h1>Alex Mercer</h1>
          <div class="text-body-medium">Founder & CEO @ TechCorp</div>
          <div id="about">
            <p>Reach me directly at alex@techcorp.io or call (415) 555-0199 for inquiries.</p>
          </div>
        </main>
      `;

      const profile = extractLinkedInProfile();
      expect(profile?.full_name).toBe('Alex Mercer');
      expect(profile?.current_title).toBe('Founder & CEO');
      expect(profile?.current_company).toBe('TechCorp');
      expect(profile?.email).toBe('alex@techcorp.io');
      expect(profile?.phone).toBe('(415) 555-0199');
    });

    it('extracts experience, title, and company from DOM structure', () => {
      document.body.innerHTML = `
        <main>
          <h1>Elena Rostova</h1>
          <div class="text-body-medium">Head of Growth at Fintech Co</div>
          <div id="experience"></div>
          <ul>
            <li>
              <div class="display-flex">
                <span class="t-bold"><span aria-hidden="true">Head of Growth</span></span>
                <span class="t-normal"><span aria-hidden="true">Fintech Co · Full-time</span></span>
              </div>
            </li>
          </ul>
        </main>
      `;

      const profile = extractLinkedInProfile();
      expect(profile?.full_name).toBe('Elena Rostova');
      expect(profile?.headline).toBe('Head of Growth at Fintech Co');
      expect(profile?.current_title).toBe('Head of Growth');
      expect(profile?.current_company).toBe('Fintech Co');
    });
  });
});
