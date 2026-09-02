import { describe, expect, it } from 'vitest';
import { resolveAppBaseUrl, resolveTrustedOrigin } from './origin.js';

/** The magic-link URL used to be built from the caller's own Origin header on
 *  a route that sits above the auth middleware. Anyone could make the real
 *  sender email a victim a genuine sign-in link pointing at their own host.
 *
 *  This is deliberately NOT isAllowedOrigin from ../../cors.js. That function
 *  trusts any localhost origin and trusts everything when the list is empty,
 *  which is right for CORS and would re-open this hole. The CORS rule falls
 *  open; this one must fall closed. */

const BASE = 'https://prosperity-crm.vercel.app';
const ALLOWED = [BASE, 'https://app.prosperity.example'];

describe('resolveTrustedOrigin', () => {
  it('returns the header when it exactly matches an allowlist entry', () => {
    expect(resolveTrustedOrigin('https://app.prosperity.example', ALLOWED, BASE)).toBe(
      'https://app.prosperity.example',
    );
  });

  it('falls back to the configured base when the allowlist is empty', () => {
    // The regression that made T1 exploitable: an unset CORS_ORIGINS must not
    // mean "trust whatever the caller claims".
    expect(resolveTrustedOrigin('https://prosperity-crm.evil', [], BASE)).toBe(BASE);
  });

  it('ignores an origin that is not on the allowlist', () => {
    expect(resolveTrustedOrigin('https://prosperity-crm.evil', ALLOWED, BASE)).toBe(BASE);
  });

  it('ignores a localhost origin that is not on the allowlist', () => {
    // isAllowedOrigin trusts these unconditionally. This must not.
    expect(resolveTrustedOrigin('http://localhost:5173', ALLOWED, BASE)).toBe(BASE);
  });

  it('trusts a localhost origin only when the allowlist names it', () => {
    expect(
      resolveTrustedOrigin('http://localhost:5173', ['http://localhost:5173'], BASE),
    ).toBe('http://localhost:5173');
  });

  it('normalises a trailing slash on either side before comparing', () => {
    expect(resolveTrustedOrigin('https://app.prosperity.example/', ALLOWED, BASE)).toBe(
      'https://app.prosperity.example',
    );
    expect(
      resolveTrustedOrigin('https://app.prosperity.example', ['https://app.prosperity.example/'], BASE),
    ).toBe('https://app.prosperity.example');
  });

  it('returns the base with no trailing slash, so the path can be appended', () => {
    // The caller builds `${origin}/login?magic_token=...`; a trailing slash
    // here produces a link with a doubled slash.
    expect(resolveTrustedOrigin(undefined, [], 'https://prosperity-crm.vercel.app/')).toBe(BASE);
  });

  it('falls back when the header is absent', () => {
    expect(resolveTrustedOrigin(undefined, ALLOWED, BASE)).toBe(BASE);
  });

  it('ignores whitespace and empty entries in the allowlist', () => {
    expect(
      resolveTrustedOrigin('https://app.prosperity.example', ['  ', ' https://app.prosperity.example '], BASE),
    ).toBe('https://app.prosperity.example');
  });

  it('ignores an empty header rather than matching an empty allowlist entry', () => {
    expect(resolveTrustedOrigin('', [''], BASE)).toBe(BASE);
  });
});

/** `??` only falls through on null and undefined, so `APP_BASE_URL=` in a .env
 *  yields '' and every sign-in link becomes the relative "/login?magic_token=…"
 *  — unclickable, with the token already spent. This repo already ships an
 *  empty assignment in .env.example, so the shape is live, not theoretical. */
describe('resolveAppBaseUrl', () => {
  it('uses APP_BASE_URL when it is set', () => {
    expect(resolveAppBaseUrl('https://app.example', ['https://cors.example'])).toBe('https://app.example');
  });

  it('falls through an empty APP_BASE_URL to the first allowed origin', () => {
    expect(resolveAppBaseUrl('', ['https://cors.example'])).toBe('https://cors.example');
  });

  it('falls through a whitespace-only APP_BASE_URL', () => {
    expect(resolveAppBaseUrl('   ', ['https://cors.example'])).toBe('https://cors.example');
  });

  it('falls through an undefined APP_BASE_URL', () => {
    expect(resolveAppBaseUrl(undefined, ['https://cors.example'])).toBe('https://cors.example');
  });

  it('falls all the way to localhost when nothing is configured', () => {
    expect(resolveAppBaseUrl(undefined, [])).toBe('http://localhost:5173');
  });

  it('skips an empty first entry in the allowed origins', () => {
    expect(resolveAppBaseUrl(undefined, ['', 'https://cors.example'])).toBe('https://cors.example');
  });

  it('falls through a base that is only slashes, which normalises to nothing', () => {
    // The truthiness check ran before normalize(), so '/' survived it and then
    // became '' — the relative link this function exists to prevent.
    expect(resolveAppBaseUrl('/', ['https://cors.example'])).toBe('https://cors.example');
    expect(resolveAppBaseUrl('///', ['https://cors.example'])).toBe('https://cors.example');
    expect(resolveAppBaseUrl(undefined, ['/'])).toBe('http://localhost:5173');
  });

  it('strips a trailing slash, so the login path is not appended to one', () => {
    expect(resolveAppBaseUrl('https://app.example/', [])).toBe('https://app.example');
  });
});
