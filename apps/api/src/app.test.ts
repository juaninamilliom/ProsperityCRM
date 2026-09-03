import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Mount order is the only authentication gate this API has.
 *
 *  app.ts registers /health, /admin and /auth, then app.use(authMiddleware),
 *  then every other router. A router that moves above that line becomes
 *  public, and nothing else in the repo would notice: no type error, no lint
 *  error, and every existing test still green, because none of them exercises
 *  a route.
 *
 *  The check is deny-by-default. An earlier version enumerated what it found
 *  above the line with a single-quote, single-line regex - so a mount written
 *  with double quotes, backticks, an array path, or split across two lines
 *  landed in NEITHER list and the suite passed green. The multi-line case
 *  needs no mistake at all: add one middleware argument, cross the 100-column
 *  print width, and a formatter switches the gate off as a side effect.
 *
 *  Runs in under a second with no database. new Pool() does not connect - it
 *  connects on first query - and the middleware rejects an unauthenticated
 *  request before any handler runs. */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.resolve(HERE, 'app.ts'), 'utf8');

/** Registered before the auth middleware on purpose: /auth is how a token is
 *  obtained in the first place, and /admin is guarded by a header secret
 *  instead. Anything else appearing above the line is a leak. */
const PUBLIC_MOUNTS = ['/health', '/admin', '/auth'];

const REGISTRATION = /app\.(?:use|get|post|put|patch|delete|all)\(\s*/g;

/** Everything registered ahead of the auth middleware that is not a known
 *  public mount. Scans the whole file with comments stripped, so it sees a
 *  registration however it is written and ignores one that is commented out. */
export function unauthenticatedRegistrations(appSource: string): string[] {
  const clean = appSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const parts = clean.split(/app\.use\(\s*authMiddleware\s*\)/);
  if (parts.length !== 2) {
    throw new Error(
      `app.use(authMiddleware) must appear exactly once and unwrapped; found ${parts.length - 1}`,
    );
  }

  const head = parts[0];
  const found: string[] = [];
  for (const match of head.matchAll(REGISTRATION)) {
    const after = head.slice((match.index ?? 0) + match[0].length);

    const quoted = after.match(/^([`'"])(.*?)\1/);
    if (quoted) {
      if (!PUBLIC_MOUNTS.includes(quoted[2])) found.push(quoted[2]);
      continue;
    }
    // An array of paths, or a regex path.
    if (/^[[/]/.test(after)) {
      found.push(after.slice(0, 30).split('\n')[0]);
      continue;
    }
    // app.use(someRouter) with no prefix at all.
    const bare = after.match(/^(\w*[Rr]outer)\s*\)/);
    if (bare) found.push(bare[1]);
  }
  return found;
}

/** The invite router is mounted with no prefix, so its paths are invisible at
 *  the mount site - which is exactly why they are easy to forget. The method
 *  matters: a GET against a POST-only route falls through to the middleware
 *  and answers 401 whether or not the router is public, so asserting the wrong
 *  verb produces a test that can never fail. */
const UNPREFIXED_ROUTES: Array<['get' | 'post', string]> = [
  ['get', '/organizations/00000000-0000-0000-0000-000000000000/invite-codes'],
  ['post', '/invite-codes/abc123/revoke'],
];

/** Every .ts under src, excluding tests. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.resolve(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.ts$/.test(entry) && !/\.test\.ts$/.test(entry) ? [full] : [];
  });
}

const ORIGINAL_ENV = { ...process.env };
let app: Express;

beforeAll(async () => {
  // `||=`, not `??=`: an empty-string variable exported in a shell or a CI job
  // survives `??=` and then answers 500 instead of 403. Set before importing,
  // because config.ts reads process.env at module scope - and because dotenv
  // does not override existing keys, these win over a developer's real .env.
  process.env.LOCAL_AUTH_SECRET ||= 'test-secret-not-used-for-signing-anything';
  process.env.ROOT_ADMIN_TOKEN ||= 'test-root-admin-token';
  process.env.DATABASE_URL ||= 'postgres://unused:unused@localhost:5432/unused';
  // Unconditional: a configured JWKS URL sends a well-formed token to the
  // network, which turns a 10ms assertion into a 10s one.
  process.env.OAUTH_JWKS_URL = '';

  const { createApp } = await import('./app.js');
  app = createApp();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('mount order', () => {
  /** THIS ASSERTION IS THE GATE. Everything below it confirms the middleware
   *  works; only this one confirms the routers sit behind it. Loosening it
   *  removes the protection without turning the suite red. */
  it('registers nothing unauthenticated except the known public mounts', () => {
    expect(unauthenticatedRegistrations(source)).toEqual([]);
  });

  it('registers routes only in app.ts, where this check can see them', () => {
    // A registration in another module would be invisible to the gate above.
    const offenders = sourceFiles(HERE)
      .filter((file) => file !== path.resolve(HERE, 'app.ts'))
      .filter((file) =>
        /\bapp\.(?:use|get|post|put|patch|delete|all)\(/.test(readFileSync(file, 'utf8')),
      )
      .map((file) => path.relative(HERE, file));

    expect(offenders).toEqual([]);
  });

  it('attaches no sub-router inside a route module', () => {
    // `authRouter.use('/x', someRouter)` would graft a sub-tree onto a public
    // router without touching app.ts.
    const offenders = sourceFiles(HERE)
      .filter((file) => /\b\w*[Rr]outer\.use\(/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(HERE, file));

    expect(offenders).toEqual([]);
  });
});

describe('the auth middleware, once mounts are in order', () => {
  it('serves the health check without a token', () => {
    return request(app).get('/health').expect(200);
  });

  it('reaches the login route without a token', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400); // rejected by the schema, not by auth
  });

  it('reaches the root-admin routes without a bearer token', async () => {
    const res = await request(app).get('/admin/organizations');
    expect(res.status).toBe(403); // rejected by the header guard, not by auth
  });

  it('rejects a protected route with no token', () => {
    return request(app).get('/users').expect(401);
  });

  it.each(UNPREFIXED_ROUTES)('rejects %s %s with no token', async (method, route) => {
    const res = await request(app)[method](route);
    expect(res.status).toBe(401);
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(app).get('/users').set('Authorization', 'NotBearer xyz');
    expect(res.status).toBe(401);
  });

  it('rejects a bearer token that is not a token', async () => {
    const res = await request(app).get('/users').set('Authorization', 'Bearer nonsense');
    expect(res.status).toBe(401);
  });

  it('falls an unmatched public path through to the middleware', () => {
    // Pinned because it surprised this test's first draft, and because it is
    // why the assertions above are not a mount-order check: the middleware is
    // a path-less catch-all, so ANY unmatched path answers 401. "Returns 401"
    // is not by itself proof that a path is protected.
    return request(app).get('/auth/no-such-route').expect(401);
  });
});
