// Hybrid LinkedIn Profile Parser (Clean DOM Tree-Walking + Scoped Candidate Parsing)

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
 * Clean, self-contained parser that inspects the candidate's top card and experience section.
 * Designed to run both in content scripts and direct executeScript contexts.
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

  // ─── 1. Name Extraction ───────────────────────────────────────────────────
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
      profile.full_name = text;
      break;
    }
  }

  // Fallback name from document title (e.g. "Sarah Jenkins | LinkedIn")
  if (!profile.full_name && document.title) {
    const titlePart = document.title.split(/[-–—|•]/)[0]?.trim();
    if (titlePart && !titlePart.toLowerCase().includes('linkedin') && titlePart.length > 1) {
      profile.full_name = titlePart;
    }
  }

  // If name was from title, find its element in DOM
  if (!nameEl && profile.full_name) {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, strong, b'));
    for (const h of headings) {
      if (h.textContent?.trim() === profile.full_name) {
        nameEl = h;
        break;
      }
    }
  }

  // ─── 2. Top-Card Container & Hierarchy ────────────────────────────────────
  const topCard: HTMLElement | null =
    (nameEl?.closest('section.artdeco-card, section, div[data-view-name="profile-top-card"], div.ph5, main') as HTMLElement) ||
    (document.querySelector('main section, [data-view-name="profile-top-card"], section.artdeco-card') as HTMLElement) ||
    (document.querySelector('main') as HTMLElement);

  // ─── 3. Headline Extraction ───────────────────────────────────────────────
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

  // Sibling Tree-Walking for Headline if still missing
  if (!profile.headline && nameEl) {
    const parentContainer = nameEl.parentElement?.parentElement || nameEl.parentElement;
    const textEls = parentContainer?.querySelectorAll('div, p, span') || [];
    for (const el of Array.from(textEls)) {
      const text = el.textContent?.trim();
      if (
        text &&
        text.length > 2 &&
        text !== profile.full_name &&
        !text.toLowerCase().includes('connection') &&
        !text.toLowerCase().includes('contact info') &&
        !text.toLowerCase().includes('message') &&
        !text.toLowerCase().includes('follow')
      ) {
        profile.headline = text;
        break;
      }
    }
  }

  // ─── 4. Location Extraction ───────────────────────────────────────────────
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

  // ─── 5. Current Company & Title Extraction ────────────────────────────────

  // Strategy A: Top-Card Right Panel Widgets (Company badge in top card)
  const topCompSelectors = [
    'ul.pv-text-details__right-panel button span[aria-hidden="true"]',
    'ul.pv-text-details__right-panel li button div',
    'ul.pv-text-details__right-panel li span',
    'button[aria-label*="Current company"] span',
    'button[aria-label*="Current company"]',
    'div.pv-text-details__right-panel a span',
    'div.pv-text-details__right-panel button',
    'div[aria-label*="Current company"]',
  ];

  for (const sel of topCompSelectors) {
    const el = topCard?.querySelector(sel) || document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length > 1 && !text.toLowerCase().includes('company') && !text.toLowerCase().includes('education')) {
      profile.current_company = text;
      break;
    }
  }

  // Strategy B: Experience Section Scraping
  const expContainers = [
    '#experience ~ .pvs-list__outer-container > ul > li',
    'section[data-view-name*="profile-experience"] ul > li',
    'section:has(#experience) ul > li',
    'div#experience ~ ul > li',
    'section#experience ul > li',
    'section:has(#experience) div.display-flex',
  ];

  for (const expSel of expContainers) {
    const firstExp = document.querySelector(expSel);
    if (firstExp) {
      const titleEl = firstExp.querySelector('.t-bold span[aria-hidden="true"], span.t-bold, span[aria-hidden="true"]');
      const compEl = firstExp.querySelector(
        '.t-normal span[aria-hidden="true"], .t-black--light span[aria-hidden="true"], span.t-14.t-normal span, span.t-14.t-normal'
      );

      if (titleEl && !profile.current_title) {
        const t = titleEl.textContent?.trim() || '';
        if (t && t.length > 1 && t !== profile.full_name) {
          profile.current_title = t;
        }
      }
      if (compEl && !profile.current_company) {
        const c = compEl.textContent?.trim() || '';
        if (c && c.length > 1) {
          profile.current_company = c.split('·')[0].split('•')[0].trim();
        }
      }
      if (profile.current_title && profile.current_company) break;
    }
  }

  // Strategy C: Deconstruct Headline into Title & Company
  if (profile.headline) {
    const headline = profile.headline;
    // Patterns: "Role at Company", "Role @ Company", "Role | Company", "Role - Company", "Role • Company", "Role, Company"
    const splitRegex = /\s+(?:at|@|–|-|\||•)\s+/i;
    const parts = headline.split(splitRegex);

    if (parts.length >= 2) {
      if (!profile.current_title) {
        profile.current_title = parts[0].trim();
      }
      if (!profile.current_company) {
        profile.current_company = parts[1].split(/[-–|•·,]/)[0].trim();
      }
    } else if (headline.includes(',')) {
      const commaParts = headline.split(',');
      if (!profile.current_title) profile.current_title = commaParts[0].trim();
      if (!profile.current_company && commaParts.length > 1) profile.current_company = commaParts[1].trim();
    } else {
      if (!profile.current_title) {
        profile.current_title = headline;
      }
    }
  }

  // ─── 6. Avatar Image Extraction ───────────────────────────────────────────
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

  // ─── 7. About Summary & Candidate-Scoped Contact Info ────────────────────
  try {
    const aboutSection = document.querySelector('#about, #about ~ *, section:has(#about), [data-view-name*="profile-about"]');
    if (aboutSection) {
      const text = aboutSection.textContent?.trim() || '';
      if (text.length > 5) {
        profile.about = text.replace(/^About\s*/i, '').trim();

        // Check for candidate's email ONLY inside their own About section
        const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
        if (emailMatch && !emailMatch[0].includes('linkedin.com') && !emailMatch[0].includes('example.com')) {
          profile.email = emailMatch[0].trim();
        }

        // Check for phone number inside About section
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

  // ─── 8. Skills Extraction ─────────────────────────────────────────────────
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
