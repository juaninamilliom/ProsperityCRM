/** Which browsers may call the API.
 *
 *  Only CORS_ORIGINS decides for deployed clients. A wildcard on a shared
 *  hosting domain (*.vercel.app) would let every tenant of that host make
 *  credentialed requests, so there is none. An empty list allows everything,
 *  which keeps a fresh checkout working before the variable is set — set it
 *  in production. */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  if (LOCAL_ORIGIN.test(origin)) return true;

  const normalized = allowed.map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
  if (normalized.length === 0) return true;
  return normalized.includes(origin);
}
