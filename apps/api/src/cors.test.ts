import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './cors.js';

// Trailing slash on purpose: that is how the value tends to get pasted
// into a dashboard, and it must still match.
const allowed = ['https://prosperity-crm-web.vercel.app/'];

describe('isAllowedOrigin', () => {
  it('allows a request with no Origin header (curl, server-to-server)', () => {
    expect(isAllowedOrigin(undefined, allowed)).toBe(true);
  });

  it('allows localhost and 127.0.0.1 on any port for development', () => {
    expect(isAllowedOrigin('http://localhost:5173', allowed)).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:4000', allowed)).toBe(true);
  });

  it('rejects a host that merely starts with localhost', () => {
    expect(isAllowedOrigin('http://localhost.evil.example', allowed)).toBe(false);
  });

  it('allows a configured origin regardless of a trailing slash in the config', () => {
    expect(isAllowedOrigin('https://prosperity-crm-web.vercel.app', allowed)).toBe(true);
  });

  it('rejects an unlisted origin even when it is on vercel.app', () => {
    expect(isAllowedOrigin('https://someone-else.vercel.app', allowed)).toBe(false);
  });

  it('allows everything when nothing is configured', () => {
    expect(isAllowedOrigin('https://anything.example', [])).toBe(true);
  });
});
