/**
 * LinkedIn profile extraction.
 *
 * Runs inside the LinkedIn tab (content script) against the logged-in DOM.
 * LinkedIn serves two profile layouts: the 2025 React layout (hashed class
 * names, `<section componentkey>`, `data-testid="profile_…"`, name in an
 * `<h2>`, contact details in a `<dialog>`) and the legacy Ember layout
 * (`h1.text-heading-xlarge`, `#experience`, `pvs-*` classes, artdeco modal).
 * Both are handled; the new layout is tried first.
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
  /** null = unknown; false = the top experience entry has an end date. */
  role_current: boolean | null;
  /** Where current_title came from. Only 'experience' is trustworthy; the
   *  panel keeps re-reading a lazily rendered page until it gets that. */
  role_source: RoleSource | null;
}

export type RoleSource = 'experience' | 'voyager' | 'headline' | 'json-ld';

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

const ABBREVIATION = /\b(inc|ltd|corp|co|llc|gmbh|pty|plc|s\.a|b\.v)\.$/i;

function cleanCompany(value: string): string {
  const company = clean(value.split(/\s*[,(|]\s*|\s+[-–—]\s+/)[0]);
  return ABBREVIATION.test(company) ? company : company.replace(/[.…]+$/, '');
}

/** "Founder of X; Partner at Y | Ex-Z" → the first segment, split on the
 *  joiner. A slogan ("Helping teams ship faster") yields nothing rather than
 *  a made-up title. */
export function decomposeHeadline(headline: string): { title: string; company: string } {
  const primary = clean(headline).split(/\s*[;|•·]\s*|\s+[-–—]\s+|\.\s+(?=[A-Z])/)[0] ?? '';
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
    // "CTO, Acme" names a company; "Co-Founder, LinkedIn, Manas AI & Inflection AI"
    // is a list of affiliations and only the role is safe to take.
    const parts = primary.split(',').map(clean);
    if (looksLikeTitle(parts[0])) {
      return { title: parts[0], company: parts.length === 2 && !looksLikeTitle(parts[1]) ? cleanCompany(parts[1]) : '' };
    }
  }

  return looksLikeTitle(primary) ? { title: primary, company: '' } : { title: '', company: '' };
}

/* ─── 2025 layout ──────────────────────────────────────────────────────────── */

export function isNewProfileUi(doc: Document): boolean {
  return Boolean(
    doc.querySelector(
      '[data-testid^="profile_ExperienceTopLevelSection"], main section[componentkey], main a[href*="/in/"] h2',
    ),
  );
}

/** A profile card in the 2025 layout: the `<section>` (or nearest keyed
 *  ancestor) around the `<h2>` heading that matches. */
export function sectionByHeading(doc: Document, heading: RegExp): Element | null {
  const h2 = Array.from(doc.querySelectorAll('main h2')).find((el) => heading.test(clean(el.textContent)));
  if (!h2) return null;
  let node: Element | null = h2;
  for (let depth = 0; depth < 10 && node?.parentElement; depth += 1) {
    node = node.parentElement;
    if (node.tagName === 'SECTION' || node.hasAttribute('componentkey') || node.hasAttribute('data-testid')) return node;
  }
  return h2.parentElement;
}

interface TopCard {
  name: string;
  nameHow: string;
  headline: string;
  location: string;
  badgeCompany: string;
  badgeHow: string;
  avatar: string | null;
}

const DEGREE = /^[·•]?\s*(\d(st|nd|rd|th)|·)$/i;
const PRONOUNS = /^[A-Za-z]+\/[A-Za-z]+(\/[A-Za-z]+)?$/;
const SOCIAL = /followers|connections|mutual|followed by/i;
const SCHOOL = /universit|school|college|institute|academy|polytechnic|facult|lycée|hochschule/i;

function newUiTopCard(doc: Document): TopCard | null {
  const contact = doc.querySelector('main a[href*="/overlay/contact-info"]');
  let card: Element | null = contact?.parentElement ?? null;
  while (card && card !== doc.body && !SOCIAL.test(card.textContent ?? '')) card = card.parentElement;
  if (!card || card === doc.body) {
    const h2 = doc.querySelector('main a[href*="/in/"] h2, main h2');
    card = h2?.closest('section') ?? h2?.parentElement?.parentElement?.parentElement ?? null;
  }
  if (!card) return null;

  const nameEl = card.querySelector('h2');
  const name = clean(nameEl?.textContent);

  const badges = Array.from(card.querySelectorAll('[role="button"]'))
    .map((el) => clean(el.querySelector('p, span')?.textContent ?? el.textContent))
    .filter((text) => text && !SOCIAL.test(text));
  const summary = badges.join(' · ');

  const contactP = contact?.closest('p') ?? contact;
  const plain: Element[] = [];
  let contactIndex = -1;
  for (const p of Array.from(card.querySelectorAll('p'))) {
    if (p.closest('[role="button"]') || p.querySelector('p')) continue;
    const text = clean(p.textContent);
    if (p === contactP || p.contains(contact as Node)) {
      contactIndex = plain.length;
      continue;
    }
    if (!text || DEGREE.test(text) || PRONOUNS.test(text) || SOCIAL.test(text) || text === name) continue;
    if (summary && (text === summary || badges.includes(text) || badges.some((b) => text.startsWith(`${b} · `)))) continue;
    if (/^(Contact info|Message|Connect|Follow|More)$/i.test(text)) continue;
    plain.push(p);
  }
  const headline = clean(plain[0]?.textContent);
  const locationEl = contactIndex > 0 ? plain[contactIndex - 1] : plain[1];
  const location = locationEl && locationEl !== plain[0] ? clean(locationEl.textContent) : contactIndex > 0 ? '' : '';

  let badgeCompany = '';
  let badgeHow = '';
  if (badges.length > 0) {
    const first = badges[0];
    if (badges.length >= 2 || !SCHOOL.test(first)) {
      badgeCompany = first;
      badgeHow = 'top-card company badge';
    }
  }

  // The photo sits in a sibling column of the text block, so widen the
  // search a few levels - but never past <main>, where post authors appear.
  let photoScope: Element | null = card;
  let avatar: HTMLImageElement | null = null;
  for (let depth = 0; depth < 3 && photoScope && photoScope.tagName !== 'MAIN'; depth += 1) {
    avatar =
      photoScope.querySelector<HTMLImageElement>('img[src*="profile-displayphoto"]') ??
      Array.from(photoScope.querySelectorAll<HTMLImageElement>('img[src]')).find(
        (img) => !/company-logo|school-logo|ghost|data:image/.test(img.getAttribute('src') ?? ''),
      ) ??
      null;
    if (avatar) break;
    photoScope = photoScope.parentElement;
  }

  return {
    name,
    nameHow: nameEl ? 'top-card h2' : 'not found',
    headline,
    location,
    badgeCompany,
    badgeHow,
    avatar: avatar?.getAttribute('src') || null,
  };
}

function companyOf(line: string): string {
  return clean(line.split(/\s+[·•]\s+/)[0]);
}

/** One experience entry in the 2025 layout: a run of `<p>`s - title, "Company
 *  · Employment type", date range, location - plus a description box. Grouped
 *  roles at one employer carry several date lines, each preceded by a title. */
function parseNewUiItem(item: Element): RoleMatch | null {
  const lines = Array.from(item.querySelectorAll('p'))
    .filter((p) => !p.querySelector('[data-testid="expandable-text-box"], p') && !p.closest('[data-testid="expandable-text-box"]'))
    .map((p) => clean(p.textContent))
    .filter((text) => text && text.length <= 120 && !/^more$/i.test(text));
  if (lines.length === 0) return null;

  const dateIndexes = lines.map((line, index) => (DATE_LINE.test(line) ? index : -1)).filter((index) => index >= 0);
  if (dateIndexes.length <= 1) {
    const dateLine = dateIndexes.length ? lines[dateIndexes[0]] : undefined;
    const companyLine = lines[1] && lines[1] !== dateLine ? lines[1] : '';
    return { title: lines[0], company: companyOf(companyLine), current: dateLine ? ONGOING.test(dateLine) : true };
  }

  const company = companyOf(lines[0]);
  const roles = dateIndexes
    .map((index) => ({ title: lines[index - 1] ?? '', current: ONGOING.test(lines[index]) }))
    .filter((role) => role.title && role.title !== lines[0] && !DATE_LINE.test(role.title));
  const pick = roles.find((role) => role.current) ?? roles[0];
  return pick ? { title: pick.title, company, current: pick.current } : null;
}

function newUiExperienceEntries(doc: Document): RoleMatch[] {
  const section =
    doc.querySelector('[data-testid^="profile_ExperienceTopLevelSection"]') ?? sectionByHeading(doc, /^Experience/);
  if (!section) return [];
  let items = Array.from(section.querySelectorAll('[componentkey^="entity-collection-item-"]'));
  if (items.length === 0) {
    items = Array.from(section.querySelectorAll('a[href*="/company/"]'))
      .map((link): Element | null => link.parentElement?.parentElement ?? null)
      .filter((el): el is Element => el !== null)
      .filter((el, index, all) => all.indexOf(el) === index);
  }
  return items.map(parseNewUiItem).filter((entry): entry is RoleMatch => entry !== null);
}

function newUiSkills(doc: Document): string[] {
  const section = sectionByHeading(doc, /^(Top )?Skills/i);
  if (!section) return [];
  const skills: string[] = [];
  for (const span of Array.from(section.querySelectorAll('p span, p'))) {
    if (span.children.length > 0 || span.closest('a, h2, button')) continue;
    const text = clean(span.textContent);
    if (text.length > 1 && text.length <= 60 && !/endorsement|show all|skills/i.test(text) && !skills.includes(text)) skills.push(text);
  }
  return skills.slice(0, 30);
}

function newUiAbout(doc: Document): string | null {
  const section = sectionByHeading(doc, /^About$/);
  if (!section) return null;
  const box = section.querySelector('[data-testid="expandable-text-box"]');
  const text = clean(box ? box.textContent : section.textContent).replace(/^About\s*/i, '').replace(/\s*…?\s*more$/i, '');
  return text.length > 5 ? text : null;
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
  const modern = newUiExperienceEntries(doc);
  if (modern.length > 0) return modern;
  return experienceItems(doc)
    .map(parseEntry)
    .filter((entry): entry is RoleMatch => entry !== null);
}

/** The top entry of the Experience stack is the current role - LinkedIn lists
 *  ongoing roles first, most recent first, so if the top one has ended, so has
 *  everything under it and the caller flags it. The headline and the top-card
 *  badge are the member's own summary and are deliberately not consulted. */
export function extractExperience(doc: Document): RoleMatch | null {
  return extractExperienceEntries(doc)[0] ?? null;
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

/** LinkedIn wraps outbound links in an interstitial (`/safety/go?url=…`,
 *  `/redir/redirect?url=…`); unwrap it. Falls back to the link text when the
 *  href is not a usable URL but the text is a bare domain. */
function canonicalWebsite(href: string, text = ''): string | null {
  let url = parseUrl(href);
  if (url && /(^|\.)linkedin\.com$/i.test(url.hostname)) {
    const wrapped = url.searchParams.get('url');
    url = wrapped ? parseUrl(wrapped) : null;
  }
  if (url && !/(^|\.)linkedin\.com$/i.test(url.hostname)) return `${url.origin}${url.pathname}`;
  const domain = clean(text).replace(/\s*\(.*\)$/, '');
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(domain) && !/linkedin\.com/i.test(domain)) return `https://${domain}`;
  return null;
}

const CONTACT_LABEL = /^(e-?mail|phone|mobile|tel|websites?|site|blog|portfolio|twitter|x|birthday|connected|address|im|.*[’']s profile)$/i;

function labelText(el: Element): string {
  return clean(el.textContent).replace(/\s*\(.*\)$/, '');
}

function contactDialog(root: ParentNode): Element | null {
  const anchor = root.querySelector('#pv-contact-info');
  if (anchor) return anchor.closest('[role="dialog"], .artdeco-modal') ?? anchor.parentElement;
  const dialogs = Array.from(
    root.querySelectorAll('dialog[open], dialog[data-testid="dialog"], [role="dialog"], .artdeco-modal, .pv-contact-info'),
  );
  return (
    dialogs.find(
      (dialog) =>
        /contact info/i.test(clean(dialog.querySelector('header, h1, h2')?.textContent)) ||
        dialog.querySelector('a[href^="mailto:"], a[href^="tel:"]') ||
        Array.from(dialog.querySelectorAll('h3, h2, p')).some((el) => CONTACT_LABEL.test(labelText(el))),
    ) ?? null
  );
}

/** Label rows: in the legacy modal each `<section>` has an `<h3>` header; in
 *  the 2025 `<dialog>` a `<p>` label is followed by sibling `<p>` values. Both
 *  are "a label element, then its following siblings until the next label". */
function contactRows(dialog: Element): { label: string; values: Element[] }[] {
  const rows: { label: string; values: Element[] }[] = [];
  const labels = Array.from(dialog.querySelectorAll('h3, h2, p')).filter(
    (el) => !el.closest('header') && el.children.length <= 1 && CONTACT_LABEL.test(labelText(el)),
  );
  for (const label of labels) {
    const values: Element[] = [];
    let sibling = label.nextElementSibling;
    while (sibling && !labels.includes(sibling)) {
      values.push(sibling);
      sibling = sibling.nextElementSibling;
    }
    rows.push({ label: labelText(label).toLowerCase(), values });
  }
  return rows;
}

/** True once the overlay has rendered its rows (the "<name>'s profile" row
 *  is always present), as opposed to the empty shell shown while loading. */
export function isContactOverlayRendered(root: ParentNode): boolean {
  const dialog = contactDialog(root);
  return Boolean(dialog && (contactRows(dialog).length > 0 || dialog.querySelector('a[href^="mailto:"]')));
}

/** Reads the "Contact info" overlay when it is open. Returns null when it is
 *  not; an empty ContactInfo when it is open but the person shares nothing. */
export function parseContactInfoModal(root: ParentNode): ContactInfo | null {
  const dialog = contactDialog(root);
  if (!dialog) return null;

  const info: ContactInfo = { email: null, phone: null, websites: [] };
  for (const { label, values } of contactRows(dialog)) {
    const text = clean(values.map((el) => el.textContent).join(' '));
    if (/^e-?mail/.test(label)) {
      const link = values.map((el) => el.querySelector('a[href^="mailto:"]') ?? (el.matches('a[href^="mailto:"]') ? el : null)).find(Boolean);
      const fromHref = link?.getAttribute('href')?.replace(/^mailto:/i, '').split('?')[0];
      info.email = info.email ?? (fromHref ? decodeURIComponent(fromHref) : findEmail(text));
    } else if (/^(phone|mobile|tel)/.test(label)) {
      const link = values.map((el) => el.querySelector('a[href^="tel:"]')).find(Boolean);
      const fromHref = link?.getAttribute('href')?.replace(/^tel:/i, '');
      info.phone = info.phone ?? (fromHref ? decodeURIComponent(fromHref) : findPhone(text));
    } else if (/^(websites?|site|blog|portfolio)/.test(label)) {
      for (const el of values) {
        for (const link of Array.from(el.querySelectorAll('a[href]')).concat(el.matches('a[href]') ? [el] : [])) {
          const site = canonicalWebsite(link.getAttribute('href') ?? '', link.textContent ?? '');
          if (site && !info.websites.includes(site)) info.websites.push(site);
        }
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
  const modern = newUiAbout(doc);
  if (modern) return modern;
  const section = findSection(doc, 'about');
  if (!section) return null;
  const spans = Array.from(section.querySelectorAll('.inline-show-more-text span[aria-hidden="true"], span[aria-hidden="true"]'));
  const text = clean(spans.length > 0 ? spans.map((span) => span.textContent).join(' ') : section.textContent);
  const body = text.replace(/^About\s*/i, '').replace(/\s*…?\s*see more$/i, '').trim();
  return body.length > 5 ? body : null;
}

function readSkills(doc: Document): string[] {
  const modern = newUiSkills(doc);
  if (modern.length > 0) return modern;
  const section = findSection(doc, 'skills');
  if (!section) return [];
  const selectors = [
    'a[data-field="skill_card_skill_topic"] span[aria-hidden="true"]',
    '.pv-skill-category-entity__name span',
    '.t-bold span[aria-hidden="true"]',
    'li span[aria-hidden="true"]',
  ];
  const skills: string[] = [];
  for (const selector of selectors) {
    for (const el of Array.from(section.querySelectorAll(selector))) {
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
    role_source: null,
  };

  const modern = isNewProfileUi(doc) ? newUiTopCard(doc) : null;
  let topCard: Element;
  let badge: { company: string; how: string };
  if (modern) {
    log('Layout: 2025 profile (section/componentkey)');
    profile.full_name = modern.name;
    profile.headline = modern.headline;
    profile.location = modern.location;
    profile.avatar_url = modern.avatar;
    badge = { company: modern.badgeCompany, how: modern.badgeHow };
    topCard = doc.querySelector('main') ?? doc.body;
    log(modern.name ? `Name "${modern.name}" (${modern.nameHow})` : 'Name not found in top card');
    log(modern.headline ? `Headline "${modern.headline}"` : 'Headline not found in top card');
    log(modern.location ? `Location "${modern.location}"` : 'Location not found in top card');
  } else {
    log('Layout: legacy profile');
    const { name, el: nameEl, how } = findName(doc);
    profile.full_name = name;
    log(name ? `Name "${name}" (${how})` : 'Name not found');
    topCard = findTopCard(doc, nameEl);
    profile.headline = findHeadline(topCard, name);
    log(profile.headline ? `Headline "${profile.headline}"` : 'Headline not found in top card');
    profile.location = findLocation(topCard, name, profile.headline);
    log(profile.location ? `Location "${profile.location}"` : 'Location not found in top card');
    badge = findCompanyBadge(topCard);
  }
  if (badge.company) log(`Company "${badge.company}" (${badge.how})`);
  else log('No "Current company" badge in top card');
  const name = profile.full_name;

  const role = extractExperience(doc);
  if (role) {
    profile.current_title = role.title;
    profile.current_company = role.company || badge.company;
    profile.role_current = role.current;
    profile.role_source = 'experience';
    log(
      `Experience (top entry): "${role.title}" at "${role.company}"${role.current ? '' : ' - ended'}${
        badge.company && role.company && role.company.toLowerCase() !== badge.company.toLowerCase()
          ? ` (badge says "${badge.company}"; the experience stack wins)`
          : ''
      }`,
    );
  } else {
    profile.current_company = badge.company;
    log('Experience section not rendered yet or empty - title will be re-read');
  }

  if (!profile.current_title || !profile.current_company) {
    const position = slug ? extractVoyagerPosition(doc, slug) : null;
    if (position) {
      if (!profile.current_title) {
        profile.current_title = position.title;
        profile.role_source = 'voyager';
      }
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
      profile.role_source = 'headline';
      log(`Title "${parts.title}" from headline (placeholder until the Experience section renders)`);
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
      if (typeof jobTitle === 'string') {
        profile.current_title = clean(jobTitle);
        profile.role_source = 'json-ld';
      }
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

  if (!profile.full_name) {
    const title = doc.title.split(/[-–—|•]/)[0]?.trim() ?? '';
    if (title.length > 1 && !/linkedin/i.test(title)) {
      profile.full_name = title;
      log(`Name "${title}" (document.title fallback)`);
    }
  }
  profile.avatar_url = profile.avatar_url ?? (modern ? null : findAvatar(topCard, doc, name));

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
