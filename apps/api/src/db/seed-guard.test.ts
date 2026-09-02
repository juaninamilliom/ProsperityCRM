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
  reason: 'no_url' | 'unparseable' | 'remote_host' | null;
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
});
