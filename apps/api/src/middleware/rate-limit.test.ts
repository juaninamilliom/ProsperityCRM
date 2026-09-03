import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, restoreEnvironment } from '../test/app-harness.js';
import { createRateLimiter, isOverLimit, recordHit, resolveClientKey } from './rate-limit.js';

/** The first version of this limiter keyed on the LEFTMOST X-Forwarded-For
 *  entry. Measured against the real app, that was not a weak limiter, it was a
 *  negative one:
 *
 *    rotating the leftmost entry   60 of 60 requests allowed
 *    spoofing one fixed value      31 requests locked that address out for 15m
 *
 *  So it protected nobody and handed an attacker a way to lock out a chosen
 *  victim - a denial of service that did not exist before it. Both of those are
 *  regression tests now. */

describe('resolveClientKey', () => {
  it('counts from the right, where only a real proxy can write', () => {
    expect(resolveClientKey('1.2.3.4, 10.0.0.9', undefined, 1)).toBe('10.0.0.9');
  });

  it('ignores a spoofed leftmost entry entirely', () => {
    // The regression. A client sending its own value cannot move the bucket,
    // because a proxy appends after whatever it sent.
    const spoofed = Array.from({ length: 5 }, (_, i) =>
      resolveClientKey(`9.9.9.${i}, 10.0.0.9`, undefined, 1),
    );
    expect(new Set(spoofed).size).toBe(1);
    expect(spoofed[0]).toBe('10.0.0.9');
  });

  it('reads deeper when more proxies are in front', () => {
    expect(resolveClientKey('1.2.3.4, 203.0.113.7, 10.0.0.9', undefined, 2)).toBe('203.0.113.7');
  });

  it('falls back to the socket when nothing was forwarded', () => {
    expect(resolveClientKey(undefined, '10.0.0.1', 1)).toBe('10.0.0.1');
    expect(resolveClientKey('', '10.0.0.1', 1)).toBe('10.0.0.1');
  });

  it('falls back rather than returning an empty key', () => {
    // An empty key buckets every anonymous caller together, which is the
    // global-lockout failure by another route.
    expect(resolveClientKey(undefined, undefined, 1)).toBe('unknown');
    expect(resolveClientKey('1.2.3.4', undefined, 5)).toBe('unknown');
  });
});

describe('recordHit', () => {
  const WINDOW = 60_000;

  it('opens a window on the first hit', () => {
    expect(recordHit(undefined, 1_000, WINDOW)).toEqual({ count: 1, resetAt: 61_000 });
  });

  it('counts inside the window without moving the reset', () => {
    expect(recordHit({ count: 1, resetAt: 61_000 }, 30_000, WINDOW)).toEqual({
      count: 2,
      resetAt: 61_000,
    });
  });

  it('opens a fresh window once the old one expired', () => {
    expect(recordHit({ count: 9, resetAt: 61_000 }, 61_000, WINDOW)).toEqual({
      count: 1,
      resetAt: 121_000,
    });
  });
});

describe('isOverLimit', () => {
  it('allows exactly the permitted number, refuses the next', () => {
    expect(isOverLimit({ count: 5, resetAt: 0 }, 5)).toBe(false);
    expect(isOverLimit({ count: 6, resetAt: 0 }, 5)).toBe(true);
  });
});

describe('createRateLimiter', () => {
  it('passes everything through when the proxy depth is unknown', () => {
    // Inert until TRUSTED_PROXY_HOPS is measured and set. Throttling on a key
    // nobody has verified either protects nobody or locks out everybody, and
    // both are worse than not throttling.
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, trustedProxyHops: null });
    let passed = 0;
    for (let i = 0; i < 10; i++) {
      limiter({ headers: {}, socket: {} } as never, {} as never, () => {
        passed += 1;
      });
    }
    expect(passed).toBe(10);
  });

  it('keeps its bookkeeping bounded against a rotating flood', () => {
    // The earlier version scanned the whole map per request and deleted only
    // EXPIRED windows - which a flood never creates. 40,000 live keys cost
    // 3.1 seconds of synchronous work per batch on one free-plan instance.
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, trustedProxyHops: 1 });
    const started = Date.now();
    for (let i = 0; i < 50_000; i++) {
      limiter(
        { headers: { 'x-forwarded-for': `10.0.${Math.floor(i / 256)}.${i % 256}` }, socket: {} } as never,
        { setHeader() {}, status: () => ({ json() {} }) } as never,
        () => {},
      );
    }
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

describe('the limiter, as mounted', () => {
  let app: Express;

  // TRUSTED_PROXY_HOPS is pinned to 1 for the whole suite in vitest.config.ts.
  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(restoreEnvironment);

  const login = (forwarded: string) =>
    request(app).post('/auth/login').set('X-Forwarded-For', forwarded).send({});

  it('refuses a credential route past the limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await login('10.0.0.7')).status);

    // 400 from the schema: the body is empty, which is enough to reach the
    // limiter without a database.
    expect(statuses.slice(0, 30).every((status) => status === 400)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('tells a refused caller when to come back, with a code it can match on', async () => {
    const res = await login('10.0.0.7');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('cannot be aimed at a victim by spoofing their address', async () => {
    // The attack the first version created. The spoofed value is to the LEFT
    // of what the proxy appends, so it never reaches the key.
    for (let i = 0; i < 40; i++) await login('198.51.100.7, 10.0.0.55');
    const victim = await login('10.0.0.99');
    expect(victim.status).toBe(400);
  });

  it('does not throttle the passkey routes the app shell polls', async () => {
    // GET /auth/passkeys refetches on every tab focus. Sharing the credential
    // budget would let normal work lock an office out of logging in.
    for (let i = 0; i < 50; i++) {
      const res = await request(app).get('/auth/passkeys').set('X-Forwarded-For', '10.0.0.7');
      expect(res.status).toBe(401); // rejected by auth, never by the limiter
    }
  });
});
