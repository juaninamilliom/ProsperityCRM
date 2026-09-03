import { describe, expect, it } from 'vitest';
import { securityHeaderValues } from './security-headers.js';

/** The API sent no security headers at all. Hand-rolled rather than helmet:
 *  helmet's defaults include a CSP and cross-origin isolation policies aimed at
 *  documents, and this serves JSON to a React app and a Chrome extension whose
 *  side panel fetches cross-origin. Twelve lines that say exactly what they do
 *  beats a dependency whose defaults have to be argued down. */

describe('securityHeaderValues', () => {
  const headers = securityHeaderValues();

  it('stops browsers guessing a content type', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('refuses to be framed', () => {
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('sends no referrer, since every path here identifies a record', () => {
    expect(headers['Referrer-Policy']).toBe('no-referrer');
  });

  it('asks browsers to keep using https', () => {
    expect(headers['Strict-Transport-Security']).toMatch(/^max-age=\d+/);
  });

  it('sets no CSP or cross-origin isolation policy', () => {
    // Deliberate. A CSP on a JSON response protects nothing, and COEP or CORP
    // would break the extension side panel's cross-origin fetches - which is
    // the specific reason helmet is not used here.
    expect(headers['Content-Security-Policy']).toBeUndefined();
    expect(headers['Cross-Origin-Embedder-Policy']).toBeUndefined();
    expect(headers['Cross-Origin-Resource-Policy']).toBeUndefined();
  });
});
