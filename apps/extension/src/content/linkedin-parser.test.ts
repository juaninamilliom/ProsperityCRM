import { beforeEach, describe, expect, it } from 'vitest';
import {
  decomposeHeadline,
  extractExperience,
  extractLinkedInProfile,
  extractProfile,
  extractVoyagerPosition,
  isLinkedInProfileUrl,
  normalizeLinkedInUrl,
  parseContactInfoFromHtml,
  parseContactInfoModal,
  profileSlugFromUrl,
} from './linkedin-parser';

/* ─── Fixtures ────────────────────────────────────────────────────────────────
   These mirror the logged-in LinkedIn profile DOM (2024-2025): hashed class
   names on layout wrappers, utility classes (t-bold, t-14, text-body-*) on
   text, every visible string duplicated in a `visually-hidden` span, and the
   current company exposed only through a button's aria-label. */

function topCard(opts: {
  name?: string;
  headline?: string;
  location?: string;
  company?: string | null;
  education?: string | null;
}) {
  const {
    name = 'Andrew Ng',
    headline = 'Founder of DeepLearning.AI; Managing General Partner of AI Fund; Exec Chairman of LandingAI',
    location = 'Palo Alto, California, United States',
    company = 'DeepLearning.AI',
    education = 'Stanford University',
  } = opts;
  return `
    <section class="artdeco-card pv-top-card" data-member-id="123">
      <div class="ph5 pb5">
        <div class="display-flex mt2">
          <div class="pv-top-card__photo-wrapper">
            <img class="pv-top-card-profile-picture__image--show evi-image" alt="${name}" src="https://media.licdn.com/dms/image/v2/abc/profile-displayphoto-shrink_200_200/0?e=1" />
          </div>
        </div>
        <div class="mt2 relative">
          <div>
            <div class="display-flex align-items-center">
              <a href="/in/andrewyng/overlay/about-this-profile/"><h1 class="XhFkQzPq inline t-24 v-align-middle break-words">${name}</h1></a>
            </div>
            <div class="text-body-medium break-words">${headline}</div>
          </div>
          <ul class="AbCdEfGh">
            ${
              company
                ? `<li class="GhIjKl"><button aria-label="Current company: ${company}. Click to skip to experience card" class="MnOpQr"><div class="inline-show-more-text"><span aria-hidden="true">${company}</span><span class="visually-hidden">${company}</span></div></button></li>`
                : ''
            }
            ${
              education
                ? `<li class="GhIjKl"><button aria-label="Education: ${education}. Click to skip to education card" class="MnOpQr"><div class="inline-show-more-text"><span aria-hidden="true">${education}</span><span class="visually-hidden">${education}</span></div></button></li>`
                : ''
            }
          </ul>
          <div class="mt2">
            <span class="text-body-small inline t-black--light break-words">${location}</span>
            <span class="text-body-small inline"><a id="top-card-text-details-contact-info" href="/in/andrewyng/overlay/contact-info/">Contact info</a></span>
          </div>
          <ul class="pv-top-card--list pv-top-card--list-bullet"><li class="text-body-small"><span class="t-bold">500+</span> connections</li></ul>
        </div>
      </div>
    </section>`;
}

function line(text: string, cls = 't-14 t-normal') {
  return `<span class="${cls}"><span aria-hidden="true">${text}</span><span class="visually-hidden">${text}</span></span>`;
}

function bold(text: string) {
  return `<div class="display-flex align-items-center mr1 hoverable-link-text t-bold"><span aria-hidden="true">${text}</span><span class="visually-hidden">${text}</span></div>`;
}

/** A single role. LinkedIn still renders a `pvs-entity__sub-components` block
 *  for the description, skills line and media - it is not a sign of grouping. */
function singleRole(opts: { title: string; company: string; dates: string; withSubComponents?: boolean }) {
  return `
    <li class="artdeco-list__item pvs-list__item--line-separated">
      <div data-view-name="profile-component-entity">
        <div class="display-flex flex-column full-width align-self-center">
          <div class="display-flex flex-row justify-space-between">
            <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/${opts.company.toLowerCase().replace(/[^a-z]/g, '')}/">
              <div class="display-flex flex-wrap align-items-center full-height">${bold(opts.title)}</div>
              ${line(`${opts.company} · Full-time`)}
              ${line(opts.dates, 't-14 t-normal t-black--light')}
              ${line('Palo Alto, California, United States', 't-14 t-normal t-black--light')}
            </a>
          </div>
          ${
            opts.withSubComponents !== false
              ? `<div class="pvs-entity__sub-components">
                  <ul>
                    <li class="pvs-list__item--with-top-padding">
                      <div class="pvs-list__outer-container"><ul><li><div class="display-flex"><div class="inline-show-more-text"><span aria-hidden="true">${opts.company} is a company that does things. Grew the team from 4 to 40.</span></div></div></li></ul></div>
                    </li>
                    <li>
                      <div class="display-flex align-items-center t-14 t-normal t-black"><span aria-hidden="true"><strong>Machine Learning, Deep Learning and +3 skills</strong></span></div>
                    </li>
                  </ul>
                </div>`
              : ''
          }
        </div>
      </div>
    </li>`;
}

/** Several roles at one employer: the header names the company, the nested
 *  entities name the roles. Only the nested entities carry date ranges. */
function groupedRoles(opts: { company: string; roles: { title: string; dates: string }[] }) {
  return `
    <li class="artdeco-list__item pvs-list__item--line-separated">
      <div data-view-name="profile-component-entity">
        <div class="display-flex flex-column full-width">
          <div class="display-flex flex-row justify-space-between">
            <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/${opts.company.toLowerCase()}/">
              <div class="display-flex flex-wrap align-items-center full-height">${bold(opts.company)}</div>
              ${line('Full-time · 8 yrs 3 mos')}
              ${line('Mountain View, California, United States', 't-14 t-normal t-black--light')}
            </a>
          </div>
          <div class="pvs-entity__sub-components">
            <ul>
              ${opts.roles
                .map(
                  (r) => `<li class="pvs-list__item--with-top-padding">
                    <div data-view-name="profile-component-entity">
                      <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/in/x/details/experience/urn:li:fsd_profilePosition:(ACoAAA,1)/">
                        <div class="display-flex flex-wrap align-items-center full-height">${bold(r.title)}</div>
                        ${line(r.dates, 't-14 t-normal t-black--light')}
                      </a>
                    </div>
                  </li>`,
                )
                .join('')}
            </ul>
          </div>
        </div>
      </div>
    </li>`;
}

function experienceSection(items: string) {
  return `
    <section class="artdeco-card pv-profile-card break-words mt2" data-view-name="profile-card">
      <div id="experience" class="pv-profile-card__anchor"></div>
      <div class="ph5 pv3"><h2 class="pvs-header__title text-heading-large"><span aria-hidden="true">Experience</span></h2></div>
      <div class="pvs-list__outer-container">
        <ul class="ZzYyXx">${items}</ul>
      </div>
      <div class="pvs-list__footer-wrapper"><a href="/in/andrewyng/details/experience/">Show all 6 experiences</a></div>
    </section>`;
}

function setUrl(href: string) {
  window.history.replaceState({}, '', href);
}

describe('URL helpers', () => {
  it('normalizes various LinkedIn URL formats to canonical profile URLs', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/sarah-jenkins-12345/')).toBe(
      'https://www.linkedin.com/in/sarah-jenkins-12345',
    );
    expect(normalizeLinkedInUrl('http://uk.linkedin.com/in/JOHN-DOE?trackingId=abc&ref=xyz')).toBe(
      'https://www.linkedin.com/in/john-doe',
    );
    expect(normalizeLinkedInUrl('linkedin.com/in/juan-the-man/')).toBe('https://www.linkedin.com/in/juan-the-man');
  });

  it('strips overlay sub-routes so the contact-info modal is still the same profile', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/andrewyng/overlay/contact-info/')).toBe(
      'https://www.linkedin.com/in/andrewyng',
    );
    expect(profileSlugFromUrl('https://www.linkedin.com/in/andrewyng/overlay/contact-info/')).toBe('andrewyng');
  });

  it('detects profile URLs across standard, sales navigator, and recruiter formats', () => {
    expect(isLinkedInProfileUrl('https://www.linkedin.com/in/juan-guardado')).toBe(true);
    expect(isLinkedInProfileUrl('https://www.linkedin.com/sales/lead/ACwAABC123')).toBe(true);
    expect(isLinkedInProfileUrl('https://www.linkedin.com/talent/profile/AEMAAXYZ')).toBe(true);
    expect(isLinkedInProfileUrl('https://www.linkedin.com/feed/')).toBe(false);
  });
});

describe('decomposeHeadline', () => {
  it('splits "title at company" and "title @ company"', () => {
    expect(decomposeHeadline('Senior Software Engineer at Stripe')).toEqual({ title: 'Senior Software Engineer', company: 'Stripe' });
    expect(decomposeHeadline('CTO & Co-founder @ Beep | ex-Google')).toEqual({ title: 'CTO & Co-founder', company: 'Beep' });
  });

  it('handles "Founder of X; ..." lists', () => {
    expect(decomposeHeadline('Founder of DeepLearning.AI; Managing General Partner of AI Fund')).toEqual({
      title: 'Founder',
      company: 'DeepLearning.AI',
    });
  });

  it('does not invent a title from a slogan headline', () => {
    expect(decomposeHeadline('Helping teams ship faster 🚀')).toEqual({ title: '', company: '' });
    expect(decomposeHeadline('Open to work')).toEqual({ title: '', company: '' });
  });

  it('keeps a bare title when the headline is just a title', () => {
    expect(decomposeHeadline('Staff Software Engineer')).toEqual({ title: 'Staff Software Engineer', company: '' });
    expect(decomposeHeadline('Product Designer | UX | Figma')).toEqual({ title: 'Product Designer', company: '' });
  });
});

describe('extractExperience', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads title and company from a single role even when it has sub-components', () => {
    document.body.innerHTML = experienceSection(
      singleRole({ title: 'Founder', company: 'DeepLearning.AI', dates: 'Jun 2017 - Present · 8 yrs 3 mos' }) +
        singleRole({ title: 'Managing General Partner', company: 'AI Fund', dates: 'Jan 2018 - Present · 7 yrs 8 mos' }),
    );
    expect(extractExperience(document)).toEqual({ title: 'Founder', company: 'DeepLearning.AI', current: true });
  });

  it('reads the nested role for grouped positions at one employer', () => {
    document.body.innerHTML = experienceSection(
      groupedRoles({
        company: 'Google',
        roles: [
          { title: 'Senior Staff Software Engineer', dates: 'Jan 2020 - Present · 5 yrs 8 mos' },
          { title: 'Staff Software Engineer', dates: 'Mar 2017 - Jan 2020 · 2 yrs 11 mos' },
        ],
      }),
    );
    expect(extractExperience(document)).toEqual({ title: 'Senior Staff Software Engineer', company: 'Google', current: true });
  });

  it('prefers an ongoing role over an ended one listed first', () => {
    document.body.innerHTML = experienceSection(
      singleRole({ title: 'Advisor', company: 'Old Startup', dates: 'Jan 2022 - Jun 2024 · 2 yrs 6 mos' }) +
        singleRole({ title: 'VP Engineering', company: 'Meridian', dates: 'Feb 2019 - Present · 6 yrs 7 mos' }),
    );
    expect(extractExperience(document)).toEqual({ title: 'VP Engineering', company: 'Meridian', current: true });
  });

  it('falls back to the most recent role and flags it when nothing is ongoing', () => {
    document.body.innerHTML = experienceSection(
      singleRole({ title: 'Data Scientist', company: 'Acme', dates: 'Jan 2020 - Dec 2024 · 5 yrs' }),
    );
    expect(extractExperience(document)).toEqual({ title: 'Data Scientist', company: 'Acme', current: false });
  });

  it('returns null without an experience section', () => {
    document.body.innerHTML = '<main><h1>Nobody</h1></main>';
    expect(extractExperience(document)).toBeNull();
  });
});

describe('extractVoyagerPosition', () => {
  function blob(id: string, included: unknown[]) {
    return `<code id="bpr-guid-${id}" style="display:none">${JSON.stringify({ included }).replace(/</g, '&lt;')}</code>`;
  }

  it('picks the ongoing position with the latest start for the current profile', () => {
    document.body.innerHTML = blob('1', [
      { $type: 'com.linkedin.voyager.dash.identity.profile.Profile', entityUrn: 'urn:li:fsd_profile:ACoAAAA1', publicIdentifier: 'andrewyng' },
      { $type: 'com.linkedin.voyager.dash.identity.profile.Position', entityUrn: 'urn:li:fsd_profilePosition:(ACoAAAA1,10)', title: 'Founder', companyName: 'DeepLearning.AI', dateRange: { start: { year: 2017, month: 6 } } },
      { $type: 'com.linkedin.voyager.dash.identity.profile.Position', entityUrn: 'urn:li:fsd_profilePosition:(ACoAAAA1,11)', title: 'Managing General Partner', companyName: 'AI Fund', dateRange: { start: { year: 2018, month: 1 } } },
      { $type: 'com.linkedin.voyager.dash.identity.profile.Position', entityUrn: 'urn:li:fsd_profilePosition:(ACoAAAA1,12)', title: 'Chief Scientist', companyName: 'Baidu', dateRange: { start: { year: 2014, month: 5 }, end: { year: 2017, month: 4 } } },
    ]);
    expect(extractVoyagerPosition(document, 'andrewyng')).toEqual({ title: 'Managing General Partner', company: 'AI Fund', current: true });
  });

  it('ignores blobs that belong to a previously viewed profile', () => {
    document.body.innerHTML = blob('1', [
      { $type: 'com.linkedin.voyager.dash.identity.profile.Profile', entityUrn: 'urn:li:fsd_profile:ACoAAAA9', publicIdentifier: 'someone-else' },
      { $type: 'com.linkedin.voyager.dash.identity.profile.Position', entityUrn: 'urn:li:fsd_profilePosition:(ACoAAAA9,1)', title: 'Chairman and CEO', companyName: 'Microsoft', dateRange: { start: { year: 2014, month: 2 } } },
    ]);
    expect(extractVoyagerPosition(document, 'andrewyng')).toBeNull();
  });

  it('accepts an unscoped legacy position blob when no profile entity is present', () => {
    document.body.innerHTML = blob('2', [
      { $type: 'com.linkedin.voyager.identity.profile.Position', title: 'Chairman and CEO', companyName: 'Microsoft', timePeriod: { startDate: { year: 2014, month: 2 } } },
    ]);
    expect(extractVoyagerPosition(document, 'satyanadella')).toEqual({ title: 'Chairman and CEO', company: 'Microsoft', current: true });
  });
});

describe('parseContactInfoModal', () => {
  it('reads email, phone and websites from the contact-info overlay', () => {
    document.body.innerHTML = `
      <div class="artdeco-modal-overlay">
        <div class="artdeco-modal" role="dialog">
          <button aria-label="Dismiss" class="artdeco-modal__dismiss"></button>
          <h1 id="pv-contact-info" class="XyZ">Andrew Ng</h1>
          <div class="artdeco-modal__content">
            <section class="pv-contact-info__contact-type">
              <h3 class="pv-contact-info__header t-16 t-black t-bold">Andrew's Profile</h3>
              <div class="pv-contact-info__ci-container"><a href="https://www.linkedin.com/in/andrewyng">linkedin.com/in/andrewyng</a></div>
            </section>
            <section class="pv-contact-info__contact-type">
              <h3 class="pv-contact-info__header t-16 t-black t-bold">Website</h3>
              <ul><li class="pv-contact-info__ci-container"><a href="https://www.deeplearning.ai/?trk=x">deeplearning.ai</a><span class="t-14 t-black--light">(Company)</span></li></ul>
            </section>
            <section class="pv-contact-info__contact-type">
              <h3 class="pv-contact-info__header t-16 t-black t-bold">Phone</h3>
              <ul><li class="pv-contact-info__ci-container"><span class="t-14 t-black t-normal">+1 415 555 0199</span><span class="t-14 t-black--light t-normal">(Mobile)</span></li></ul>
            </section>
            <section class="pv-contact-info__contact-type">
              <h3 class="pv-contact-info__header t-16 t-black t-bold">Email</h3>
              <div class="pv-contact-info__ci-container"><a class="pv-contact-info__contact-link" href="mailto:andrew@deeplearning.ai">andrew@deeplearning.ai</a></div>
            </section>
            <section class="pv-contact-info__contact-type">
              <h3 class="pv-contact-info__header t-16 t-black t-bold">Birthday</h3>
              <div class="pv-contact-info__ci-container"><span>April 18</span></div>
            </section>
            <section class="pv-contact-info__contact-type">
              <h3 class="pv-contact-info__header t-16 t-black t-bold">Connected</h3>
              <div class="pv-contact-info__ci-container"><span>Jan 5, 2021</span></div>
            </section>
          </div>
        </div>
      </div>`;
    expect(parseContactInfoModal(document)).toEqual({
      email: 'andrew@deeplearning.ai',
      phone: '+1 415 555 0199',
      websites: ['https://www.deeplearning.ai/'],
    });
  });

  it('still finds mailto links when the class names are hashed', () => {
    document.body.innerHTML = `
      <div role="dialog"><h1 id="pv-contact-info">Sam Lee</h1>
        <section class="AbC"><h3 class="DeF">Email</h3><a href="mailto:sam@example.com?subject=hi">sam@example.com</a></section>
        <section class="AbC"><h3 class="DeF">Phone</h3><span>(650) 555-0100</span><span>(Home)</span></section>
      </div>`;
    expect(parseContactInfoModal(document)).toEqual({ email: 'sam@example.com', phone: '(650) 555-0100', websites: [] });
  });

  it('returns nothing when the overlay is not open', () => {
    document.body.innerHTML = `<main><h1>Nobody</h1><span>Contact info</span></main>`;
    expect(parseContactInfoModal(document)).toBeNull();
  });
});

describe('parseContactInfoFromHtml', () => {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  it('maps the contact-info request to its body blob via the datalet index', () => {
    const body = { emailAddress: 'andrew@deeplearning.ai', phoneNumbers: [{ number: '+1 415 555 0199', type: 'MOBILE' }], websites: [{ url: 'https://www.deeplearning.ai', type: 'COMPANY' }] };
    const html = `<html><body>
      <code id="bpr-guid-7" style="display:none">${esc(JSON.stringify({ data: { $type: 'com.linkedin.voyager.dash.identity.profile.Profile', publicIdentifier: 'andrewyng' } }))}</code>
      <code id="datalet-bpr-guid-7" style="display:none">${esc(JSON.stringify({ request: '/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=andrewyng', status: 200, body: 'bpr-guid-7' }))}</code>
      <code id="bpr-guid-9" style="display:none">${esc(JSON.stringify(body))}</code>
      <code id="datalet-bpr-guid-9" style="display:none">${esc(JSON.stringify({ request: '/voyager/api/identity/profiles/andrewyng/profileContactInfo', status: 200, body: 'bpr-guid-9' }))}</code>
    </body></html>`;
    expect(parseContactInfoFromHtml(html, 'andrewyng')).toEqual({
      email: 'andrew@deeplearning.ai',
      phone: '+1 415 555 0199',
      websites: ['https://www.deeplearning.ai'],
    });
  });

  it('reads the dash shape where email and phones are wrapped objects', () => {
    const body = { data: { entityUrn: 'urn:li:fsd_profile:ACoAAAA1', publicIdentifier: 'andrewyng', emailAddress: { emailAddress: 'a@b.co' }, phoneNumbers: [{ phoneNumber: { number: '415-555-0100' }, type: 'MOBILE' }], websites: [] } };
    const html = `<code id="bpr-guid-3">${esc(JSON.stringify(body))}</code><code id="datalet-bpr-guid-3">${esc(JSON.stringify({ request: '/voyager/api/identity/dash/profiles?decorationId=com.linkedin.voyager.dash.deco.identity.profile.ProfileContactInfo-1&memberIdentity=andrewyng', body: 'bpr-guid-3' }))}</code>`;
    expect(parseContactInfoFromHtml(html, 'andrewyng')).toEqual({ email: 'a@b.co', phone: '415-555-0100', websites: [] });
  });

  it('never returns contact data from a blob for another profile', () => {
    const html = `<code id="bpr-guid-3">${esc(JSON.stringify({ emailAddress: 'other@x.com' }))}</code><code id="datalet-bpr-guid-3">${esc(JSON.stringify({ request: '/voyager/api/identity/profiles/someone-else/profileContactInfo', body: 'bpr-guid-3' }))}</code>`;
    expect(parseContactInfoFromHtml(html, 'andrewyng')).toBeNull();
  });
});

describe('extractProfile on a logged-in profile page', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    setUrl('https://www.linkedin.com/in/andrewyng/');
  });

  it('assembles name, headline, location, company, title and avatar from the top card and experience', () => {
    document.body.innerHTML = `<main>${topCard({})}${experienceSection(
      singleRole({ title: 'Founder', company: 'DeepLearning.AI', dates: 'Jun 2017 - Present · 8 yrs 3 mos' }),
    )}</main>`;
    const { profile, trace } = extractProfile(document, window.location.href);
    expect(profile).toMatchObject({
      full_name: 'Andrew Ng',
      headline: 'Founder of DeepLearning.AI; Managing General Partner of AI Fund; Exec Chairman of LandingAI',
      location: 'Palo Alto, California, United States',
      current_company: 'DeepLearning.AI',
      current_title: 'Founder',
      linkedin_url: 'https://www.linkedin.com/in/andrewyng',
      avatar_url: 'https://media.licdn.com/dms/image/v2/abc/profile-displayphoto-shrink_200_200/0?e=1',
    });
    expect(trace.some((t) => /experience/i.test(t))).toBe(true);
  });

  it('never mistakes the education badge for the current company', () => {
    document.body.innerHTML = `<main>${topCard({ company: null, headline: 'Product Designer | UX | Figma' })}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.current_company).toBe('');
    expect(profile?.current_title).toBe('Product Designer');
  });

  it('lets the experience section override a headline that names an old employer', () => {
    document.body.innerHTML = `<main>${topCard({ company: 'Meridian', headline: 'Ex-Google · Building at Meridian' })}${experienceSection(
      singleRole({ title: 'VP Engineering', company: 'Meridian', dates: 'Feb 2019 - Present · 6 yrs' }),
    )}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.current_title).toBe('VP Engineering');
    expect(profile?.current_company).toBe('Meridian');
  });

  it('does not read the "Contact info" link as the location', () => {
    document.body.innerHTML = `<main>${topCard({ location: 'Austin, Texas, United States' })}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.location).toBe('Austin, Texas, United States');
  });

  it('keeps extracting the same profile while the contact-info overlay route is open', () => {
    setUrl('https://www.linkedin.com/in/andrewyng/overlay/contact-info/');
    document.body.innerHTML = `<main>${topCard({})}</main>
      <div role="dialog"><h1 id="pv-contact-info">Andrew Ng</h1><section><h3>Email</h3><a href="mailto:andrew@deeplearning.ai">andrew@deeplearning.ai</a></section></div>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.linkedin_url).toBe('https://www.linkedin.com/in/andrewyng');
    expect(profile?.full_name).toBe('Andrew Ng');
    expect(profile?.email).toBe('andrew@deeplearning.ai');
  });

  it('does not treat a graduation year in the About text as a phone number', () => {
    document.body.innerHTML = `<main>${topCard({})}
      <section class="artdeco-card"><div id="about" class="pv-profile-card__anchor"></div>
        <div class="display-flex"><span aria-hidden="true">Stanford CS 2014-2018. Reach me at andrew@deeplearning.ai. Call +1 (415) 555-0199.</span></div>
      </section></main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.email).toBe('andrew@deeplearning.ai');
    expect(profile?.phone).toBe('+1 (415) 555-0199');
  });
});

describe('extractLinkedInProfile (legacy entrypoint and public-page fallbacks)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    setUrl('https://www.linkedin.com/in/sarah-jenkins/');
  });

  it('extracts candidate details from Schema.org JSON-LD on a public page', () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Person","name":"Andrew Ng","jobTitle":["Managing General Partner","Founder"],
       "worksFor":[{"@type":"Organization","name":"AI Fund"}],
       "address":{"@type":"PostalAddress","addressLocality":"Palo Alto","addressRegion":"California","addressCountry":"US"}}
      </script>`;
    const profile = extractLinkedInProfile();
    expect(profile?.full_name).toBe('Andrew Ng');
    expect(profile?.current_title).toBe('Managing General Partner');
    expect(profile?.current_company).toBe('AI Fund');
    expect(profile?.location).toBe('Palo Alto, California, US');
  });

  it('extracts name, headline, title, and company from a top card plus headline pattern', () => {
    document.body.innerHTML = `
      <main><section class="artdeco-card"><div data-view-name="profile-top-card">
        <h1 class="text-heading-xlarge">Sarah Jenkins</h1>
        <div class="text-body-medium break-words">Principal Engineer at Stripe | Ex-Apple</div>
        <span class="text-body-small inline t-black--light break-words">San Francisco, California</span>
      </div></section></main>`;
    const profile = extractLinkedInProfile();
    expect(profile?.full_name).toBe('Sarah Jenkins');
    expect(profile?.headline).toBe('Principal Engineer at Stripe | Ex-Apple');
    expect(profile?.current_title).toBe('Principal Engineer');
    expect(profile?.current_company).toBe('Stripe');
    expect(profile?.location).toBe('San Francisco, California');
  });

  it('extracts contact info from the About section', () => {
    document.body.innerHTML = `
      <main><h1>Alex Mercer</h1><div class="text-body-medium">Founder & CEO @ TechCorp</div>
        <div id="about"><p>Reach me directly at alex@techcorp.io or call (415) 555-0199 for inquiries.</p></div>
      </main>`;
    const profile = extractLinkedInProfile();
    expect(profile?.full_name).toBe('Alex Mercer');
    expect(profile?.current_title).toBe('Founder & CEO');
    expect(profile?.current_company).toBe('TechCorp');
    expect(profile?.email).toBe('alex@techcorp.io');
    expect(profile?.phone).toBe('(415) 555-0199');
  });

  it('returns null off a profile page', () => {
    setUrl('https://www.linkedin.com/feed/');
    document.body.innerHTML = '<main><h1>Feed</h1></main>';
    expect(extractLinkedInProfile()).toBeNull();
  });
});

/* ─── 2025 layout ─────────────────────────────────────────────────────────────
   Observed live on 2026-08-27: hashed class names on everything, `<section
   componentkey>` cards, the name in an `<h2>`, `<p>` runs for every text
   line, `[role="button"]` badges for company and school, experience entries
   as `[componentkey^="entity-collection-item-"]`, contact details in a
   `<dialog data-testid="dialog">`. */

import { isContactOverlayRendered, isNewProfileUi } from './linkedin-parser';

function newTopCard(opts: {
  name?: string;
  headline?: string;
  location?: string;
  badges?: string[];
  pronouns?: string;
  contact?: boolean;
}) {
  const {
    name = 'Andrew Ng',
    headline = 'DeepLearning.AI, AI Fund and AI Aspire',
    location = 'Palo Alto, California, United States',
    badges = ['DeepLearning.AI', 'University of California, Berkeley'],
    pronouns,
    contact = true,
  } = opts;
  return `
    <section componentkey="com.linkedin.sdui.profile.card.refACoAAAqBL5gBXJ8MGhQh-qHYyxAOW-DYlHM3VLgTopCard">
      <div class="_88068379">
        <div><a href="https://www.linkedin.com/in/andrewyng/"><img class="_5c2021b5" alt="" src="https://media.licdn.com/dms/image/v2/C5603AQF8paxRmnuJxg/profile-displayphoto-shrink_400_400/0?e=1&v=beta&t=abc"></a></div>
        <div class="d9a4036f">
          <div><a href="https://www.linkedin.com/in/andrewyng/"><div><div><h2 class="_31136337">${name}</h2></div></div></a>${pronouns ? `<p>${pronouns}</p>` : ''}<p class="hidden">· 1st</p><p>· 2nd</p></div>
          <p class="_4841b8c1">${headline}</p>
          ${badges.length ? `<p class="visually-hidden">${badges.join(' · ')}</p>` : ''}
          <div><p>${location}</p>${contact ? `<p>·</p><p><a href="https://www.linkedin.com/in/andrewyng/overlay/contact-info/">Contact info</a></p>` : ''}</div>
          <div>${badges.map((b) => `<div role="button" tabindex="0"><img src="https://media.licdn.com/dms/image/v2/C560BAQEHKffoI8RwIQ/company-logo_100_100/0?e=1"><p><span>${b}</span></p></div>`).join('')}</div>
          <p>2,606,334 followers</p>
          <p>Erik, Jonathan and 1 other mutual connection</p>
        </div>
      </div>
    </section>`;
}

function newItem(lines: string[], withDescription = true) {
  const [title, company, dates, loc] = lines;
  return `
    <div componentkey="entity-collection-item-${Math.random().toString(16).slice(2, 8)}">
      <hr role="presentation">
      <div><div><div><div>
        <a tabindex="0" href="https://www.linkedin.com/company/18246783/"><figure><svg></svg><img src="https://media.licdn.com/x/company-logo_100_100/0?e=1"></figure></a>
        <div>
          <a tabindex="0" href="https://www.linkedin.com/company/18246783/"><div><div><div><p>${title}</p><p>${company}</p></div></div>${dates ? `<p>${dates}</p>` : ''}${loc ? `<p>${loc}</p>` : ''}</div></a>
          ${withDescription ? `<div><p><span tabindex="-1" data-testid="expandable-text-box">${company} provides technical training on Generative AI, Machine Learning, and other topics. Jan 2020 - Dec 2021 we grew.<br><br>Our courses reach millions.</span><span> <button data-testid="expandable-text-button">more</button></span></p></div>` : ''}
        </div>
      </div></div></div></div>
    </div>`;
}

function newGroupedItem(company: string, roles: string[][]) {
  return `
    <div componentkey="entity-collection-item-grp">
      <div><div><div><div>
        <a href="https://www.linkedin.com/company/1441/"><figure><img src="https://media.licdn.com/x/company-logo_100_100/0"></figure></a>
        <div><div><p>${company}</p><p>Full-time · 8 yrs 3 mos</p><p>Mountain View, California, United States</p></div>
          <div>${roles.map(([title, dates]) => `<div><a href="https://www.linkedin.com/in/x/details/experience/urn:li:fsd_profilePosition:(ACoAAA,1)/"><div><p>${title}</p><p>${dates}</p></div></a></div>`).join('')}</div>
        </div>
      </div></div></div></div>
    </div>`;
}

function newExperience(items: string) {
  return `
    <section componentkey="com.linkedin.sdui.profile.card.refACoAAAqBL5gBXJ8MGhQh-qHYyxAOW-DYlHM3VLgExperience">
      <div><div><h2>Experience</h2></div>
        <div data-testid="profile_ExperienceTopLevelSection_andrewyng" data-component-type="LazyColumn">${items}</div>
        <a href="https://www.linkedin.com/in/andrewyng/details/experience/"><span>Show all 6 experiences</span></a>
      </div>
    </section>`;
}

function newSkills(skills: string[]) {
  return `
    <section componentkey="…Skills">
      <div><div><h2>Skills (${skills.length})</h2></div>
        <div>${skills
          .map(
            (s, i) => `${i ? '<hr>' : ''}<div><div><p><span>${s}</span></p><p><a href="https://www.linkedin.com/in/reidhoffman/details/skills/urn:li:fsd_skill:(ACoAAA,${i})/">2 endorsements</a></p></div></div>`,
          )
          .join('')}</div>
        <hr><a href="https://www.linkedin.com/in/reidhoffman/details/skills/"><span>Show all</span></a>
      </div>
    </section>`;
}

function newActivity() {
  return `
    <section componentkey="33cd2a88"><div><h2>Activity</h2>
      <ul><li><span aria-hidden="true">GitHub - andrewyng/openworker</span></li><li><span aria-hidden="true">Michal Majerczak and 7,625 others</span></li><li><span aria-hidden="true">254 comments</span></li><li><span aria-hidden="true">529 reposts</span></li></ul>
    </div></section>`;
}

function newAbout(text: string) {
  return `<section componentkey="…About"><div><div><div><h2>About</h2></div><div><p><span tabindex="-1" data-testid="expandable-text-box">${text}</span></p></div></div></div></section>`;
}

function newContactDialog(rows: { label: string; html: string }[]) {
  return `
    <dialog data-testid="dialog" aria-labelledby="dialog-header" open="">
      <button type="button" aria-label="Dismiss"><span></span></button>
      <div><header id="dialog-header"><h2>Contact info</h2></header>
        <div data-testid="dialog-content"><div data-sdui-screen="com.linkedin.sdui.flagshipnav.profile.ProfileContactDetailsOverlay"><div><div id="…ContactInfoDetailSection"><div><div data-testid="lazy-column" data-component-type="LazyColumn">
          ${rows.map((r) => `<div><div><svg></svg></div><div><p>${r.label}</p>${r.html}</div></div>`).join('')}
        </div></div></div></div></div></div>
      </div>
    </dialog>`;
}

describe('2025 layout: top card', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    setUrl('https://www.linkedin.com/in/andrewyng/');
  });

  it('is detected', () => {
    document.body.innerHTML = `<main>${newTopCard({})}</main>`;
    expect(isNewProfileUi(document)).toBe(true);
  });

  it('reads name, headline, location, company badge and photo', () => {
    document.body.innerHTML = `<main>${newTopCard({})}${newActivity()}</main>`;
    const { profile, trace } = extractProfile(document, window.location.href);
    expect(profile).toMatchObject({
      full_name: 'Andrew Ng',
      headline: 'DeepLearning.AI, AI Fund and AI Aspire',
      location: 'Palo Alto, California, United States',
      current_company: 'DeepLearning.AI',
      avatar_url: 'https://media.licdn.com/dms/image/v2/C5603AQF8paxRmnuJxg/profile-displayphoto-shrink_400_400/0?e=1&v=beta&t=abc',
    });
    expect(profile?.skills).toEqual([]);
    expect(trace[1]).toMatch(/2025 profile/);
  });

  it('handles pronouns, no badges and a headline that names the role', () => {
    document.body.innerHTML = `<main>${newTopCard({
      name: 'Reid Hoffman',
      pronouns: 'He/Him',
      headline: 'Co-Founder, LinkedIn, Manas AI & Inflection AI. Founding Team at PayPal.',
      location: 'United States',
      badges: [],
    })}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.full_name).toBe('Reid Hoffman');
    expect(profile?.headline).toBe('Co-Founder, LinkedIn, Manas AI & Inflection AI. Founding Team at PayPal.');
    expect(profile?.location).toBe('United States');
    expect(profile?.current_title).toBe('Co-Founder');
    expect(profile?.current_company).toBe('');
  });

  it('does not take a lone school badge as the company', () => {
    document.body.innerHTML = `<main>${newTopCard({ badges: ['Stanford University'], headline: 'PhD Candidate' })}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.current_company).toBe('');
    expect(profile?.current_title).toBe('PhD Candidate');
  });

  it('still finds the location when the profile has no Contact info link', () => {
    document.body.innerHTML = `<main>${newTopCard({ contact: false, location: 'Berlin, Germany' })}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.location).toBe('Berlin, Germany');
  });
});

describe('2025 layout: experience, skills, about', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setUrl('https://www.linkedin.com/in/andrewyng/');
  });

  it('reads the current role from the experience entries, ignoring descriptions', () => {
    document.body.innerHTML = `<main>${newTopCard({})}${newExperience(
      newItem(['Founder', 'DeepLearning.AI', 'Jun 2017 - Present · 9 yrs 3 mos', 'Palo Alto, California, United States']) +
        newItem(['Managing General Partner', 'AI Fund · Full-time', 'Jan 2018 - Present · 8 yrs 8 mos']),
    )}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.current_title).toBe('Founder');
    expect(profile?.current_company).toBe('DeepLearning.AI');
    expect(profile?.role_current).toBe(true);
  });

  it('strips the employment type from the company line', () => {
    document.body.innerHTML = `<main>${newTopCard({ badges: [] })}${newExperience(
      newItem(['Co-Founder, Board Member', 'Inflection AI · Part-time', 'Mar 2022 - Present · 4 yrs 6 mos', 'Palo Alto, California, United States']),
    )}</main>`;
    expect(extractExperience(document)).toEqual({ title: 'Co-Founder, Board Member', company: 'Inflection AI', current: true });
  });

  it('prefers the ongoing role at the badge company over an earlier ongoing one', () => {
    document.body.innerHTML = `<main>${newTopCard({ badges: ['AI Fund', 'Stanford University'] })}${newExperience(
      newItem(['Founder', 'DeepLearning.AI', 'Jun 2017 - Present · 9 yrs']) +
        newItem(['Managing General Partner', 'AI Fund · Full-time', 'Jan 2018 - Present · 8 yrs']),
    )}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.current_title).toBe('Managing General Partner');
    expect(profile?.current_company).toBe('AI Fund');
  });

  it('handles grouped roles at one employer', () => {
    document.body.innerHTML = `<main>${newTopCard({ badges: ['Google', 'Stanford University'] })}${newExperience(
      newGroupedItem('Google', [
        ['Senior Staff Software Engineer', 'Jan 2020 - Present · 5 yrs 8 mos'],
        ['Staff Software Engineer', 'Mar 2017 - Jan 2020 · 2 yrs 11 mos'],
      ]),
    )}</main>`;
    expect(extractExperience(document)).toEqual({ title: 'Senior Staff Software Engineer', company: 'Google', current: true });
  });

  it('flags a profile whose latest role has ended', () => {
    document.body.innerHTML = `<main>${newTopCard({ badges: [] })}${newExperience(
      newItem(['Data Scientist', 'Acme · Full-time', 'Jan 2020 - Dec 2024 · 5 yrs']),
    )}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.current_title).toBe('Data Scientist');
    expect(profile?.role_current).toBe(false);
  });

  it('reads skills from the Skills card only - never from the activity feed', () => {
    document.body.innerHTML = `<main>${newTopCard({})}${newActivity()}${newSkills(['CEOs', 'Founding', 'Venture Capital'])}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.skills).toEqual(['CEOs', 'Founding', 'Venture Capital']);
  });

  it('reads the About text', () => {
    document.body.innerHTML = `<main>${newTopCard({})}${newAbout('I build things. Reach me at andrew@deeplearning.ai.')}</main>`;
    const { profile } = extractProfile(document, window.location.href);
    expect(profile?.about).toBe('I build things. Reach me at andrew@deeplearning.ai.');
    expect(profile?.email).toBe('andrew@deeplearning.ai');
  });
});

describe('2025 layout: contact dialog', () => {
  it('reads email, phone and websites from the label rows', () => {
    document.body.innerHTML = `<main>${newTopCard({})}</main>${newContactDialog([
      { label: 'Andrew’s profile', html: '<p><a href="https://www.linkedin.com/in/andrewyng/">linkedin.com/in/andrewyng</a></p>' },
      { label: 'Website', html: '<p><a href="https://cs.stanford.edu/~ang/?trk=public">cs.stanford.edu</a> <span>(Personal)</span></p><p><a href="https://www.coursera.org/">coursera.org</a> <span>(Company)</span></p>' },
      { label: 'Email', html: '<p><a href="mailto:andrew@deeplearning.ai">andrew@deeplearning.ai</a></p>' },
      { label: 'Phone', html: '<p>+1 415 555 0199 <span>(Mobile)</span></p>' },
      { label: 'Birthday', html: '<p>April 18</p>' },
    ])}`;
    expect(isContactOverlayRendered(document)).toBe(true);
    expect(parseContactInfoModal(document)).toEqual({
      email: 'andrew@deeplearning.ai',
      phone: '+1 415 555 0199',
      websites: ['https://cs.stanford.edu/~ang/', 'https://www.coursera.org/'],
    });
  });

  it('unwraps LinkedIn\'s outbound-link interstitial around websites', () => {
    document.body.innerHTML = newContactDialog([
      { label: 'Reid’s profile', html: '<p><a href="https://www.linkedin.com/in/reidhoffman/">linkedin.com/in/reidhoffman</a></p>' },
      { label: 'Website', html: '<p><a href="https://www.linkedin.com/safety/go?url=https%3A%2F%2Fsuperagency.ai%2F&trk=contact-info">superagency.ai</a> <span>(Other)</span></p><p><a href="https://www.linkedin.com/redir/redirect?url=http%3A%2F%2Fmastersofscale.com&urlhash=x">mastersofscale.com</a> <span>(Personal)</span></p>' },
    ]);
    expect(parseContactInfoModal(document)?.websites).toEqual(['https://superagency.ai/', 'http://mastersofscale.com/']);
  });

  it('reports websites only when that is all the person shares', () => {
    document.body.innerHTML = newContactDialog([
      { label: 'Andrew’s profile', html: '<p><a href="https://www.linkedin.com/in/andrewyng/">linkedin.com/in/andrewyng</a></p>' },
      { label: 'Website', html: '<p><a href="https://cs.stanford.edu/~ang/">cs.stanford.edu</a> <span>(Personal)</span></p>' },
    ]);
    expect(isContactOverlayRendered(document)).toBe(true);
    expect(parseContactInfoModal(document)).toEqual({ email: null, phone: null, websites: ['https://cs.stanford.edu/~ang/'] });
  });

  it('is not "rendered" while the dialog shell has no rows yet', () => {
    document.body.innerHTML = `<dialog data-testid="dialog" open=""><button aria-label="Dismiss"></button><div><header id="dialog-header"><h2>Contact info</h2></header><div data-testid="dialog-content"></div></div></dialog>`;
    expect(isContactOverlayRendered(document)).toBe(false);
  });
});
