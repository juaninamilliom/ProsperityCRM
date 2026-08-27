// Hybrid LinkedIn Profile Parser (JSON-LD + Embedded State + Semantic DOM Heuristics)

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
    const match = url.pathname.match(/^\/(in|company)\/([^/?#]+)/i);
    if (match) {
      return `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
    }
  } catch {}
  return raw.split('?')[0].replace(/\/+$/, '');
}

export function extractLinkedInProfile(): ParsedCandidateProfile | null {
  const currentUrl = window.location.href;
  if (!currentUrl.includes('linkedin.com/in/')) {
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
          // Name
          if (!profile.full_name && el?.firstName && el?.lastName) {
            profile.full_name = `${el.firstName} ${el.lastName}`.trim();
          }
          // Headline
          if (!profile.headline && el?.headline) {
            profile.headline = el.headline.trim();
          }
          // Location
          if (!profile.location && el?.geoLocationName) {
            profile.location = el.geoLocationName.trim();
          }
          // Skills
          if (el?.name && el?.['$type']?.includes('Skill')) {
            if (!profile.skills.includes(el.name)) profile.skills.push(el.name.trim());
          }
          // Experience / Company
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

  // Name: Top level h1 on the main profile card
  if (!profile.full_name) {
    const h1 = document.querySelector('h1.text-heading-xlarge, section.artdeco-card h1, .pv-top-card--list h1, h1');
    if (h1) {
      profile.full_name = h1.textContent?.trim() || '';
    }
  }

  // Headline: Text immediately below name
  if (!profile.headline) {
    const headlineEl = document.querySelector(
      '.text-body-medium.break-words, .pv-top-card--list-bullet .text-body-medium, [data-generated-suggestion-target]'
    );
    if (headlineEl) {
      profile.headline = headlineEl.textContent?.trim() || '';
    }
  }

  // Location
  if (!profile.location) {
    const locEl = document.querySelector(
      '.text-body-small.inline.t-black--light.break-words, .pv-top-card--list-bullet .text-body-small, span.text-body-small.inline'
    );
    if (locEl) {
      profile.location = locEl.textContent?.trim().replace(/Contact info/i, '').trim() || '';
    }
  }

  // Avatar Image
  if (!profile.avatar_url) {
    const avatarEl = document.querySelector<HTMLImageElement>(
      'img.pv-top-card-profile-picture__image, img.presence-entity__image, img.pv-top-card__photo'
    );
    if (avatarEl && avatarEl.src && !avatarEl.src.includes('ghost-person')) {
      profile.avatar_url = avatarEl.src;
    }
  }

  // Parse Experience Section for Title & Company
  if (!profile.current_title || !profile.current_company) {
    const expSection = document.querySelector('#experience, section[data-view-name*="profile-experience"]');
    if (expSection) {
      const firstExp = expSection.closest('section')?.querySelector('li, ul > li');
      if (firstExp) {
        const titleEl = firstExp.querySelector('span[aria-hidden="true"], .t-bold span');
        const companyEl = firstExp.querySelector('span.t-normal span[aria-hidden="true"], span.t-14.t-normal span');

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

  // Infer Title and Company from Headline if still missing (e.g. "Senior Recruiter at Acme Corp")
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
    const skillCards = document.querySelectorAll('#skills ~ * a[data-field="skill_card_skill_topic"] span[aria-hidden="true"], [data-view-name*="profile-skills"] li span[aria-hidden="true"]');
    skillCards.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && !profile.skills.includes(text) && text.length < 40) {
        profile.skills.push(text);
      }
    });
  }

  return profile;
}
