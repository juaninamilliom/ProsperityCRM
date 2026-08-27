// Multi-Tiered LinkedIn Candidate Parser (JSON-LD + Voyager Entity Graph + Experience DOM + Top-Card)

export interface ParsedCandidateProfile {
  full_name: string;
  headline: string;
  current_title: string;
  current_company: string;
  location: string;
  linkedin_url: string;
  avatar_url: string | null;
  about: string | null;
  skills: string[];
  email: string | null;
  phone: string | null;
}

export function normalizeLinkedInUrl(raw: string): string {
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const match = url.pathname.match(/^\/(in|company|sales\/lead|talent\/profile)\/([^/?#]+)/i);
    if (match) {
      const slug = match[2].toLowerCase();
      if (match[1].toLowerCase().startsWith('sales') || match[1].toLowerCase().startsWith('talent')) {
        return `https://www.linkedin.com/in/${slug}`;
      }
      return `https://www.linkedin.com/${match[1].toLowerCase()}/${slug}`;
    }
  } catch {}
  return raw.split('?')[0].replace(/\/+$/, '');
}

export function isLinkedInProfileUrl(url: string): boolean {
  return (
    url.includes('linkedin.com/in/') ||
    url.includes('linkedin.com/sales/lead/') ||
    url.includes('linkedin.com/sales/people/') ||
    url.includes('linkedin.com/talent/profile/')
  );
}

/**
 * Extracts candidate information from the active LinkedIn tab.
 * Uses a robust cascade:
 * 1. Schema.org JSON-LD (instant in HTML head)
 * 2. LinkedIn Voyager Position data blobs
 * 3. Structured Experience section DOM
 * 4. Top-Card right panel widgets
 * 5. Headline decomposition
 */
export function extractLinkedInProfile(): ParsedCandidateProfile | null {
  const currentUrl = window.location.href;
  const isProfile =
    currentUrl.includes('linkedin.com/in/') ||
    currentUrl.includes('linkedin.com/sales/lead/') ||
    currentUrl.includes('linkedin.com/sales/people/') ||
    currentUrl.includes('linkedin.com/talent/profile/');

  if (!isProfile) {
    return null;
  }

  // Canonical LinkedIn Profile URL
  let cleanUrl = currentUrl.split('?')[0].replace(/\/+$/, '');
  try {
    const urlObj = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
    const match = urlObj.pathname.match(/^\/(in|company|sales\/lead|talent\/profile)\/([^/?#]+)/i);
    if (match) {
      const slug = match[2].toLowerCase();
      cleanUrl = `https://www.linkedin.com/in/${slug}`;
    }
  } catch {}

  const profile: ParsedCandidateProfile = {
    full_name: '',
    headline: '',
    current_title: '',
    current_company: '',
    location: '',
    linkedin_url: cleanUrl,
    avatar_url: null,
    about: null,
    skills: [],
    email: null,
    phone: null,
  };

  // ─── TIER 1: Schema.org JSON-LD (Always in HTML head on initial SSR) ───────
  try {
    const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of jsonLdScripts) {
      const raw = s.textContent?.trim();
      if (!raw) continue;
      try {
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (item['@type'] === 'Person' || (item.name && (item.jobTitle || item.worksFor))) {
            if (!profile.full_name && item.name) {
              profile.full_name = typeof item.name === 'string' ? item.name.trim() : '';
            }
            if (!profile.current_title && item.jobTitle) {
              if (Array.isArray(item.jobTitle) && item.jobTitle.length > 0) {
                profile.current_title = String(item.jobTitle[0]).trim();
              } else if (typeof item.jobTitle === 'string') {
                profile.current_title = item.jobTitle.trim();
              }
            }
            if (!profile.current_company && item.worksFor) {
              const orgs = Array.isArray(item.worksFor) ? item.worksFor : [item.worksFor];
              if (orgs[0]?.name && typeof orgs[0].name === 'string') {
                profile.current_company = orgs[0].name.trim();
              }
            }
            if (!profile.location && item.address) {
              if (typeof item.address === 'string') {
                profile.location = item.address.trim();
              } else if (typeof item.address === 'object') {
                const parts = [
                  item.address.addressLocality,
                  item.address.addressRegion,
                  item.address.addressCountry,
                ].filter(Boolean);
                if (parts.length > 0) profile.location = parts.join(', ');
              }
            }
            if (!profile.avatar_url && item.image) {
              if (typeof item.image === 'string') profile.avatar_url = item.image;
              else if (item.image?.contentUrl) profile.avatar_url = item.image.contentUrl;
            }
          }
        }
      } catch {}
    }
  } catch {}

  // ─── TIER 2: LinkedIn Voyager Position Blobs (code[id^="bpr-guid-"]) ───────
  if (!profile.current_title || !profile.current_company) {
    try {
      const codeBlocks = Array.from(document.querySelectorAll('code[id^="bpr-guid-"]'));
      for (const code of codeBlocks) {
        const text = code.textContent?.trim();
        if (!text || (!text.includes('Position') && !text.includes('companyName') && !text.includes('miniCompany'))) continue;
        try {
          const json = JSON.parse(text);
          const elements = json.included || (Array.isArray(json) ? json : [json]);
          for (const el of elements) {
            // Check position entities
            if (el.$type?.includes('Position') || (el.title && (el.companyName || el.company))) {
              if (!profile.current_title && el.title && typeof el.title === 'string') {
                profile.current_title = el.title.trim();
              }
              const comp = el.companyName || el.company?.name;
              if (!profile.current_company && comp && typeof comp === 'string') {
                profile.current_company = comp.trim();
              }
              if (!profile.location && el.locationName && typeof el.locationName === 'string') {
                profile.location = el.locationName.trim();
              }
            }
            if (profile.current_title && profile.current_company) break;
          }
        } catch {}
        if (profile.current_title && profile.current_company) break;
      }
    } catch {}
  }

  // ─── TIER 3: DOM Name Extraction ──────────────────────────────────────────
  let nameEl: Element | null = null;
  const nameSelectors = [
    'h1.text-heading-xlarge',
    'section.artdeco-card h1',
    'div[data-view-name="profile-top-card"] h1',
    'div.pv-text-details__left-panel h1',
    '.pv-top-card--list h1',
    '[data-anonymize="person-name"]',
    'main section h1',
    'main h1',
    'h1',
  ];

  for (const sel of nameSelectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (
      text &&
      text.length > 1 &&
      !text.toLowerCase().includes('feed') &&
      !text.toLowerCase().includes('linkedin') &&
      !text.toLowerCase().includes('search') &&
      !text.toLowerCase().includes('notifications')
    ) {
      nameEl = el;
      if (!profile.full_name) profile.full_name = text;
      break;
    }
  }

  // Fallback name from document title (e.g. "Andrew Ng | LinkedIn")
  if (!profile.full_name && document.title) {
    const titlePart = document.title.split(/[-–—|•]/)[0]?.trim();
    if (titlePart && !titlePart.toLowerCase().includes('linkedin') && titlePart.length > 1) {
      profile.full_name = titlePart;
    }
  }

  // ─── TIER 4: Top-Card Container & Headline ─────────────────────────────────
  const topCard: HTMLElement | null =
    (nameEl?.closest('section.artdeco-card, section, div[data-view-name="profile-top-card"], div.ph5, main') as HTMLElement) ||
    (document.querySelector('main section, [data-view-name="profile-top-card"], section.artdeco-card') as HTMLElement) ||
    (document.querySelector('main') as HTMLElement);

  const headlineSelectors = [
    '.text-body-medium.break-words',
    'div.pv-text-details__left-panel .text-body-medium',
    'div[data-view-name="profile-top-card"] .text-body-medium',
    '[data-generated-suggestion-target]',
    '[data-anonymize="headline"]',
    '.pv-top-card--list-bullet .text-body-medium',
    'section.artdeco-card .text-body-medium',
    '.text-body-medium',
    'div.top-card__headline',
    'p.text-body-medium',
  ];

  for (const sel of headlineSelectors) {
    const el = topCard?.querySelector(sel) || document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (
      text &&
      text.length > 2 &&
      text !== profile.full_name &&
      !text.toLowerCase().includes('connection') &&
      !text.toLowerCase().includes('contact info') &&
      !text.toLowerCase().includes('message') &&
      !text.toLowerCase().includes('connect') &&
      !text.toLowerCase().includes('followers')
    ) {
      profile.headline = text;
      break;
    }
  }

  // ─── TIER 5: Location Extraction ──────────────────────────────────────────
  if (!profile.location) {
    const locSelectors = [
      '.text-body-small.inline.t-black--light.break-words',
      'div.pv-text-details__left-panel span.text-body-small',
      'div[data-view-name="profile-top-card"] span.text-body-small',
      '[data-anonymize="location"]',
      'span.text-body-small.inline',
      '.pv-top-card--list-bullet .text-body-small',
      'span.top-card__subline-item',
      '.text-body-small',
    ];

    for (const sel of locSelectors) {
      const el = topCard?.querySelector(sel) || document.querySelector(sel);
      const rawText = el?.textContent?.trim() || '';
      const text = rawText.replace(/Contact info/i, '').replace(/·.*$/, '').trim();
      if (
        text &&
        text.length > 2 &&
        text !== profile.full_name &&
        text !== profile.headline &&
        !text.toLowerCase().includes('connection') &&
        !text.toLowerCase().includes('followers') &&
        !text.toLowerCase().includes('message') &&
        !text.toLowerCase().includes('connect')
      ) {
        profile.location = text;
        break;
      }
    }
  }

  // ─── TIER 6: Structured Experience Section (DOM) ──────────────────────────
  if (!profile.current_title || !profile.current_company) {
    try {
      const expSection = document.querySelector(
        '#experience ~ .pvs-list__outer-container, section:has(#experience), section#experience, div#experience ~ ul, div[data-view-name*="profile-experience"]'
      );

      const firstExpItem = expSection?.querySelector(
        'ul > li.artdeco-list__item, ul > li.pvs-list__paged-list-item, ul > li'
      );

      if (firstExpItem) {
        const nestedSubList = firstExpItem.querySelector('.pvs-entity__sub-components, ul.pvs-list, ul');
        if (nestedSubList) {
          const compLine = firstExpItem.querySelector(
            '.display-flex .t-bold span[aria-hidden="true"], span.t-bold span[aria-hidden="true"], span.t-bold'
          );
          const nestedTitle = nestedSubList.querySelector(
            '.t-bold span[aria-hidden="true"], span.t-bold span[aria-hidden="true"], span.t-bold'
          );

          if (!profile.current_title && nestedTitle?.textContent?.trim()) {
            profile.current_title = nestedTitle.textContent.trim();
          }
          if (!profile.current_company && compLine?.textContent?.trim()) {
            profile.current_company = compLine.textContent.trim().split('·')[0].trim();
          }
        } else {
          const titleEl = firstExpItem.querySelector(
            '.t-bold span[aria-hidden="true"], div.display-flex span.t-bold, span[aria-hidden="true"]'
          );
          const compEl = firstExpItem.querySelector(
            '.t-normal span[aria-hidden="true"], .t-black--light span[aria-hidden="true"], span.t-14.t-normal span, span.t-14.t-normal, span.t-14'
          );
          const compLogoLink = firstExpItem.querySelector<HTMLAnchorElement>('a[href*="/company/"]');

          if (!profile.current_title && titleEl?.textContent?.trim()) {
            const t = titleEl.textContent.trim();
            if (t !== profile.full_name && !t.toLowerCase().includes('present')) {
              profile.current_title = t;
            }
          }

          if (!profile.current_company && compEl?.textContent?.trim()) {
            const c = compEl.textContent.trim().split('·')[0].split('•')[0].trim();
            if (c && !c.toLowerCase().includes('yr') && !c.toLowerCase().includes('mo') && !c.toLowerCase().includes('present')) {
              profile.current_company = c;
            }
          } else if (!profile.current_company && compLogoLink?.textContent?.trim()) {
            profile.current_company = compLogoLink.textContent.trim().split('·')[0].trim();
          }
        }
      }
    } catch {}
  }

  // ─── TIER 7: Top-Card Right Panel & Company Links Fallback ───────────────
  if (!profile.current_company) {
    // 1. Check direct company links in top-card or header
    const compLinks = Array.from(
      topCard?.querySelectorAll('a[href*="/company/"], a[href*="linkedin.com/company/"]') || []
    );
    for (const a of compLinks) {
      const raw = a.textContent || '';
      const text = raw
        .replace(/Current company:?\s*/i, '')
        .replace(/Company:?\s*/i, '')
        .replace(/Education:?\s*/i, '')
        .replace(/logo/i, '')
        .trim();
      if (text && text.length > 1 && !text.toLowerCase().includes('linkedin') && !text.toLowerCase().includes('follow')) {
        profile.current_company = text.split('\n')[0].trim();
        break;
      }
    }
  }

  if (!profile.current_company) {
    const topCompSelectors = [
      'ul.pv-text-details__right-panel button span[aria-hidden="true"]',
      'ul.pv-text-details__right-panel li button div',
      'ul.pv-text-details__right-panel li a span',
      'ul.pv-text-details__right-panel li span',
      'button[aria-label*="Current company"] span',
      'button[aria-label*="Current company"]',
      'div.pv-text-details__right-panel a span',
      'div.pv-text-details__right-panel button',
      'div[aria-label*="Current company"]',
      'div.pv-text-details__right-panel',
    ];

    for (const sel of topCompSelectors) {
      const el = topCard?.querySelector(sel) || document.querySelector(sel);
      const raw = el?.textContent?.trim() || '';
      const text = raw
        .replace(/Current company:?\s*/i, '')
        .replace(/Company:?\s*/i, '')
        .replace(/Education:?\s*/i, '')
        .replace(/Click to skip.*/i, '')
        .trim();
      if (
        text &&
        text.length > 1 &&
        !text.toLowerCase().includes('followers') &&
        !text.toLowerCase().includes('connections') &&
        !text.toLowerCase().includes('education')
      ) {
        profile.current_company = text.split('\n')[0].trim();
        break;
      }
    }
  }

  // ─── TIER 8: Headline Decomposition Fallback ──────────────────────────────
  if (!profile.current_title || !profile.current_company) {
    if (profile.headline) {
      const headline = profile.headline.trim();
      const primarySegment = headline.split(/[;|]/)[0].trim();
      const splitRegex = /\s+(?:at|@|of|–|-|•)\s+/i;
      const parts = primarySegment.split(splitRegex);

      if (parts.length >= 2) {
        if (!profile.current_title) {
          profile.current_title = parts[0].trim();
        }
        if (!profile.current_company) {
          profile.current_company = parts[1].split(/[-–|•·,;]/)[0].trim();
        }
      } else if (primarySegment.includes(',')) {
        const commaParts = primarySegment.split(',');
        if (!profile.current_title) profile.current_title = commaParts[0].trim();
        if (!profile.current_company && commaParts.length > 1) profile.current_company = commaParts[1].trim();
      } else {
        if (!profile.current_title) {
          profile.current_title = primarySegment;
        }
      }

      // Secondary check across full headline for company if still missing
      if (!profile.current_company) {
        const match = headline.match(/(?:at|@|of|–|-)\s+([A-Za-z0-9&.,\s'-]+?)(?:;|\/|\||•|$)/i);
        if (match && match[1]) {
          const comp = match[1].trim().split(/[,;]/)[0].trim();
          if (comp.length > 1 && !comp.toLowerCase().includes('helping') && !comp.toLowerCase().includes('building')) {
            profile.current_company = comp;
          }
        }
      }
    }
  }

  // ─── TIER 9: Avatar Image Extraction ──────────────────────────────────────
  if (!profile.avatar_url) {
    const avatarEl =
      topCard?.querySelector<HTMLImageElement>(
        'img.pv-top-card-profile-picture__image, img.presence-entity__image, img.pv-top-card__photo, img[alt*="profile picture"], img[alt*="photo of"], img[alt*="Profile photo"], img.evi-image'
      ) ||
      document.querySelector<HTMLImageElement>(
        'img.pv-top-card-profile-picture__image, img.presence-entity__image, img.pv-top-card__photo, img[alt*="photo of"]'
      );

    if (avatarEl?.src && !avatarEl.src.includes('ghost-person') && !avatarEl.src.includes('data:image/gif')) {
      profile.avatar_url = avatarEl.src;
    }
  }

  // ─── TIER 10: About Summary & Candidate-Scoped Contact Info ───────────────
  try {
    const aboutSection = document.querySelector('#about, #about ~ *, section:has(#about), [data-view-name*="profile-about"]');
    if (aboutSection) {
      const text = aboutSection.textContent?.trim() || '';
      if (text.length > 5) {
        profile.about = text.replace(/^About\s*/i, '').trim();

        // Candidate's email ONLY inside their own About section
        const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
        if (emailMatch && !emailMatch[0].includes('linkedin.com') && !emailMatch[0].includes('example.com')) {
          profile.email = emailMatch[0].trim();
        }

        // Phone number inside About section
        const phoneMatch = text.match(/(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/);
        if (phoneMatch) {
          profile.phone = phoneMatch[0].trim();
        }
      }
    }

    // Check open Contact Info modal (if user opened the overlay)
    const modalSection = document.querySelector(
      '.pv-contact-info__contact-type, section.pv-contact-info__contact-type, .artdeco-modal__content, div[data-view-name*="contact-info"]'
    );
    if (modalSection) {
      const modalText = modalSection.textContent || '';
      if (!profile.email) {
        const modalEmail = modalText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
        if (modalEmail && !modalEmail[0].includes('linkedin.com')) {
          profile.email = modalEmail[0].trim();
        }
      }
      if (!profile.phone) {
        const modalPhone = modalText.match(/(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/);
        if (modalPhone) {
          profile.phone = modalPhone[0].trim();
        }
      }
    }
  } catch {}

  // ─── TIER 11: Skills Extraction ───────────────────────────────────────────
  try {
    const skillElements = document.querySelectorAll(
      '#skills ~ * a[data-field="skill_card_skill_topic"] span[aria-hidden="true"], [data-view-name*="profile-skills"] li span[aria-hidden="true"], div.pv-skill-category-entity__name span, section:has(#skills) li span[aria-hidden="true"]'
    );
    skillElements.forEach((el) => {
      const text = el.textContent?.trim();
      if (
        text &&
        !profile.skills.includes(text) &&
        text.length > 1 &&
        text.length < 40 &&
        !text.includes('+') &&
        !text.toLowerCase().includes('endorse')
      ) {
        profile.skills.push(text);
      }
    });
  } catch {}

  return profile;
}
