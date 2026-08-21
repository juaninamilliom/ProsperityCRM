import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './error-handler.js';

describe('errorHandler', () => {
  // The handler logs every error by design; the tests deliberately pass errors,
  // so silence the console rather than filling the run with stack traces.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('declares four parameters, or Express never calls it', () => {
    // Express decides a middleware is an error handler by its arity. With
    // three parameters it is registered as ordinary middleware, the built-in
    // handler runs instead, and every 500 comes back as an HTML page that no
    // client can read. This is the whole bug.
    expect(errorHandler.length).toBe(4);
  });

  it('answers JSON, not HTML', () => {
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json, headersSent: false };
    errorHandler(new Error('connect ECONNREFUSED'), {} as never, res as never, vi.fn() as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ message: 'Internal server error' });
  });

  it('does not leak the underlying error to the client', () => {
    // pg errors carry the host and database name; the detail belongs in the
    // server log, not in a response body.
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json, headersSent: false };
    errorHandler(
      new Error('password authentication failed for user "prosperity" at db.internal'),
      {} as never,
      res as never,
      vi.fn() as never,
    );

    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('db.internal');
  });

  it('delegates to Express once the response has started', () => {
    // Writing a second response after headers are sent throws; Express's own
    // handler knows how to abort the stream.
    const next = vi.fn();
    const error = new Error('boom');
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), headersSent: true };
    errorHandler(error, {} as never, res as never, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
