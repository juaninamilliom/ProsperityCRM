import { describe, expect, it, beforeAll } from 'vitest';

/** `npm run seed` truncates the funnel tables and reads the same DATABASE_URL
 *  the migration runner reads, so a stale .env pointed at production is one
 *  command away from emptying the CRM. There is no down migration and no
 *  rollback. This guard is the only thing between those two facts.
 *
 *  The guard lives in scripts/, which is outside every workspace, so it is
 *  plain ESM that run-seed.mjs can import without a build step. The specifier
 *  below is computed at runtime on purpose: a non-literal specifier is never
 *  added to the TypeScript program, so there is no rootDir violation. Same
 *  reach-out-of-the-workspace shape as migrations.test.ts. */

type Verdict = {
  allowed: boolean;
  host: string | null;
  reason: 'no_url' | 'unparseable' | 'remote_host' | 'ambiguous_host' | null;
};

let seedTargetVerdict: (databaseUrl?: string, allowHost?: string) => Verdict;

beforeAll(async () => {
  const guardUrl = new URL('../../../../scripts/seed-guard.mjs', import.meta.url).href;
  ({ seedTargetVerdict } = await import(/* @vite-ignore */ guardUrl));
});

const local = (host: string) => `postgres://prosperity:pw@${host}:5432/prosperity_crm`;
const RENDER = 'postgres://prosperity:pw@dpg-abc123.oregon-postgres.render.com:5432/prosperity_crm';

describe('seedTargetVerdict', () => {
  it('allows a database on localhost', () => {
    expect(seedTargetVerdict(local('localhost'))).toEqual({
      allowed: true,
      host: 'localhost',
      reason: null,
    });
  });

  it('allows the loopback address', () => {
    expect(seedTargetVerdict(local('127.0.0.1')).allowed).toBe(true);
  });

  it('allows the IPv6 loopback, with the brackets stripped from the host', () => {
    expect(seedTargetVerdict(local('[::1]'))).toEqual({
      allowed: true,
      host: '::1',
      reason: null,
    });
  });

  it('allows the docker host alias', () => {
    expect(seedTargetVerdict(local('host.docker.internal')).allowed).toBe(true);
  });

  it('refuses a remote host when no override is set', () => {
    expect(seedTargetVerdict(RENDER)).toEqual({
      allowed: false,
      host: 'dpg-abc123.oregon-postgres.render.com',
      reason: 'remote_host',
    });
  });

  it('refuses a remote host when the override names a different host', () => {
    // The override must name the host being wiped. A truthy flag left in a
    // shell profile would defeat the whole guard.
    expect(seedTargetVerdict(RENDER, 'staging.example.com').allowed).toBe(false);
  });

  it('refuses when the override is merely truthy rather than a hostname', () => {
    expect(seedTargetVerdict(RENDER, 'true').allowed).toBe(false);
    expect(seedTargetVerdict(RENDER, '1').allowed).toBe(false);
  });

  it('allows a remote host when the override names it exactly', () => {
    expect(seedTargetVerdict(RENDER, 'dpg-abc123.oregon-postgres.render.com')).toEqual({
      allowed: true,
      host: 'dpg-abc123.oregon-postgres.render.com',
      reason: null,
    });
  });

  it('refuses when DATABASE_URL is absent or empty', () => {
    expect(seedTargetVerdict(undefined)).toEqual({
      allowed: false,
      host: null,
      reason: 'no_url',
    });
    expect(seedTargetVerdict('').reason).toBe('no_url');
  });

  it('refuses a connection string it cannot parse', () => {
    expect(seedTargetVerdict('not a url')).toEqual({
      allowed: false,
      host: null,
      reason: 'unparseable',
    });
  });

  it('refuses a parseable URL that carries no host', () => {
    expect(seedTargetVerdict('postgres:///var/run/postgresql').allowed).toBe(false);
  });

  /** node-postgres does not resolve the host the way the URL parser does: a
   *  `host` query parameter WINS over the URL authority. So
   *  `postgres://u:p@localhost/db?host=prod.example.com` reads as localhost
   *  here and connects to prod.example.com there. A guard that disagrees with
   *  its client is worse than no guard - it prints an affirmative "seeding
   *  localhost" at the moment the operator decides whether to hit enter.
   *
   *  Rather than reimplement libpq's precedence, refuse the shape outright. */
  describe('when the connection string can mean two different hosts', () => {
    it('never reports localhost for a string that connects somewhere else', () => {
      // The original defect: the guard read the URL authority, pg read the
      // parameter, and run-seed printed "Seeding localhost" before truncating
      // production.
      const verdict = seedTargetVerdict(
        'postgres://u:pw@localhost:5432/db?host=dpg-prod.oregon-postgres.render.com',
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.host).not.toBe('localhost');
    });

    it('reads the parameter as the real host, so the override names something that works', () => {
      // Refusing outright was too blunt: the parameter is also the standard
      // way to name a Unix socket directory, which is how Postgres.app and
      // Homebrew Postgres are reached on macOS.
      expect(seedTargetVerdict('postgres://u:pw@localhost:5432/db?host=prod.example.com')).toEqual({
        allowed: false,
        host: 'prod.example.com',
        reason: 'remote_host',
      });
      expect(
        seedTargetVerdict('postgres://u:pw@localhost:5432/db?host=prod.example.com', 'prod.example.com')
          .allowed,
      ).toBe(true);
    });

    it('allows a unix socket directory, which is always local', () => {
      expect(seedTargetVerdict('postgresql:///prosperity?host=/tmp').allowed).toBe(true);
      expect(seedTargetVerdict('postgresql:///prosperity?host=/var/run/postgresql').allowed).toBe(true);
    });

    it('reads the LAST host parameter, because that is the one pg uses', () => {
      // URLSearchParams.get returns the first; pg-connection-string iterates
      // and overwrites, so the last wins. Reading the first let a string that
      // connects to production report an allowed socket directory.
      const verdict = seedTargetVerdict(
        'postgres://u:pw@localhost:5432/db?host=/var/run/postgresql&host=prod.example.com',
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.host).toBe('prod.example.com');
    });

    it('treats a relative path as a hostname, because pg only sockets on a leading slash', () => {
      expect(seedTargetVerdict('postgres://u:pw@localhost:5432/db?host=./sockets').allowed).toBe(false);
      expect(seedTargetVerdict('postgres://u:pw@localhost:5432/db?host=.prod.example.com').allowed).toBe(
        false,
      );
    });

    it('lets a trailing empty host send it back to the URL authority, as the client does', () => {
      // pg overwrites on EVERY occurrence and only then tests truthiness, so a
      // trailing empty value makes config.host falsy and pg falls back to the
      // authority. Filtering the empty value away instead kept the earlier
      // one - and reported an allowed localhost for a string aimed at prod.
      expect(
        seedTargetVerdict(
          'postgres://u:pw@dpg-prod.oregon-postgres.render.com:5432/db?host=localhost&host=',
        ),
      ).toEqual({ allowed: false, host: 'dpg-prod.oregon-postgres.render.com', reason: 'remote_host' });

      expect(
        seedTargetVerdict(
          'postgres://u:pw@dpg-prod.oregon-postgres.render.com:5432/db?host=/var/run/postgresql&host=',
        ).allowed,
      ).toBe(false);
    });

    it('still honours the last non-empty value when one follows an empty one', () => {
      expect(seedTargetVerdict('postgres://u:pw@localhost/db?host=&host=prod.example.com').host).toBe(
        'prod.example.com',
      );
    });

    it('treats an empty host parameter as absent, as the client does', () => {
      expect(seedTargetVerdict('postgres://u:pw@localhost:5432/db?host=')).toEqual({
        allowed: true,
        host: 'localhost',
        reason: null,
      });
    });

    it('allows a parameter that names a local host', () => {
      expect(seedTargetVerdict('postgres://u:pw@example.com:5432/db?host=localhost').allowed).toBe(true);
    });

    it('refuses hostaddr the same way', () => {
      expect(seedTargetVerdict('postgres://u:pw@localhost:5432/db?hostaddr=10.0.0.5').reason).toBe(
        'ambiguous_host',
      );
    });

    it('refuses when the override names the URL authority rather than the real host', () => {
      expect(
        seedTargetVerdict('postgres://u:pw@localhost:5432/db?host=prod.example.com', 'localhost').allowed,
      ).toBe(false);
    });

    it('still allows an ordinary local string with unrelated parameters', () => {
      expect(seedTargetVerdict('postgres://u:pw@localhost:5432/db?sslmode=disable').allowed).toBe(true);
    });
  });
});
