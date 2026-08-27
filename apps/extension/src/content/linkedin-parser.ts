// Hybrid LinkedIn Profile Parser (JSON-LD + Embedded State + Multi-View DOM Heuristics)

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

export function extractLinkedInProfile(): ParsedCandidateProfile | null {
  const currentUrl = window.location.href;
  if (!isLinkedInProfileUrl(currentUrl)) {
    return null;
  }

  const profile: ParsedCandidateProfile = {
    full_name: '',
    headline: '',
    current_title: '',
    current_company: '',
    location: '',
    linkedin_url: normalizeLinkedInUrl(currentUrl),
    avatar_url: null,
    about: null,
    skills: [],
    email: null,
    phone: null,
  };

  // ─── 1. Try JSON-LD Schema ─────────────────────────────────────────────────
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent || '{}');
      const item = data['@graph'] ? data['@graph'].find((i: any) => i['@type'] === 'Person') : data;
      if (item && item['@type'] === 'Person') {
        if (item.name) profile.full_name = item.name.trim();
        if (item.jobTitle) {
          profile.headline = item.jobTitle;
          profile.current_title = item.jobTitle;
        }
        if (item.worksFor) {
          const comp = Array.isArray(item.worksFor) ? item.worksFor[0]?.name : item.worksFor.name;
          if (comp) profile.current_company = comp.trim();
        }
        if (item.address?.addressLocality) {
          profile.location = item.address.addressLocality;
        }
        if (item.image?.contentUrl || typeof item.image === 'string') {
          profile.avatar_url = item.image.contentUrl || item.image;
        }
        if (item.description) {
          profile.about = item.description;
        }
      }
    } catch {}
  }

  // ─── 2. Try Embedded State (Voyager JSON Blobs) ────────────────────────────
  const codeTags = document.querySelectorAll('code[id^="bpr-guid-"]');
  for (const tag of codeTags) {
    try {
      const text = tag.textContent?.trim() || '';
      if (text.includes('"firstName"') || text.includes('"headline"') || text.includes('"companyName"')) {
        const json = JSON.parse(text);
        const elements = json?.included || (Array.isArray(json) ? json : [json]);

        for (const el of elements) {
          if (!profile.full_name && el?.firstName && el?.lastName) {
            profile.full_name = `${el.firstName} ${el.lastName}`.trim();
          }
          if (!profile.headline && el?.headline) {
            profile.headline = el.headline.trim();
          }
          if (!profile.location && el?.geoLocationName) {
            profile.location = el.geoLocationName.trim();
          }
          if (el?.name && (el?.['$type']?.includes('Skill') || el?.entityUrn?.includes('skill'))) {
            if (!profile.skills.includes(el.name)) profile.skills.push(el.name.trim());
          }
          if (!profile.current_company && el?.companyName) {
            profile.current_company = el.companyName.trim();
          }
          if (!profile.current_title && el?.title) {
            profile.current_title = el.title.trim();
          }
        }
      }
    } catch {}
  }

  // ─── 3. Resilient Semantic DOM Extraction Fallback ─────────────────────────

  // Name: Target all possible name containers
  if (!profile.full_name) {
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'section.artdeco-card h1',
      '.pv-top-card--list h1',
      'div.pv-text-details__left-panel h1',
      '[data-anonymize="person-name"]',
      'main h1',
      'h1',
    ];
    for (const selector of nameSelectors) {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && text.length > 1 && !text.toLowerCase().includes('feed')) {
        profile.full_name = text;
        break;
      }
    }
  }

  // Fallback name from document title (e.g. "Juan Guardado | LinkedIn")
  if (!profile.full_name && document.title) {
    const titleMatch = document.title.split(/[-–—|]/)[0]?.trim();
    if (titleMatch && !titleMatch.toLowerCase().includes('linkedin')) {
      profile.full_name = titleMatch;
    }
  }

  // Headline: Text immediately below name or top card
  if (!profile.headline) {
    const headlineSelectors = [
      '.text-body-medium.break-words',
      '.pv-top-card--list-bullet .text-body-medium',
      'div.pv-text-details__left-panel .text-body-medium',
      '[data-anonymize="headline"]',
      '[data-generated-suggestion-target]',
    ];
    for (const selector of headlineSelectors) {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && text.length > 2) {
        profile.headline = text;
        break;
      }
    }
  }

  // Location
  if (!profile.location) {
    const locSelectors = [
      '.text-body-small.inline.t-black--light.break-words',
      '.pv-top-card--list-bullet .text-body-small',
      'div.pv-text-details__left-panel span.text-body-small',
      '[data-anonymize="location"]',
      'span.text-body-small.inline',
    ];
    for (const selector of locSelectors) {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim().replace(/Contact info/i, '').trim();
      if (text && text.length > 2 && !text.toLowerCase().includes('connections')) {
        profile.location = text;
        break;
      }
    }
  }

  // Avatar Image
  if (!profile.avatar_url) {
    const avatarEl = document.querySelector<HTMLImageElement>(
      'img.pv-top-card-profile-picture__image, img.presence-entity__image, img.pv-top-card__photo, img[alt*="profile picture"], img[alt*="photo of"]'
    );
    if (avatarEl && avatarEl.src && !avatarEl.src.includes('ghost-person') && !avatarEl.src.includes('data:image/gif')) {
      profile.avatar_url = avatarEl.src;
    }
  }

  // Parse Experience Section for Title & Company
  if (!profile.current_title || !profile.current_company) {
    const expSection = document.querySelector('#experience, section[data-view-name*="profile-experience"], section[data-view-name*="experience"]');
    if (expSection) {
      const firstExp = expSection.closest('section')?.querySelector('li, ul > li');
      if (firstExp) {
        const titleEl = firstExp.querySelector('span[aria-hidden="true"], .t-bold span, div.display-flex span');
        const companyEl = firstExp.querySelector('span.t-normal span[aria-hidden="true"], span.t-14.t-normal span, span.t-14.t-black--light span');

        if (titleEl && !profile.current_title) {
          profile.current_title = titleEl.textContent?.trim() || '';
        }
        if (companyEl && !profile.current_company) {
          const compText = companyEl.textContent?.trim() || '';
          profile.current_company = compText.split('·')[0].split('•')[0].trim();
        }
      }
    }
  }

  // Infer Title and Company from Headline if still missing
  if (!profile.current_title && profile.headline) {
    const parts = profile.headline.split(/\s+(?:at|@)\s+/i);
    if (parts.length >= 2) {
      profile.current_title = parts[0].trim();
      profile.current_company = parts[1].split('|')[0].split('•')[0].trim();
    } else {
      profile.current_title = profile.headline;
    }
  }

  // Extract visible skills badges
  if (profile.skills.length === 0) {
    const skillCards = document.querySelectorAll(
      '#skills ~ * a[data-field="skill_card_skill_topic"] span[aria-hidden="true"], [data-view-name*="profile-skills"] li span[aria-hidden="true"], div.pv-skill-category-entity__name span'
    );
    skillCards.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && !profile.skills.includes(text) && text.length < 40 && !text.includes('+')) {
        profile.skills.push(text);
      }
    });
  }

  return profile;
}
