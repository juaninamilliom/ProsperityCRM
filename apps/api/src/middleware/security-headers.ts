import type { NextFunction, Request, Response } from 'express';

/** Response headers this API sends on everything.
 *
 *  Hand-rolled rather than helmet, deliberately. Helmet's defaults include a
 *  Content-Security-Policy and cross-origin isolation policies aimed at
 *  documents; this serves JSON to a React app and to a Chrome extension whose
 *  side panel fetches cross-origin. A CSP on a JSON response protects nothing,
 *  and COEP or CORP would break the panel. Twelve lines that say exactly what
 *  they do beats a dependency whose defaults have to be argued down. */
export function securityHeaderValues(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    // Every path in this API identifies a record - a person, a company, a
    // requisition - so a referrer is a small leak with no upside.
    'Referrer-Policy': 'no-referrer',
    'X-DNS-Prefetch-Control': 'off',
    // Ignored by browsers over plain http, so this is inert in local
    // development and load-bearing on Render.
    'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  };
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  for (const [header, value] of Object.entries(securityHeaderValues())) {
    res.setHeader(header, value);
  }
  next();
}
