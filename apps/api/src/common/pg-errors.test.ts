import { describe, expect, it } from 'vitest';
import { classify, dependentsMessage, pgErrorOf, SQLSTATE } from './pg-errors.js';

/** Drizzle 0.45 wraps EVERY query error in a DrizzleQueryError and puts the
 *  driver's error on `.cause`. Measured against a real drizzle instance over a
 *  rejecting client:
 *
 *    constructor      DrizzleQueryError
 *    e.code           undefined
 *    e.cause.code     23505
 *
 *  So `err.code === '23505'` is always false, and `company.routes.ts` has been
 *  re-throwing every duplicate into the 500 handler - its 409 branch, and the
 *  web branch that renders it, are both dead. Reading `.code` is the single
 *  mistake this module exists to stop anyone repeating, which is why
 *  `pgErrorOf` walks the chain rather than taking one hop. */

/** A driver error as pg actually shapes one. */
const driverError = (overrides: Record<string, unknown> = {}) =>
  Object.assign(new Error('duplicate key value violates unique constraint "idx_people_linkedin"'), {
    code: SQLSTATE.UNIQUE_VIOLATION,
    constraint: 'idx_people_linkedin',
    detail: 'Key (organization_id, linkedin_url)=(org-1, https://x) already exists.',
    ...overrides,
  });

/** As drizzle hands it on. */
const wrapped = (cause: unknown, depth = 1): Error => {
  let error = new Error('Failed query: insert into "people" ... params: jane@example.com');
  (error as { cause?: unknown }).cause = cause;
  for (let i = 1; i < depth; i += 1) {
    const outer = new Error('Failed query (re-wrapped)');
    (outer as { cause?: unknown }).cause = error;
    error = outer;
  }
  return error;
};

describe('pgErrorOf', () => {
  it('finds the driver error through drizzle wrapping', () => {
    expect(pgErrorOf(wrapped(driverError()))?.code).toBe(SQLSTATE.UNIQUE_VIOLATION);
  });

  it('finds it through more than one layer', () => {
    // One hop is what a naive implementation does. Two layers is cheap to
    // support and is what a future driver or a re-throw would produce.
    expect(pgErrorOf(wrapped(driverError(), 3))?.code).toBe(SQLSTATE.UNIQUE_VIOLATION);
  });

  it('finds it when it is not wrapped at all', () => {
    expect(pgErrorOf(driverError())?.code).toBe(SQLSTATE.UNIQUE_VIOLATION);
  });

  it('returns null for anything without a SQLSTATE', () => {
    expect(pgErrorOf(new Error('just an error'))).toBeNull();
    expect(pgErrorOf(wrapped(new Error('no code anywhere')))).toBeNull();
    expect(pgErrorOf(null)).toBeNull();
    expect(pgErrorOf(undefined)).toBeNull();
    expect(pgErrorOf('a thrown string')).toBeNull();
    expect(pgErrorOf({ code: 42 })).toBeNull();
  });

  it('does not loop forever on a cycle', () => {
    const a = new Error('a');
    const b = new Error('b');
    (a as { cause?: unknown }).cause = b;
    (b as { cause?: unknown }).cause = a;
    expect(pgErrorOf(a)).toBeNull();
  });
});

describe('classify', () => {
  it('maps a unique violation to a 409 duplicate', () => {
    expect(classify(wrapped(driverError()), 'insert')).toMatchObject({
      status: 409,
      code: 'duplicate',
    });
  });

  it('maps a foreign key violation on a DELETE to a 409 conflict', () => {
    // Something still references this row.
    expect(
      classify(wrapped(driverError({ code: SQLSTATE.FOREIGN_KEY_VIOLATION })), 'delete')
    ).toMatchObject({ status: 409, code: 'has_dependents' });
  });

  it('maps a foreign key violation on an INSERT to a 400', () => {
    // The opposite direction: the row the CALLER referenced does not exist.
    // Same SQLSTATE, different party at fault, so a 409 would be wrong.
    expect(
      classify(wrapped(driverError({ code: SQLSTATE.FOREIGN_KEY_VIOLATION })), 'insert')
    ).toMatchObject({ status: 400, code: 'invalid_reference' });
  });

  it('maps a malformed uuid to a 400', () => {
    // GET /companies/not-a-uuid is a 500 today: no path parameter is
    // validated anywhere, and every id column is uuid.
    expect(
      classify(wrapped(driverError({ code: SQLSTATE.INVALID_TEXT_REPRESENTATION })), 'select')
    ).toMatchObject({ status: 400, code: 'invalid_id' });
  });

  it('maps a check violation to a 400', () => {
    expect(
      classify(wrapped(driverError({ code: SQLSTATE.CHECK_VIOLATION })), 'insert')
    ).toMatchObject({ status: 400, code: 'invalid_value' });
  });

  it('leaves a not-null violation unclassified, because that is our bug', () => {
    // A missing required column means the service omitted it. Dressing that
    // as a 400 blames the caller for something they could not have caused.
    expect(classify(wrapped(driverError({ code: SQLSTATE.NOT_NULL_VIOLATION })), 'insert')).toBeNull();
  });

  it('leaves anything it does not recognise unclassified', () => {
    expect(classify(wrapped(driverError({ code: '40P01' })), 'select')).toBeNull();
    expect(classify(new Error('not a pg error'), 'insert')).toBeNull();
  });
});

describe('what reaches the client', () => {
  /** The driver's own text is the thing that must never be echoed. `message`
   *  now carries the SQL AND the bound parameters - candidate emails, LinkedIn
   *  URLs - and `detail` spells out the conflicting row's values. */
  const SENTINELS = [
    'idx_people_linkedin', // constraint name
    'jane@example.com', // a bound parameter
    'Key (organization_id', // detail, which spells out the conflicting values
    'duplicate key value', // the driver's own phrasing
    'insert into', // the SQL text
  ];
  // Deliberately NOT a bare 'already exists': our own message says "That
  // record already exists", which is the right thing to tell a user. A
  // sentinel has to be text only the driver would produce, or the guard
  // fails on correct behaviour and gets weakened to make it pass.

  it('never carries driver text, on any classified outcome', () => {
    const operations = ['insert', 'update', 'delete', 'select'] as const;
    const codes = Object.values(SQLSTATE);

    for (const operation of operations) {
      for (const code of codes) {
        const result = classify(wrapped(driverError({ code })), operation);
        if (!result) continue;
        const body = JSON.stringify(result);
        for (const sentinel of SENTINELS) {
          expect(body).not.toContain(sentinel);
        }
      }
    }
  });

  it('carries our own message, not the driver one', () => {
    const result = classify(wrapped(driverError()), 'insert');
    expect(result?.message).toBe('That record already exists.');
  });
});

describe('dependentsMessage', () => {
  it('names only the dependents that exist', () => {
    expect(dependentsMessage({ people: 3, requisitions: 0, entries: 0, deals: 5 })).toBe(
      'This company still has 3 contacts and 5 deals.'
    );
  });

  it('uses the singular for one', () => {
    expect(dependentsMessage({ people: 1, requisitions: 0, entries: 0, deals: 0 })).toBe(
      'This company still has 1 contact.'
    );
  });

  it('names all four when all four are present', () => {
    expect(dependentsMessage({ people: 2, requisitions: 1, entries: 4, deals: 7 })).toBe(
      'This company still has 2 contacts, 1 requisition, 4 pipeline entries and 7 deals.'
    );
  });
});
