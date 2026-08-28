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
      document.head.innerHTML = '';
    });

    it('extracts candidate details instantly from Schema.org JSON-LD in HTML head', () => {
      document.head.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Person",
          "name": "Andrew Ng",
          "jobTitle": ["Managing General Partner", "Founder"],
          "worksFor": [
            {
              "@type": "Organization",
              "name": "AI Fund"
            }
          ],
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Palo Alto",
            "addressRegion": "California",
            "addressCountry": "US"
          }
        }
        </script>
      `;

      const profile = extractLinkedInProfile();
      expect(profile).not.toBeNull();
      expect(profile?.full_name).toBe('Andrew Ng');
      expect(profile?.current_title).toBe('Managing General Partner');
      expect(profile?.current_company).toBe('AI Fund');
      expect(profile?.location).toBe('Palo Alto, California, US');
    });

    it('extracts position entities from Voyager JSON code blocks', () => {
      document.body.innerHTML = `
        <main>
          <h1>Satya Nadella</h1>
          <code id="bpr-guid-12345">{
            "included": [
              {
                "$type": "com.linkedin.voyager.dash.identity.profile.Position",
                "title": "Chairman and CEO",
                "companyName": "Microsoft",
                "locationName": "Redmond, Washington, United States"
              }
            ]
          }</code>
        </main>
      `;

      const profile = extractLinkedInProfile();
      expect(profile?.full_name).toBe('Satya Nadella');
      expect(profile?.current_title).toBe('Chairman and CEO');
      expect(profile?.current_company).toBe('Microsoft');
      expect(profile?.location).toBe('Redmond, Washington, United States');
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

    it('prioritizes structured Experience section for most recent title and company', () => {
      document.body.innerHTML = `
        <main>
          <h1>Andrew Ng</h1>
          <div class="text-body-medium">Founder of DeepLearning.AI; Managing General Partner at AI Fund; Co-Chairman & Co-Founder at Coursera</div>
          <div id="experience"></div>
          <div class="pvs-list__outer-container">
            <ul>
              <li class="artdeco-list__item">
                <div class="display-flex">
                  <span class="t-bold"><span aria-hidden="true">Managing General Partner</span></span>
                  <span class="t-normal"><span aria-hidden="true">AI Fund · Full-time</span></span>
                </div>
              </li>
            </ul>
          </div>
        </main>
      `;

      const profile = extractLinkedInProfile();
      expect(profile?.full_name).toBe('Andrew Ng');
      expect(profile?.current_title).toBe('Managing General Partner');
      expect(profile?.current_company).toBe('AI Fund');
    });

    it('handles nested grouped experiences with multiple positions at one company', () => {
      document.body.innerHTML = `
        <main>
          <h1>Elena Rostova</h1>
          <div class="text-body-medium">Tech Leader & Advisor</div>
          <section id="experience">
            <ul>
              <li class="artdeco-list__item">
                <div class="display-flex">
                  <span class="t-bold"><span aria-hidden="true">Google</span></span>
                </div>
                <div class="pvs-entity__sub-components">
                  <ul class="pvs-list">
                    <li>
                      <span class="t-bold"><span aria-hidden="true">Senior Staff Software Engineer</span></span>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
          </section>
        </main>
      `;

      const profile = extractLinkedInProfile();
      expect(profile?.full_name).toBe('Elena Rostova');
      expect(profile?.current_title).toBe('Senior Staff Software Engineer');
      expect(profile?.current_company).toBe('Google');
    });
  });
});
