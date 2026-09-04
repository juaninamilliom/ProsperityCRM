import { PgDialect } from 'drizzle-orm/pg-core';

/** A stand-in for a drizzle transaction handle, shared by every test that has
 *  to prove a service ran on the transaction it was given.
 *
 *  It lives here rather than in each test file because two copies drifted once
 *  and the drift was not visible: one kept builder arguments and the other
 *  discarded them, so the file with the weaker copy silently stopped pinning
 *  its predicate, and deleting the magic link's replay guard passed every
 *  test. One helper means a hardening applied here applies everywhere. */

export interface FakeTx {
  /** Pass this where a `Tx` is expected. */
  handle: unknown;
  /** Builder method names in call order; `for` carries its lock mode. */
  order: () => string[];
  /** First argument of the first call to `method`. */
  firstArgOf: (method: string) => unknown;
  /** First argument of the first `method` call that happens after `marker`.
   *  Statements share method names, so a global "first where" is ambiguous as
   *  soon as a function issues two of them. */
  firstArgAfter: (marker: string, method: string) => unknown;
}

export function fakeTx(results: unknown[]): FakeTx {
  const calls: { method: string; args: unknown[] }[] = [];
  const handle: Record<string, unknown> = {};
  const methods = [
    'select',
    'from',
    'where',
    'for',
    'insert',
    'values',
    'returning',
    'update',
    'set',
    'delete',
  ];

  for (const method of methods) {
    handle[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return handle;
    };
  }

  /** Awaiting any chain resolves the next queued result. Running past the end
   *  throws by name: returning `undefined` let production destructure it and
   *  fail as `(intermediate value) is not iterable`, several frames from the
   *  cause, which read like a bug in the code under test. */
  (handle as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown
  ) => {
    if (results.length === 0) {
      throw new Error(
        `fakeTx: ran out of queued results after ${calls.length} builder calls ` +
          `(${calls.map((call) => call.method).join(' > ')}). ` +
          'The code under test issued more statements than this test queued.'
      );
    }
    const next = results.shift();
    /** A queued Error is a statement that FAILS - a unique violation on the
     *  user insert, say. Without this the fake can only ever succeed, so the
     *  rollback path these tests exist to protect had no case where a
     *  statement could fail at all. */
    return next instanceof Error ? reject(next) : resolve(next);
  };

  const order = () =>
    calls.map(({ method, args }) => (method === 'for' ? `for(${String(args[0])})` : method));

  return {
    handle,
    order,
    firstArgOf: (method) => calls.find((call) => call.method === method)?.args[0],
    firstArgAfter: (marker, method) => {
      /** Ambiguity in the MARKER is as dangerous as ambiguity in the target:
       *  a second `set` earlier in the function would silently retarget this
       *  at a different statement while staying green. Fail loudly instead. */
      const markers = calls.filter((call) => call.method === marker).length;
      if (markers > 1) {
        throw new Error(
          `fakeTx: "${marker}" appears ${markers} times, so "after ${marker}" is ambiguous. ` +
            `Call order was: ${calls.map((call) => call.method).join(' > ')}.`
        );
      }
      const from = calls.findIndex((call) => call.method === marker);
      if (from === -1) return undefined;
      return calls.slice(from + 1).find((call) => call.method === method)?.args[0];
    },
  };
}

/** Renders a drizzle condition to real SQL and bound parameters.
 *
 *  Asserting on `JSON.stringify` of the condition proved only that a column
 *  name appeared somewhere in the tree. It could not tell `and` from `or` -
 *  and swapping them turns the magic-link claim into "match any unused link",
 *  which mints a token for an arbitrary account from a garbage token. That
 *  mutation passed all 240 tests. Rendering the statement makes the operator,
 *  the combinator and the bound values all assertable. */
export function renderSql(condition: unknown): { sql: string; params: unknown[] } {
  /** Otherwise drizzle throws `Cannot read properties of undefined`, several
   *  frames from the cause - the same opaque failure the drained-queue error
   *  above exists to avoid. */
  if (!condition) {
    throw new Error(
      'renderSql: no condition to render. The statement you anchored on was never issued.'
    );
  }
  const { sql, params } = new PgDialect().sqlToQuery(condition as never);
  return { sql, params: params as unknown[] };
}
