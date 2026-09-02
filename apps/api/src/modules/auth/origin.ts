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
