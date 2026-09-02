/** Decides whether `npm run seed` may run against a given connection string.
 *
 *  seed.sql truncates the BD and pipeline tables and then deletes people and
 *  companies. It reads the same DATABASE_URL the migration runner reads, so
 *  anyone who has ever pointed their .env at a deployed database to run a
 *  migration is one command away from emptying the CRM. There are no down
 *  migrations and no rollback.
 *
 *  The override must NAME the host being wiped. A truthy flag would be too
 *  easy to leave set in a shell profile, which is exactly the situation this
 *  guard exists to survive.
 *
 *  Plain ESM, and outside every workspace, so run-seed.mjs can import it with
 *  no build step. Tested from apps/api/src/db/seed-guard.test.ts. */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

/**
 * @param {string} [databaseUrl] the connection string to check
 * @param {string} [allowHost] value of SEED_ALLOW_HOST, if set
 * @returns {{ allowed: boolean, host: string | null, reason: 'no_url' | 'unparseable' | 'remote_host' | null }}
 */
export function seedTargetVerdict(databaseUrl, allowHost) {
  if (!databaseUrl) {
    return { allowed: false, host: null, reason: 'no_url' };
  }

  let hostname;
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    return { allowed: false, host: null, reason: 'unparseable' };
  }

  // The WHATWG URL parser keeps the brackets on an IPv6 literal, so [::1]
  // would never match a host anyone types into SEED_ALLOW_HOST.
  const host = hostname.replace(/^\[/, '').replace(/\]$/, '');

  if (!host) {
    return { allowed: false, host: null, reason: 'unparseable' };
  }

  if (LOCAL_HOSTS.has(host)) {
    return { allowed: true, host, reason: null };
  }

  if (allowHost !== undefined && allowHost.trim() === host) {
    return { allowed: true, host, reason: null };
  }

  return { allowed: false, host, reason: 'remote_host' };
}
