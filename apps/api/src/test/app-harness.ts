import type { Express } from 'express';
import type { Organization, User } from '../types.js';

/** A request-level harness for the routes.
 *
 *  CLAUDE.md records that no test exercises the auth middleware, `requireRole`,
 *  the root-admin guard, or any route handler. Several audit findings are only
 *  reachable through a request - a missing ownership check is the ABSENCE of
 *  code, so a unit test on an extracted predicate passes forever after someone
 *  deletes the call site. Only a request proves the route rejects.
 *
 *  It mocks at the SERVICE boundary, never at the database. Faking drizzle's
 *  fluent builder would be miserable and would test the fake; the routes
 *  already treat services as their seam. What runs for real is the thing worth
 *  testing: Express routing, the middleware chain in its real order, zod
 *  parsing, token verification, and the status codes.
 *
 *  No database. `new Pool()` does not connect - it connects on first query -
 *  and every service that would issue one is mocked. */

const TEST_SECRET = 'harness-secret-not-used-outside-tests';

const ORIGINAL_ENV = { ...process.env };

/** Set before app.ts is imported: config.ts reads process.env at module scope.
 *  `||=` rather than `??=`, because an empty-string variable exported in a
 *  shell survives `??=` and changes what the guards answer. The exception is
 *  the JWKS url, pinned empty unconditionally - a configured one sends a
 *  well-formed token to the network and turns a 10ms assertion into a 10s one. */
export function pinEnvironment(): void {
  process.env.LOCAL_AUTH_SECRET ||= TEST_SECRET;
  process.env.ROOT_ADMIN_TOKEN ||= 'harness-root-admin-token';
  process.env.DATABASE_URL ||= 'postgres://unused:unused@localhost:5432/unused';
  process.env.OAUTH_JWKS_URL = '';
}

/** The real app, with the real middleware chain. */
export async function buildApp(): Promise<Express> {
  pinEnvironment();
  const { createApp } = await import('../app.js');
  return createApp();
}

/** Call from `afterAll`. Vitest reuses worker threads across files, so the
 *  unconditional write above can otherwise survive into a later file.
 *
 *  Restores only the keys pinEnvironment touches. Replacing process.env
 *  wholesale looked tidier and was worse: it wiped variables another file had
 *  set for itself, and that file then failed only when the suite ran as a
 *  whole - the hardest kind of failure to read. */
const PINNED = ['LOCAL_AUTH_SECRET', 'ROOT_ADMIN_TOKEN', 'DATABASE_URL', 'OAUTH_JWKS_URL'] as const;

export function restoreEnvironment(): void {
  for (const key of PINNED) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
}

/** Derived, never duplicated: `pinEnvironment` assigns conditionally, so a
 *  shell that already exports ROOT_ADMIN_TOKEN would leave a hardcoded copy
 *  disagreeing with what the guard actually compares - and every root-admin
 *  test would 403 for a reason nothing names. */
export function rootAdminToken(): string {
  pinEnvironment();
  return process.env.ROOT_ADMIN_TOKEN as string;
}

let counter = 0;

/** A plausible user row, as `getUserById` would return it. Mock that service
 *  to return one of these and the real auth middleware will accept the token
 *  minted by `bearerFor` below. */
export function asUser(overrides: Partial<User> = {}): User {
  counter += 1;
  return {
    user_id: `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    organization_id: '11111111-1111-1111-1111-111111111111',
    email: `user${counter}@prosperity.test`,
    name: `User ${counter}`,
    role: 'OrgEmployee',
    is_active: true,
    sso_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A genuine local token for that user - signed and verified by the real
 *  implementation, not a stub. That is what makes these tests exercise
 *  `authMiddleware` rather than route around it. */
export async function bearerFor(user: User): Promise<string> {
  pinEnvironment();
  const { createLocalToken } = await import('../modules/auth/token.js');
  return `Bearer ${await createLocalToken(user)}`;
}

/** A complete organization row, so fixtures do not need a cast to satisfy the
 *  type they claim to be. */
export function asOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    organization_id: '11111111-1111-1111-1111-111111111111',
    name: 'Prosperity Recruiting',
    slug: 'prosperity',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
