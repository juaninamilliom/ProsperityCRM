import { describe, expect, it } from 'vitest';
import { resolveBaseUrl } from './baseUrl';

describe('resolveBaseUrl', () => {
  it('prefers an explicit VITE_API_BASE_URL', () => {
    expect(resolveBaseUrl({ VITE_API_BASE_URL: 'https://staging.example.com', PROD: true })).toBe(
      'https://staging.example.com',
    );
  });

  it('uses localhost in development', () => {
    expect(resolveBaseUrl({ PROD: false })).toBe('http://localhost:4000');
  });

  it('never falls back to localhost in a production build', () => {
    // A deployed site pointed at localhost fails identically to the API being
    // down, which is a genuinely hard thing to diagnose from a browser.
    const resolved = resolveBaseUrl({ PROD: true });
    expect(resolved).not.toContain('localhost');
    expect(resolved).toBe('https://prosperitycrm.onrender.com');
  });

  it('ignores a blank variable rather than resolving to an empty origin', () => {
    expect(resolveBaseUrl({ VITE_API_BASE_URL: '   ', PROD: true })).toBe(
      'https://prosperitycrm.onrender.com',
    );
  });

  it('strips a trailing slash, which would double up on every path', () => {
    expect(resolveBaseUrl({ VITE_API_BASE_URL: 'https://api.example.com/', PROD: true })).toBe(
      'https://api.example.com',
    );
  });
});
