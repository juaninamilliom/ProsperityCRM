import type { NextFunction, Request, Response } from 'express';

/** A fixed-window per-client rate limiter for the credential routes.
 *
 *  Inert until TRUSTED_PROXY_HOPS is set, and that is the whole design.
 *
 *  A limiter is only as good as its idea of who the client is, and behind a
 *  proxy that answer cannot be guessed. `X-Forwarded-For` is a list proxies
 *  APPEND to, so the leftmost entry is whatever the CLIENT sent. Keying on it
 *  gives an attacker two gifts at once, both measured against this app:
 *
 *    rotating the leftmost entry   60 of 60 requests allowed, no protection
 *    spoofing one fixed value      31 requests lock that address out for 15m
 *
 *  The second is worse than having no limiter, because it is a denial-of-
 *  service primitive against a chosen victim that did not previously exist.
 *
 *  Taking the rightmost entry instead is only correct if exactly one trusted
 *  proxy is in front. Guess too high and you are back to reading a
 *  client-controlled value; guess too low and every caller collapses into one
 *  bucket, so one attacker locks out everybody. Both wrong answers are
 *  harmful, so this refuses to guess: with TRUSTED_PROXY_HOPS unset it passes
 *  every request through untouched.
 *
 *  To turn it on, send one request to the deployment and read the raw header,
 *  then set the variable to the number of proxies that appended to it. */

export interface WindowState {
  count: number;
  resetAt: number;
}

/** Bounded so a caller rotating addresses cannot grow it without limit.
 *
 *  An earlier version scanned the whole map on every request and deleted only
 *  EXPIRED windows - which are exactly the ones a flood does not create. The
 *  map stayed unbounded and the scan made each request more expensive than the
 *  last: measured 8ms per batch at 1,000 live keys, 3,138ms at 40,000, all of
 *  it synchronous on a single free-plan instance. That took down every route,
 *  not just the throttled ones. */
const MAX_TRACKED_CLIENTS = 20_000;

/** Which caller a request belongs to, counting from the RIGHT.
 *
 *  Only the proxies actually in front can write the right-hand end of the
 *  chain; everything to the left of them is caller-supplied. `hops` is how
 *  many of them there are.
 */
export function resolveClientKey(
  forwardedFor: string | undefined,
  socketIp: string | undefined,
  hops: number,
): string {
  const chain = (forwardedFor ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const fromRight = chain[chain.length - hops];
  if (fromRight) return fromRight;

  const socket = socketIp?.trim();
  if (socket) return socket;

  // Never an empty key: that would bucket every anonymous caller together and
  // reproduce the global-lockout failure this function exists to avoid.
  return 'unknown';
}

/** Fixed window: the reset is set once, when the window opens. A sliding reset
 *  would let a sustained attacker either never recover or never be reset,
 *  depending on which way it slid. */
export function recordHit(
  previous: WindowState | undefined,
  now: number,
  windowMs: number,
): WindowState {
  if (!previous || now >= previous.resetAt) {
    return { count: 1, resetAt: now + windowMs };
  }
  return { count: previous.count + 1, resetAt: previous.resetAt };
}

/** `max` is the number of requests permitted in a window, so the request that
 *  takes the count past it is the first one refused. */
export function isOverLimit(state: WindowState, max: number): boolean {
  return state.count > max;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Number of trusted proxies in front. `null` disables the limiter. */
  trustedProxyHops: number | null;
}

export function createRateLimiter({ windowMs, max, trustedProxyHops }: RateLimiterOptions) {
  if (trustedProxyHops === null) {
    // Cannot identify a client, so does not pretend to. Passing through is the
    // safe failure: throttling on a key we do not trust either protects
    // nobody or locks out everybody.
    return function rateLimitDisabled(_req: Request, _res: Response, next: NextFunction) {
      next();
    };
  }

  const windows = new Map<string, WindowState>();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();

    // O(1) amortised, and bounded. Dropping every window when the cap is
    // reached fails open for one window rather than degrading the event loop,
    // which is the right trade for a throttle.
    if (windows.size >= MAX_TRACKED_CLIENTS) windows.clear();

    const forwarded = req.headers['x-forwarded-for'];
    const key = resolveClientKey(
      Array.isArray(forwarded) ? forwarded.join(',') : forwarded,
      req.socket?.remoteAddress,
      trustedProxyHops,
    );

    const state = recordHit(windows.get(key), now, windowMs);
    windows.set(key, state);

    if (isOverLimit(state, max)) {
      const retryAfterSeconds = Math.ceil((state.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        // A stable discriminator, so the login page can tell this from any
        // other { message } failure and show the wait.
        code: 'RATE_LIMITED',
        retryAfterSeconds,
        message: 'Too many attempts. Please try again shortly.',
      });
    }

    next();
  };
}
