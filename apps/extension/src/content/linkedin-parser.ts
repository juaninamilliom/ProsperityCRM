/**
 * LinkedIn profile extraction.
 *
 * Runs inside the LinkedIn tab (content script) against the logged-in DOM.
 * Every source is a pure function of a Document so it can be unit-tested
 * against fixtures, and every decision is appended to a trace the side panel
 * can show - when a profile parses badly, the trace says which step chose
 * what, which is the evidence needed to fix the selector.
 *
 * Source priority for title / company:
 *   1. Experience section (the most recent ongoing role, matched against the
 *      top-card "Current company" badge when both exist)
 *   2. Top-card "Current company" badge (company only)
 *   3. Voyager entities embedded in the page, scoped to this profile
 *   4. Headline decomposition ("Founder of X", "Engineer at Y")
 *   5. Schema.org JSON-LD (only present on logged-out public pages)
 */

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
  websites: string[];
  /** null = unknown; false = the best role found has an end date. */
  role_current: boolean | null;
}

export interface ContactInfo {
  email: string | null;
  phone: string | null;
  websites: string[];
}

export interface RoleMatch {
  title: string;
  company: string;
  current: boolean;
}

export interface ExtractionResult {
  profile: ParsedCandidateProfile | null;
  trace: string[];
}

/* ─── URL helpers ──────────────────────────────────────────────────────────── */

const PROFILE_PATH = /^\/(in|sales\/lead|sales\/people|talent\/profile)\/([^/?#]+)/i;

export function isLinkedInProfileUrl(url: string): boolean {
  return (
    url.includes('linkedin.com/in/') ||
    url.includes('linkedin.com/sales/lead/') ||
    url.includes('linkedin.com/sales/people/') ||
    url.includes('linkedin.com/talent/profile/')
  );
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

/** The public slug of a profile URL, ignoring overlay sub-routes such as
 *  `/in/slug/overlay/contact-info/` - the modal is still the same person. */
export function profileSlugFromUrl(raw: string): string | null {
  const url = parseUrl(raw);
  const match = url?.pathname.match(PROFILE_PATH);
  if (!match) return null;
  try {
    return decodeURIComponent(match[2]).toLowerCase();
  } catch {
    return match[2].toLowerCase();
  }
}

export function normalizeLinkedInUrl(raw: string): string {
  const url = parseUrl(raw);
  const match = url?.pathname.match(/^\/(in|company|sales\/lead|sales\/people|talent\/profile)\/([^/?#]+)/i);
  if (match) {
    const kind = match[1].toLowerCase();
    const slug = match[2].toLowerCase();
    if (kind === 'in' || kind === 'company') return `https://www.linkedin.com/${kind}/${slug}`;
    return `https://www.linkedin.com/in/${slug}`;
  }
  return raw.split('?')[0].replace(/\/+$/, '');
}

/* ─── Text helpers ─────────────────────────────────────────────────────────── */

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** LinkedIn renders every visible string twice - once `aria-hidden`, once
 *  `visually-hidden` for screen readers. Reading textContent naively doubles
 *  it ("FounderFounder"); prefer the aria-hidden copy. */
function visibleText(el: Element | null | undefined): string {
  if (!el) return '';
  if (el.getAttribute('aria-hidden') === 'true') return clean(el.textContent);
  const hidden = el.querySelector('span[aria-hidden="true"]');
  if (hidden) return clean(hidden.textContent);
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('.visually-hidden, .a11y-text').forEach((node) => node.remove());
  return clean(clone.textContent);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3}[\s.-]?\d{3,4}\b/;

function findEmail(text: string): string | null {
  const match = text.match(EMAIL_RE);
  if (!match) return null;
  const email = match[0].trim();
  if (/linkedin\.com|example\.com$/i.test(email)) return null;
  return email;
}

/** A phone number has 10-15 digits; a year range ("2014-2018") does not. */
function findPhone(text: string): string | null {
  const re = new RegExp(PHONE_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) return match[0].trim();
  }
  return null;
}

/* ─── Headline decomposition ───────────────────────────────────────────────── */

const ROLE_WORDS =
  /\b(engineer|engineering|developer|manager|director|founder|co-?founder|ceo|cto|coo|cfo|cpo|cmo|cro|vp|svp|evp|president|head|lead|leader|scientist|designer|architect|analyst|consultant|partner|owner|chief|officer|recruiter|specialist|associate|intern|principal|staff|senior|junior|advisor|adviser|investor|professor|researcher|marketer|marketing|sales|account|product|program|project|operations|hr|talent|counsel|attorney|lawyer|nurse|physician|doctor|teacher|coach|writer|editor|strategist|technician|administrator|assistant|executive|entrepreneur|student|phd|candidate|fellow|evangelist|advocate|generalist|controller|accountant|auditor|banker|trader|economist|pm|swe|sre|devops|data|ml|ai)\b/i;

const SLOGAN =
  /^(helping|building|making|driving|creating|passionate|open to|i help|we help|let'?s|turning|empowering|transforming|scaling|growing|leading the|on a mission|looking for|seeking|available|hiring|ex-?\s)/i;

function looksLikeTitle(value: string): boolean {
  const text = clean(value);
  if (!text || text.length > 60 || SLOGAN.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length > 8) return false;
  if (ROLE_WORDS.test(text)) return true;
  return words.every((w) => /^[A-Z0-9&(/-]/.test(w) || /^(of|and|&|the|for|at|de|la|y|di|du|des)$/i.test(w));
}

function cleanCompany(value: string): string {
  return clean(value.split(/\s*[,(|]\s*|\s+[-–—]\s+/)[0]).replace(/[.]+$/, (m) => (m.length > 1 ? '' : m));
}

/** "Founder of X; Partner at Y | Ex-Z" → the first segment, split on the
 *  joiner. A slogan ("Helping teams ship faster") yields nothing rather than
 *  a made-up title. */
export function decomposeHeadline(headline: string): { title: string; company: string } {
  const primary = clean(headline).split(/\s*[;|•·]\s*|\s+[-–—]\s+/)[0] ?? '';
  if (!primary) return { title: '', company: '' };

  const joiners = [/^(.+?)\s+(?:at|@)\s+(.+)$/i, /^(.+?)\s+of\s+(.+)$/i];
  for (const joiner of joiners) {
    const match = primary.match(joiner);
    if (!match) continue;
    const title = clean(match[1]);
    const company = cleanCompany(match[2]);
    return { title: looksLikeTitle(title) ? title : '', company };
  }

  if (primary.includes(',')) {
    const [first, second] = primary.split(',').map(clean);
    if (looksLikeTitle(first)) {
      return { title: first, company: second && !looksLikeTitle(second) ? cleanCompany(second) : '' };
    }
  }

  return looksLikeTitle(primary) ? { title: primary, company: '' } : { title: '', company: '' };
}

/* ─── Experience section ───────────────────────────────────────────────────── */

const DATE_LINE = /^(?:[A-Za-zÀ-ÿ]{3,10}\.?\s+)?(?:19|20)\d{2}\s*[-–—]\s*\S/;
const ONGOING = /\b(present|current|now|actualidad|heute|présent|attuale|atual)\b/i;

function experienceItems(doc: Document): Element[] {
  const anchor = doc.querySelector('#experience');
  let section: Element | null = anchor ? anchor.closest('section') ?? anchor.parentElement : null;
  if (!section) {
    section = doc.querySelector('section[data-view-name*="experience"], div[data-view-name*="profile-experience"]');
  }
  if (!section) return [];
  const list = section.querySelector('.pvs-list__outer-container > ul, .pvs-list__outer-container ul, ul');
  if (!list) return [];
  return Array.from(list.children).filter((child) => child.tagName === 'LI');
}

function entityOf(li: Element): Element {
  const first = li.firstElementChild;
  if (first?.getAttribute('data-view-name') === 'profile-component-entity') return first;
  return li.querySelector('[data-view-name="profile-component-entity"]') ?? li;
}

/** Text lines of an entry, excluding its nested sub-components block. */
function entryLines(entity: Element, sub: Element | null): string[] {
  const outside = (node: Element) => !sub || !sub.contains(node);
  let nodes = Array.from(entity.querySelectorAll('span[aria-hidden="true"]')).filter(outside);
  if (nodes.length === 0) {
    nodes = Array.from(entity.querySelectorAll('.t-bold, .t-normal, .t-14, .t-black--light')).filter(outside);
  }
  const lines: string[] = [];
  for (const node of nodes) {
    const text = clean(node.textContent);
    if (text && !lines.includes(text)) lines.push(text);
  }
  return lines;
}

function boldOf(entity: Element, sub: Element | null): string {
  const bold = Array.from(entity.querySelectorAll('.t-bold, [class*="t-bold"], strong')).find(
    (node) => !sub || !sub.contains(node),
  );
  return visibleText(bold);
}

function nestedRoleEntries(sub: Element): Element[] {
  const entities = Array.from(sub.querySelectorAll('[data-view-name="profile-component-entity"]'));
  if (entities.length > 0) return entities;
  return Array.from(sub.querySelectorAll('li')).filter((li) => li.querySelector('.t-bold'));
}

function parseRole(entity: Element): { title: string; dateLine: string | undefined; lines: string[] } {
  const sub = entity.querySelector('.pvs-entity__sub-components');
  const lines = entryLines(entity, sub);
  const title = boldOf(entity, sub);
  const dateLine = lines.find((line) => DATE_LINE.test(line));
  return { title, dateLine, lines };
}

function parseEntry(li: Element): RoleMatch | null {
  const entity = entityOf(li);
  const sub = entity.querySelector('.pvs-entity__sub-components');
  const { title: bold, dateLine, lines } = parseRole(entity);
  if (!bold) return null;

  const nested = sub && !dateLine ? nestedRoleEntries(sub) : [];
  if (nested.length > 0) {
    // Grouped: the header is the employer, each nested entity a role there.
    const roles = nested
      .map((node) => {
        const role = parseRole(node);
        if (!role.title) return null;
        return { title: role.title, current: role.dateLine ? ONGOING.test(role.dateLine) : true };
      })
      .filter((role): role is { title: string; current: boolean } => role !== null);
    const pick = roles.find((role) => role.current) ?? roles[0];
    return pick ? { title: pick.title, company: bold, current: pick.current } : null;
  }

  // Single role: bold is the title, the next line is "Company · Employment type".
  const companyLine = lines.find((line) => line !== bold && line !== dateLine && !DATE_LINE.test(line));
  const company = companyLine ? clean(companyLine.split(/\s+[·•]\s+/)[0]) : '';
  return { title: bold, company, current: dateLine ? ONGOING.test(dateLine) : true };
}

export function extractExperienceEntries(doc: Document): RoleMatch[] {
  return experienceItems(doc)
    .map(parseEntry)
    .filter((entry): entry is RoleMatch => entry !== null);
}

/** The role to call "current": one at the preferred company if it is ongoing,
 *  else the first ongoing role, else the most recent one (flagged). */
export function extractExperience(doc: Document, preferredCompany?: string): RoleMatch | null {
  const entries = extractExperienceEntries(doc);
  if (entries.length === 0) return null;
  const wanted = clean(preferredCompany ?? '').toLowerCase();
  if (wanted) {
    const match = entries.find((entry) => entry.current && entry.company.toLowerCase() === wanted);
    if (match) return match;
  }
  return entries.find((entry) => entry.current) ?? entries[0];
}

/* ─── Voyager entities embedded in the page ────────────────────────────────── */

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entitiesOf(json: unknown): Json[] {
  if (Array.isArray(json)) return json.filter(isObject);
  if (!isObject(json)) return [];
  const included = json.included;
  if (Array.isArray(included)) return included.filter(isObject);
  if (isObject(json.data)) return [json.data];
  return [json];
}

function yearMonth(value: unknown): number {
  if (!isObject(value)) return 0;
  const year = typeof value.year === 'number' ? value.year : 0;
  const month = typeof value.month === 'number' ? value.month : 0;
  return year * 12 + month;
}

/** Positions from the SSR payload blobs. The blobs of the profile loaded
 *  first stay in the DOM across SPA navigation, so a position is only used
 *  when it belongs to the profile whose slug is in the URL. */
export function extractVoyagerPosition(doc: Document, slug: string): RoleMatch | null {
  const owners = new Map<string, string>();
  const positions: { owner: string | null; title: string; company: string; start: number; ended: boolean }[] = [];

  for (const code of Array.from(doc.querySelectorAll('code[id^="bpr-guid-"]'))) {
    const text = code.textContent?.trim();
    if (!text || !/Position|companyName|publicIdentifier/.test(text)) continue;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue;
    }
    for (const entity of entitiesOf(json)) {
      const urn = typeof entity.entityUrn === 'string' ? entity.entityUrn : '';
      if (typeof entity.publicIdentifier === 'string' && urn) {
        owners.set(urn.split(':').pop() ?? '', entity.publicIdentifier.toLowerCase());
      }
      const type = typeof entity.$type === 'string' ? entity.$type : '';
      const company = isObject(entity.company) ? entity.company.name : undefined;
      const companyName = typeof entity.companyName === 'string' ? entity.companyName : typeof company === 'string' ? company : '';
      const isPosition = /\.Position$/.test(type) || (typeof entity.title === 'string' && companyName);
      if (!isPosition || typeof entity.title !== 'string') continue;
      const range = isObject(entity.dateRange) ? entity.dateRange : isObject(entity.timePeriod) ? entity.timePeriod : {};
      const end = range.end ?? range.endDate;
      positions.push({
        owner: urn.match(/\(([^,]+),/)?.[1] ?? null,
        title: clean(entity.title),
        company: clean(companyName),
        start: yearMonth(range.start ?? range.startDate),
        ended: Boolean(end),
      });
    }
  }

  const wanted = slug.toLowerCase();
  const scoped = positions.filter((position) => {
    if (!position.owner) return owners.size === 0;
    const owner = owners.get(position.owner);
    return owner ? owner === wanted : owners.size === 0;
  });
  if (scoped.length === 0) return null;

  scoped.sort((a, b) => Number(a.ended) - Number(b.ended) || b.start - a.start);
  const best = scoped[0];
  return { title: best.title, company: best.company, current: !best.ended };
}

/* ─── Contact info ─────────────────────────────────────────────────────────── */

function canonicalWebsite(href: string): string | null {
  const url = parseUrl(href);
  if (!url || /(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  return `${url.origin}${url.pathname}`;
}

function contactDialog(root: ParentNode): Element | null {
  const anchor = root.querySelector('#pv-contact-info');
  if (anchor) return anchor.closest('[role="dialog"], .artdeco-modal') ?? anchor.parentElement;
  const dialogs = Array.from(root.querySelectorAll('[role="dialog"], .artdeco-modal, .pv-contact-info'));
  return (
    dialogs.find(
      (dialog) =>
        dialog.querySelector('a[href^="mailto:"], a[href^="tel:"]') ||
        Array.from(dialog.querySelectorAll('h3, h2')).some((h) => /^(email|phone|website)/i.test(clean(h.textContent))),
    ) ?? null
  );
}

/** Reads the "Contact info" overlay when it is open. Returns null when it is
 *  not; an empty ContactInfo when it is open but the person shares nothing. */
export function parseContactInfoModal(root: ParentNode): ContactInfo | null {
  const dialog = contactDialog(root);
  if (!dialog) return null;

  const info: ContactInfo = { email: null, phone: null, websites: [] };
  for (const section of Array.from(dialog.querySelectorAll('section'))) {
    const header = clean(section.querySelector('h3, h2, .pv-contact-info__header')?.textContent).toLowerCase();
    const body = clean(section.textContent).replace(new RegExp(`^${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
    if (/e-?mail/.test(header)) {
      const link = section.querySelector('a[href^="mailto:"]');
      const fromHref = link?.getAttribute('href')?.replace(/^mailto:/i, '').split('?')[0];
      info.email = info.email ?? (fromHref ? decodeURIComponent(fromHref) : findEmail(body));
    } else if (/phone|mobile|tel/.test(header)) {
      const link = section.querySelector('a[href^="tel:"]');
      const fromHref = link?.getAttribute('href')?.replace(/^tel:/i, '');
      info.phone = info.phone ?? (fromHref ? decodeURIComponent(fromHref) : findPhone(body));
    } else if (/website|site|blog|portfolio/.test(header)) {
      for (const link of Array.from(section.querySelectorAll('a[href]'))) {
        const site = canonicalWebsite(link.getAttribute('href') ?? '');
        if (site && !info.websites.includes(site)) info.websites.push(site);
      }
    }
  }

  if (!info.email) {
    const mailto = dialog.querySelector('a[href^="mailto:"]')?.getAttribute('href');
    if (mailto) info.email = decodeURIComponent(mailto.replace(/^mailto:/i, '').split('?')[0]);
  }
  if (!info.phone) {
    const tel = dialog.querySelector('a[href^="tel:"]')?.getAttribute('href');
    if (tel) info.phone = decodeURIComponent(tel.replace(/^tel:/i, ''));
  }
  return info;
}

function contactFromJson(json: unknown): ContactInfo | null {
  const info: ContactInfo = { email: null, phone: null, websites: [] };
  const visit = (node: unknown, depth: number) => {
    if (depth > 10 || typeof node !== 'object' || node === null) return;
    if (Array.isArray(node)) {
      node.forEach((child) => visit(child, depth + 1));
      return;
    }
    const record = node as Json;
    if (!info.email) {
      const email = record.emailAddress;
      if (typeof email === 'string' && EMAIL_RE.test(email)) info.email = email;
      else if (isObject(email) && typeof email.emailAddress === 'string') info.email = email.emailAddress;
    }
    if (!info.phone && Array.isArray(record.phoneNumbers)) {
      for (const entry of record.phoneNumbers) {
        if (!isObject(entry)) continue;
        const nested = isObject(entry.phoneNumber) ? entry.phoneNumber.number : undefined;
        const number = typeof entry.number === 'string' ? entry.number : typeof nested === 'string' ? nested : null;
        if (number) {
          info.phone = clean(number);
          break;
        }
      }
    }
    if (Array.isArray(record.websites)) {
      for (const site of record.websites) {
        if (isObject(site) && typeof site.url === 'string' && !info.websites.includes(site.url)) info.websites.push(site.url);
      }
    }
    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) visit(value, depth + 1);
    }
  };
  visit(json, 0);
  return info.email || info.phone || info.websites.length > 0 ? info : null;
}

/** LinkedIn's server-rendered pages embed the API responses the route needs
 *  as `<code id="bpr-guid-N">` blobs, indexed by `datalet-bpr-guid-N` entries
 *  that name the request URL. Fetching `/in/slug/overlay/contact-info/` gives
 *  the contact-info payload without opening anything on screen. Only a blob
 *  whose request names this slug is trusted. */
export function parseContactInfoFromHtml(html: string, slug: string): ContactInfo | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const wanted = slug.toLowerCase();
  const wantedEncoded = encodeURIComponent(wanted);

  for (const datalet of Array.from(doc.querySelectorAll('code[id^="datalet-bpr-guid-"]'))) {
    let meta: unknown;
    try {
      meta = JSON.parse(datalet.textContent ?? '');
    } catch {
      continue;
    }
    if (!isObject(meta) || typeof meta.request !== 'string') continue;
    const request = meta.request.toLowerCase();
    if (!/contact/.test(request)) continue;
    if (!request.includes(wanted) && !request.includes(wantedEncoded)) continue;
    const body = typeof meta.body === 'string' ? doc.getElementById(meta.body) : null;
    if (!body) continue;
    try {
      const info = contactFromJson(JSON.parse(body.textContent ?? ''));
      if (info) return info;
    } catch {
      continue;
    }
  }

  const rendered = parseContactInfoModal(doc);
  return rendered && (rendered.email || rendered.phone || rendered.websites.length > 0) ? rendered : null;
}

/* ─── Full profile extraction ──────────────────────────────────────────────── */

const NAME_REJECT = /feed|linkedin|search|notifications|messaging|my network/i;

function findName(doc: Document): { name: string; el: Element | null; how: string } {
  const selectors = [
    'main section h1',
    'main h1',
    'h1.text-heading-xlarge',
    '[data-anonymize="person-name"]',
    'h1',
  ];
  for (const selector of selectors) {
    for (const el of Array.from(doc.querySelectorAll(selector))) {
      if (el.id === 'pv-contact-info') continue;
      const text = visibleText(el);
      if (text.length > 1 && !NAME_REJECT.test(text)) return { name: text, el, how: selector };
    }
  }
  const title = doc.title.split(/[-–—|•]/)[0]?.trim() ?? '';
  if (title.length > 1 && !/linkedin/i.test(title)) return { name: title, el: null, how: 'document.title' };
  return { name: '', el: null, how: 'not found' };
}

function findTopCard(doc: Document, nameEl: Element | null): Element {
  return (
    nameEl?.closest('section') ??
    nameEl?.closest('[data-view-name="profile-top-card"], div.ph5') ??
    doc.querySelector('main section, [data-view-name="profile-top-card"], section.artdeco-card') ??
    doc.querySelector('main') ??
    doc.body
  );
}

const NOISE = /connection|follower|contact info|mutual|message|\bconnect\b/i;

function findHeadline(topCard: Element, name: string): string {
  const selectors = [
    '.text-body-medium.break-words',
    '.text-body-medium',
    '[data-anonymize="headline"]',
    '[data-generated-suggestion-target]',
    '.top-card__headline',
  ];
  for (const selector of selectors) {
    for (const el of Array.from(topCard.querySelectorAll(selector))) {
      const text = visibleText(el);
      if (text.length > 2 && text !== name && !NOISE.test(text)) return text;
    }
  }
  return '';
}

function findLocation(topCard: Element, name: string, headline: string): string {
  const selectors = [
    'span.text-body-small.inline.t-black--light.break-words',
    '[data-anonymize="location"]',
    'span.text-body-small.inline',
    '.text-body-small',
    '.top-card__subline-item',
  ];
  for (const selector of selectors) {
    for (const el of Array.from(topCard.querySelectorAll(selector))) {
      if (el.querySelector('a[href*="contact-info"]')) continue;
      const text = clean(visibleText(el).replace(/·.*$/, ''));
      if (text.length > 2 && text !== name && text !== headline && !NOISE.test(text) && !/^\d/.test(text)) return text;
    }
  }
  return '';
}

function findCompanyBadge(topCard: Element): { company: string; how: string } {
  const button = topCard.querySelector('button[aria-label*="Current company"], [aria-label^="Current company"]');
  if (button) {
    const label = button.getAttribute('aria-label') ?? '';
    const match = label.match(/Current company:\s*(.+?)\.?\s*(?:Click to skip.*)?$/i);
    const company = clean(match?.[1] ?? visibleText(button));
    if (company) return { company, how: 'top-card "Current company" badge' };
  }
  for (const link of Array.from(topCard.querySelectorAll('a[href*="/company/"]'))) {
    const text = clean(visibleText(link).replace(/^Current company:?\s*/i, '').replace(/\blogo\b/i, ''));
    if (text.length > 1 && !NOISE.test(text)) return { company: text.split('\n')[0], how: 'top-card company link' };
  }
  return { company: '', how: '' };
}

function findAvatar(topCard: Element, doc: Document, name: string): string | null {
  const selectors = [
    'img.pv-top-card-profile-picture__image--show',
    'img.pv-top-card-profile-picture__image',
    'img[class*="pv-top-card-profile-picture"]',
    'img.presence-entity__image',
    'img.pv-top-card__photo',
    'img[alt*="profile picture" i]',
    'img[alt*="photo of" i]',
  ];
  const candidates = [
    ...selectors.map((selector) => topCard.querySelector<HTMLImageElement>(selector)),
    name ? topCard.querySelector<HTMLImageElement>(`img[alt="${name.replace(/"/g, '\\"')}"]`) : null,
    ...selectors.map((selector) => doc.querySelector<HTMLImageElement>(selector)),
  ];
  for (const img of candidates) {
    const src = img?.getAttribute('src') || img?.src || '';
    if (src && !/ghost-person|data:image\/gif/.test(src)) return src;
  }
  return null;
}

function findSection(doc: Document, anchorId: string): Element | null {
  const anchor = doc.querySelector(`#${anchorId}`);
  if (!anchor) return doc.querySelector(`[data-view-name*="profile-${anchorId}"]`);
  return anchor.closest('section') ?? (clean(anchor.textContent) ? anchor : anchor.parentElement);
}

function readAbout(doc: Document): string | null {
  const section = findSection(doc, 'about');
  if (!section) return null;
  const spans = Array.from(section.querySelectorAll('.inline-show-more-text span[aria-hidden="true"], span[aria-hidden="true"]'));
  const text = clean(spans.length > 0 ? spans.map((span) => span.textContent).join(' ') : section.textContent);
  const body = text.replace(/^About\s*/i, '').replace(/\s*…?\s*see more$/i, '').trim();
  return body.length > 5 ? body : null;
}

function readSkills(doc: Document): string[] {
  const section = findSection(doc, 'skills');
  const selectors = [
    'a[data-field="skill_card_skill_topic"] span[aria-hidden="true"]',
    '.pv-skill-category-entity__name span',
    '.t-bold span[aria-hidden="true"]',
    'li span[aria-hidden="true"]',
  ];
  const skills: string[] = [];
  for (const selector of selectors) {
    for (const el of Array.from((section ?? doc).querySelectorAll(selector))) {
      const text = clean(el.textContent);
      if (
        text.length > 1 &&
        text.length < 40 &&
        !text.includes('+') &&
        !/endorse|skill|show all/i.test(text) &&
        !skills.includes(text)
      ) {
        skills.push(text);
      }
    }
    if (skills.length > 0) break;
  }
  return skills.slice(0, 30);
}

function readJsonLd(doc: Document): Json | null {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(script.textContent ?? '');
      const items: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
      for (const item of items) {
        if (isObject(item) && (item['@type'] === 'Person' || (item.name && (item.jobTitle || item.worksFor)))) return item;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function extractProfile(doc: Document, url: string): ExtractionResult {
  const trace: string[] = [];
  const log = (message: string) => trace.push(message);

  if (!isLinkedInProfileUrl(url)) return { profile: null, trace: [`Not a profile URL: ${url}`] };
  const slug = profileSlugFromUrl(url) ?? '';
  log(`URL ${url} → slug "${slug}"`);

  const profile: ParsedCandidateProfile = {
    full_name: '',
    headline: '',
    current_title: '',
    current_company: '',
    location: '',
    linkedin_url: normalizeLinkedInUrl(url),
    avatar_url: null,
    about: null,
    skills: [],
    email: null,
    phone: null,
    websites: [],
    role_current: null,
  };

  const { name, el: nameEl, how } = findName(doc);
  profile.full_name = name;
  log(name ? `Name "${name}" (${how})` : 'Name not found');

  const topCard = findTopCard(doc, nameEl);
  profile.headline = findHeadline(topCard, name);
  log(profile.headline ? `Headline "${profile.headline}"` : 'Headline not found in top card');
  profile.location = findLocation(topCard, name, profile.headline);
  log(profile.location ? `Location "${profile.location}"` : 'Location not found in top card');

  const badge = findCompanyBadge(topCard);
  if (badge.company) log(`Company "${badge.company}" (${badge.how})`);
  else log('No "Current company" badge in top card');

  const role = extractExperience(doc, badge.company);
  if (role) {
    profile.current_title = role.title;
    profile.current_company = role.company || badge.company;
    profile.role_current = role.current;
    log(
      `Experience: "${role.title}" at "${role.company}"${role.current ? '' : ' (ended - no ongoing role listed)'}${
        badge.company && role.company && role.company.toLowerCase() !== badge.company.toLowerCase()
          ? ` - differs from badge "${badge.company}"; using experience`
          : ''
      }`,
    );
  } else {
    profile.current_company = badge.company;
    log('Experience section not found or empty');
  }

  if (!profile.current_title || !profile.current_company) {
    const position = slug ? extractVoyagerPosition(doc, slug) : null;
    if (position) {
      if (!profile.current_title) profile.current_title = position.title;
      if (!profile.current_company) profile.current_company = position.company;
      if (profile.role_current === null) profile.role_current = position.current;
      log(`Voyager payload: "${position.title}" at "${position.company}"`);
    } else {
      log('No usable Voyager position payload for this profile');
    }
  }

  if ((!profile.current_title || !profile.current_company) && profile.headline) {
    const parts = decomposeHeadline(profile.headline);
    if (!profile.current_title && parts.title) {
      profile.current_title = parts.title;
      log(`Title "${parts.title}" from headline`);
    }
    if (!profile.current_company && parts.company) {
      profile.current_company = parts.company;
      log(`Company "${parts.company}" from headline`);
    }
    if (!parts.title && !parts.company) log('Headline is not "title at company" shaped; nothing taken from it');
  }

  const ld = readJsonLd(doc);
  if (ld) {
    if (!profile.full_name && typeof ld.name === 'string') profile.full_name = clean(ld.name);
    if (!profile.current_title) {
      const jobTitle = Array.isArray(ld.jobTitle) ? ld.jobTitle[0] : ld.jobTitle;
      if (typeof jobTitle === 'string') profile.current_title = clean(jobTitle);
    }
    if (!profile.current_company) {
      const orgs = Array.isArray(ld.worksFor) ? ld.worksFor : [ld.worksFor];
      const first = orgs[0];
      if (isObject(first) && typeof first.name === 'string') profile.current_company = clean(first.name);
    }
    if (!profile.location) {
      const address = ld.address;
      if (typeof address === 'string') profile.location = clean(address);
      else if (isObject(address)) {
        profile.location = [address.addressLocality, address.addressRegion, address.addressCountry]
          .filter((part): part is string => typeof part === 'string')
          .join(', ');
      }
    }
    if (!profile.avatar_url) {
      const image = ld.image;
      if (typeof image === 'string') profile.avatar_url = image;
      else if (isObject(image) && typeof image.contentUrl === 'string') profile.avatar_url = image.contentUrl;
    }
    log('Filled gaps from Schema.org JSON-LD (public page)');
  }

  profile.avatar_url = profile.avatar_url ?? findAvatar(topCard, doc, name);

  profile.about = readAbout(doc);
  if (profile.about) {
    profile.email = findEmail(profile.about);
    profile.phone = findPhone(profile.about);
    if (profile.email || profile.phone) log(`Contact details found in About: ${[profile.email, profile.phone].filter(Boolean).join(', ')}`);
  }

  const modal = parseContactInfoModal(doc);
  if (modal) {
    profile.email = profile.email ?? modal.email;
    profile.phone = profile.phone ?? modal.phone;
    profile.websites = modal.websites;
    log(`Contact-info overlay is open: ${modal.email ?? 'no email'}, ${modal.phone ?? 'no phone'}, ${modal.websites.length} website(s)`);
  } else if (!profile.email && !profile.phone) {
    log('Contact info lives in the "Contact info" overlay; not open - use "Fetch contact info"');
  }

  profile.skills = readSkills(doc);
  if (profile.skills.length > 0) log(`${profile.skills.length} skills`);

  log(`Result: "${profile.full_name}" - ${profile.current_title || '(no title)'} at ${profile.current_company || '(no company)'}`);
  return { profile: profile.full_name ? profile : null, trace };
}

/** Entry point used by the content script; also callable via
 *  chrome.scripting.executeScript in older builds. */
export function extractLinkedInProfile(): ParsedCandidateProfile | null {
  return extractProfile(document, window.location.href).profile;
}
