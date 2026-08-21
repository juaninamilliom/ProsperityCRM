/** LinkedIn serves one profile under many spellings - regional hosts, the
 *  mobile host, tracking query strings, trailing slashes, mixed case. The
 *  partial unique index on people.linkedin_url only works if they all collapse
 *  to one string first, so this is the dedupe primitive for capture in P2. */
const SEGMENT = /^\/(in|company)\/([^/?#]+)/;

export function normalizeLinkedInUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    // Bare hosts ("linkedin.com/in/x") have no protocol for URL() to parse.
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;

  const match = SEGMENT.exec(parsed.pathname);
  if (!match) return null;

  const [, kind, slug] = match;
  // Slugs are case-insensitive, so lowercase - but that would also lowercase
  // the hex inside percent-escapes, and RFC 3986 wants those uppercase. A
  // non-ASCII slug would otherwise normalise to a string LinkedIn never serves.
  const canonical = slug.toLowerCase().replace(/%[0-9a-f]{2}/g, (escape) => escape.toUpperCase());
  return `https://www.linkedin.com/${kind}/${canonical}`;
}
