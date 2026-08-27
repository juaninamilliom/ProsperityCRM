// Hybrid LinkedIn Profile Parser (JSON-LD + Voyager Hydration State + Semantic Tree-Walking DOM Heuristics)

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
 * Self-contained, tree-walking extractor function that can run inside a content script
 * or be passed directly to chrome.scripting.executeScript({ func: extractLinkedInProfile }).
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

  // Helper: Clean LinkedIn URL
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

  // ─── 1. Parse JSON-LD Schema ───────────────────────────────────────────────
  try {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        const item = data['@graph'] ? data['@graph'].find((i: any) => i['@type'] === 'Person') : data;
        if (item && item['@type'] === 'Person') {
          if (item.name && !profile.full_name) profile.full_name = item.name.trim();
          if (item.jobTitle) {
            if (!profile.headline) profile.headline = item.jobTitle;
            if (!profile.current_title) profile.current_title = item.jobTitle;
          }
          if (item.worksFor) {
            const comp = Array.isArray(item.worksFor) ? item.worksFor[0]?.name : item.worksFor.name;
            if (comp && !profile.current_company) profile.current_company = comp.trim();
          }
          if (item.address?.addressLocality && !profile.location) {
            profile.location = item.address.addressLocality;
          }
          if ((item.image?.contentUrl || typeof item.image === 'string') && !profile.avatar_url) {
            profile.avatar_url = item.image.contentUrl || item.image;
          }
          if (item.description && !profile.about) {
            profile.about = item.description;
          }
        }
      } catch {}
    }
  } catch {}

  // ─── 2. Parse Embedded Voyager Hydration JSON Blobs ─────────────────────────
  try {
    const codeTags = document.querySelectorAll('code[id^="bpr-guid-"], script[type="application/json"]');
    for (const tag of codeTags) {
      try {
        let text = '';
        for (const child of Array.from(tag.childNodes)) {
          if (child.nodeType === 8 /* Node.COMMENT_NODE */) {
            text += child.nodeValue || '';
          }
        }
        if (!text) {
          text = tag.textContent || tag.innerHTML || '';
          if (text.startsWith('<!--') && text.endsWith('-->')) {
            text = text.slice(4, -3).trim();
          }
        }
        text = text.trim();

        if (!text.includes('"firstName"') && !text.includes('"headline"') && !text.includes('"companyName"')) {
          continue;
        }

        const json = JSON.parse(text);
        const elements = json?.included || (Array.isArray(json) ? json : [json?.data || json]);

        for (const el of elements) {
          if (!el || typeof el !== 'object') continue;

          // Name
          if (!profile.full_name && el.firstName && el.lastName) {
            profile.full_name = `${el.firstName} ${el.lastName}`.trim();
          }
          // Headline
          if (!profile.headline && el.headline) {
            profile.headline = el.headline.trim();
          }
          // Location
          if (!profile.location && el.geoLocationName) {
            profile.location = el.geoLocationName.trim();
          } else if (!profile.location && el.geoCountryName) {
            profile.location = el.geoCountryName.trim();
          }
          // Summary / About
          if (!profile.about && el.summary) {
            profile.about = el.summary.trim();
          }
          // Title & Company from Position models
          if (el.title && !profile.current_title) {
            profile.current_title = el.title.trim();
          }
          if (el.companyName && !profile.current_company) {
            profile.current_company = el.companyName.trim();
          }
          // Skills
          if (el.name && (el['$type']?.includes('Skill') || el.entityUrn?.includes('skill'))) {
            const skillName = el.name.trim();
            if (!profile.skills.includes(skillName)) profile.skills.push(skillName);
          }
          // Email
          if (!profile.email && el.emailAddress) {
            profile.email = el.emailAddress.trim();
          }
          // Phone
          if (!profile.phone && el.phoneNumber) {
            profile.phone = (el.phoneNumber.number || el.phoneNumber).toString().trim();
          }
        }
      } catch {}
    }
  } catch {}

  // ─── 3. Semantic Tree-Walking DOM Extraction ───────────────────────────────

  // A. Find Name & Locate the Top Card Element
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
    'h2.text-heading-xlarge',
  ];

  for (const sel of nameSelectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length > 1 && !text.toLowerCase().includes('feed') && !text.toLowerCase().includes('linkedin') && !text.toLowerCase().includes('search')) {
      nameEl = el;
      if (!profile.full_name) profile.full_name = text;
      break;
    }
  }

  // Document Title Fallback for Name
  if (!profile.full_name && document.title) {
    const titleMatch = document.title.split(/[-–—|•]/)[0]?.trim();
    if (titleMatch && !titleMatch.toLowerCase().includes('linkedin')) {
      profile.full_name = titleMatch;
    }
  }

  // Locate the Top-Card container
  const topCard: HTMLElement | null =
    (nameEl?.closest('section.artdeco-card, section, div[data-view-name="profile-top-card"], div.ph5, main') as HTMLElement) ||
    (document.querySelector('main section, [data-view-name="profile-top-card"], section.artdeco-card') as HTMLElement) ||
    document.body;

  // B. Extract Headline: Check explicit selectors, then walk siblings/children of top card
  if (!profile.headline) {
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
        !text.toLowerCase().includes('connection') &&
        !text.toLowerCase().includes('contact info') &&
        !text.toLowerCase().includes('message') &&
        !text.toLowerCase().includes('connect')
      ) {
        profile.headline = text;
        break;
      }
    }
  }

  // Tree-Walking Fallback for Headline: Check element following nameEl
  if (!profile.headline && nameEl) {
    const parent = nameEl.parentElement;
    let nextNode = nameEl.nextElementSibling || parent?.nextElementSibling;
    while (nextNode) {
      const text = nextNode.textContent?.trim();
      if (
        text &&
        text.length > 2 &&
        !text.toLowerCase().includes('connection') &&
        !text.toLowerCase().includes('contact info') &&
        !text.toLowerCase().includes('message')
      ) {
        profile.headline = text;
        break;
      }
      nextNode = nextNode.nextElementSibling;
    }
  }

  // C. Extract Location
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
      const text = el?.textContent?.trim().replace(/Contact info/i, '').trim();
      if (
        text &&
        text.length > 2 &&
        !text.toLowerCase().includes('connection') &&
        !text.toLowerCase().includes('followers') &&
        !text.toLowerCase().includes('message')
      ) {
        profile.location = text;
        break;
      }
    }
  }

  // D. Extract Avatar Image
  if (!profile.avatar_url) {
    const avatarEl = topCard?.querySelector<HTMLImageElement>(
      'img.pv-top-card-profile-picture__image, img.presence-entity__image, img.pv-top-card__photo, img[alt*="profile picture"], img[alt*="photo of"], img[alt*="Profile photo"], img.evi-image'
    ) || document.querySelector<HTMLImageElement>(
      'img.pv-top-card-profile-picture__image, img.presence-entity__image, img.pv-top-card__photo, img[alt*="photo of"]'
    );
    if (avatarEl?.src && !avatarEl.src.includes('ghost-person') && !avatarEl.src.includes('data:image/gif')) {
      profile.avatar_url = avatarEl.src;
    }
  }

  // E. Extract Company from Top-Card Right Panel Widgets
  if (!profile.current_company) {
    const topCompSelectors = [
      'ul.pv-text-details__right-panel button span[aria-hidden="true"]',
      'ul.pv-text-details__right-panel li button div',
      'ul.pv-text-details__right-panel li span',
      'button[aria-label*="Current company"] span',
      'button[aria-label*="Current company"]',
      'div.pv-text-details__right-panel a span',
      'div.pv-text-details__right-panel button',
    ];
    for (const sel of topCompSelectors) {
      const el = topCard?.querySelector(sel) || document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text && text.length > 1 && !text.toLowerCase().includes('company')) {
        profile.current_company = text;
        break;
      }
    }
  }

  // F. Parse Experience Section for Title & Company
  if (!profile.current_title || !profile.current_company) {
    const expContainers = [
      '#experience ~ .pvs-list__outer-container > ul > li',
      'section[data-view-name*="profile-experience"] ul > li',
      'section:has(#experience) ul > li',
      'div#experience ~ ul > li',
      'section#experience ul > li',
    ];
    for (const expSel of expContainers) {
      const firstExp = document.querySelector(expSel);
      if (firstExp) {
        // Line 1: Title (usually bold)
        const titleEl = firstExp.querySelector('.t-bold span[aria-hidden="true"], span[aria-hidden="true"]');
        // Line 2: Company
        const compEl = firstExp.querySelector(
          '.t-normal span[aria-hidden="true"], .t-black--light span[aria-hidden="true"], span.t-14.t-normal span, span.t-14.t-normal'
        );

        if (titleEl && !profile.current_title) {
          profile.current_title = titleEl.textContent?.trim() || '';
        }
        if (compEl && !profile.current_company) {
          const compText = compEl.textContent?.trim() || '';
          profile.current_company = compText.split('·')[0].split('•')[0].trim();
        }
        if (profile.current_title && profile.current_company) break;
      }
    }
  }

  // G. Infer Title and Company from Headline
  if (profile.headline) {
    const headline = profile.headline;
    // Common patterns: "Role at Company", "Role @ Company", "Role | Company", "Role - Company", "Role • Company", "Role, Company"
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

  // ─── 4. Contact Info Extraction (Email & Phone) ───────────────────────────
  try {
    // 1. Check explicit mailto / tel links
    const mailtoLink = document.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    if (mailtoLink && !profile.email) {
      profile.email = mailtoLink.href.replace(/^mailto:/i, '').split('?')[0].trim();
    }

    const telLink = document.querySelector<HTMLAnchorElement>('a[href^="tel:"]');
    if (telLink && !profile.phone) {
      profile.phone = telLink.href.replace(/^tel:/i, '').trim();
    }

    // 2. Check open Contact Info modal or About summary
    const contactSection = document.querySelector(
      '.pv-contact-info__contact-type, section.pv-contact-info__contact-type, .artdeco-modal__content, div[data-view-name*="contact-info"], #about, section:has(#about)'
    );
    const searchScope = (contactSection || topCard || document.body) as HTMLElement;
    const scopeText = searchScope?.innerText || searchScope?.textContent || '';

    if (!profile.email) {
      const emailMatch = scopeText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
      if (emailMatch && !emailMatch[0].includes('linkedin.com') && !emailMatch[0].includes('example.com')) {
        profile.email = emailMatch[0].trim();
      }
    }

    if (!profile.phone) {
      const phoneMatch = scopeText.match(/(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/);
      if (phoneMatch) {
        profile.phone = phoneMatch[0].trim();
      }
    }
  } catch {}

  // ─── 5. Skills Extraction ───────────────────────────────────────────────────
  if (profile.skills.length === 0) {
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
  }

  return profile;
}
