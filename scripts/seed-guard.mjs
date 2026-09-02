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

/** libpq, and therefore node-postgres, lets a `host` query parameter override
 *  the URL authority. The WHATWG URL parser does not, so
 *  `postgres://u:pw@localhost/db?host=prod.example.com` reads as localhost here
 *  and connects to prod.example.com there.
 *
 *  A guard that disagrees with its own client is worse than no guard: it prints
 *  an affirmative "seeding localhost" at the moment the operator is deciding
 *  whether to hit enter, and then truncates production. So read the same host
 *  the client will.
 *
 *  The parameter is also the standard way to name a Unix socket directory,
 *  which is how Postgres.app and Homebrew Postgres are reached on macOS. `pg`
 *  decides socket-versus-TCP on a LEADING SLASH alone, so this matches that
 *  exactly - a relative path like ./sockets is a TCP hostname to the client,
 *  and must not be waved through as local.
 *
 *  `hostaddr` is a different matter: only the native bindings consume it, so
 *  this script cannot tell what it would do, and it refuses rather than guess. */
const SOCKET_DIRECTORY = /^\//;

/**
 * @param {string} [databaseUrl] the connection string to check
 * @param {string} [allowHost] value of SEED_ALLOW_HOST, if set
 * @returns {{ allowed: boolean, host: string | null, reason: 'no_url' | 'unparseable' | 'remote_host' | 'ambiguous_host' | null }}
 */
export function seedTargetVerdict(databaseUrl, allowHost) {
  if (!databaseUrl) {
    return { allowed: false, host: null, reason: 'no_url' };
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { allowed: false, host: null, reason: 'unparseable' };
  }

  if (url.searchParams.getAll('hostaddr').some(Boolean)) {
    return { allowed: false, host: null, reason: 'ambiguous_host' };
  }

  // pg-connection-string iterates every parameter and overwrites, then tests
  // truthiness ONCE at the end. So the last value wins even when it is empty,
  // and an empty last value sends the client back to the URL authority.
  //
  // Filtering empties out before picking the last is not the same rule, and
  // the difference is dangerous: `?host=localhost&host=` made this report an
  // allowed localhost while pg connected to the remote authority.
  const hostParams = url.searchParams.getAll('host');
  const lastHost = hostParams.length > 0 ? hostParams[hostParams.length - 1] : null;
  const override = lastHost ? lastHost : null;

  if (override !== null && SOCKET_DIRECTORY.test(override)) {
    return { allowed: true, host: override, reason: null };
  }

  // The WHATWG URL parser keeps the brackets on an IPv6 literal, so [::1]
  // would never match a host anyone types into SEED_ALLOW_HOST.
  const host = (override ?? url.hostname)
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .toLowerCase();

  if (!host) {
    return { allowed: false, host: null, reason: 'unparseable' };
  }

  if (LOCAL_HOSTS.has(host)) {
    return { allowed: true, host, reason: null };
  }

  if (allowHost !== undefined && allowHost.trim().toLowerCase() === host) {
    return { allowed: true, host, reason: null };
  }

  return { allowed: false, host, reason: 'remote_host' };
}
