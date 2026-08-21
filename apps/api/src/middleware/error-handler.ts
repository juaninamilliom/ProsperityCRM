import type { NextFunction, Request, Response } from 'express';

/** MUST take four parameters. Express identifies an error handler by its
 *  arity, so a three-parameter version is silently registered as ordinary
 *  middleware and never runs - which sends Express's default HTML error page
 *  to API clients that can only parse JSON. */
export function errorHandler(err: Error, _req: Request, res: Response, next: NextFunction) {
  console.error('[api] unhandled error', err);

  // Once the response has started, only Express can abort the stream cleanly.
  if (res.headersSent) {
    return next(err);
  }

  // The message stays in the log. Postgres errors carry the host, the database
  // and the user, none of which belongs in a response body.
  res.status(500).json({ message: 'Internal server error' });
}
