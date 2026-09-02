/** Which origin a sign-in link may point at.
 *
 *  The magic-link URL used to be built from the caller's own Origin header, on
 *  a route mounted above the auth middleware. Anyone could make the real
 *  sender email a victim a genuine sign-in link pointing at their own host,
 *  and CORS does not help: it only withholds a response header from browsers,
 *  it does not block a scripted request.
 *
 *  This is deliberately NOT isAllowedOrigin from ../../cors.js. That function
 *  trusts any localhost origin and trusts everything when the list is empty.
 *  Both are correct for CORS and both would re-open this hole - an unset
 *  CORS_ORIGINS in production would make the attacker's header trusted again.
 *  The CORS rule falls open where this one must fall closed. */

const normalize = (origin: string): string => origin.trim().replace(/\/+$/, '');

/**
 * Returns `appBaseUrl` unless `originHeader` exactly matches an allowlisted
 * origin. The result never carries a trailing slash, so callers can append a
 * path directly.
 */
export function resolveTrustedOrigin(
  originHeader: string | undefined,
  allowedOrigins: string[],
  appBaseUrl: string,
): string {
  const fallback = normalize(appBaseUrl);
  const header = originHeader ? normalize(originHeader) : '';
  if (!header) return fallback;

  const allowed = allowedOrigins.map(normalize).filter(Boolean);
  return allowed.includes(header) ? header : fallback;
}

/** Where sign-in links point when the caller's origin is not trusted.
 *
 *  Falls through on anything that normalises to nothing, not just on null and
 *  undefined: `APP_BASE_URL=` in a .env yields '', and `APP_BASE_URL=/` yields
 *  '' once the trailing slash is stripped. Either would make every emailed
 *  link the relative "/login?magic_token=..." - unclickable, with the token
 *  already spent, and nothing fetches it so nothing notices. */
export function resolveAppBaseUrl(
  appBaseUrl: string | undefined,
  allowedOrigins: string[],
): string {
  // Normalise BEFORE testing truthiness: '/' is truthy and normalises to '',
  // which is the relative link this function exists to prevent.
  const configured = normalize(appBaseUrl ?? '');
  if (configured) return configured;

  const firstAllowed = allowedOrigins.map(normalize).find(Boolean);
  if (firstAllowed) return firstAllowed;

  return 'http://localhost:5173';
}
