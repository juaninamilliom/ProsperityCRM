import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeTx } from '../../test/fake-tx.js';

/** The company delete counts its dependents and deletes in one transaction,
 *  holding a row lock on the parent.
 *
 *  The lock is the reason this is a transaction at all. Inserting a deal takes
 *  FOR KEY SHARE on the referenced companies row and FOR UPDATE conflicts with
 *  it, so a deal created between the count and the delete waits. Measured
 *  against PostgreSQL 16.15: with FOR UPDATE held for 3s the child insert
 *  returned after 2013ms; with no lock held, 46ms.
 *
 *  Without the lock there is nothing to catch, because bd_opportunities
 *  cascades (0010:64) and the cascade IS the success path — the deal is
 *  destroyed and the route reports 204. That is the one race a catch cannot
 *  cover, and it is why the call order below is asserted rather than only the
 *  return value: dropping `.for('update')` leaves every request test green.
 *
 *  db/schema.ts opens no connection, so only `db` itself is faked. */

const transaction = vi.fn();

vi.mock('../../db/drizzle.js', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('../../db/schema.js')),
  db: { transaction },
}));

const COMPANY = '33333333-3333-3333-3333-333333333333';
const NONE = { people: 0, requisitions: 0, entries: 0, deals: 0 };

beforeEach(() => {
  transaction.mockReset();
});

/** Runs deleteCompanyIfUnreferenced against a fake transaction handle and hands
 *  back both the result and the builder call order. */
async function runDelete(results: unknown[]) {
  const tx = fakeTx(results);
  transaction.mockImplementation((callback: (handle: unknown) => unknown) => callback(tx.handle));
  const { deleteCompanyIfUnreferenced } = await import('./company.service.js');
  const result = await deleteCompanyIfUnreferenced(COMPANY);
  return { result, tx };
}

describe('deleteCompanyIfUnreferenced', () => {
  it('locks the row before counting, then deletes when nothing refers to it', async () => {
    const { result, tx } = await runDelete([[{ company_id: COMPANY }], [NONE], undefined]);

    expect(result).toEqual({ deleted: true });
    expect(tx.order()).toEqual([
      'select',
      'from',
      'where',
      'for(update)',
      'select',
      'from',
      'where',
      'delete',
      'where',
    ]);
  });

  it('issues no delete when a deal still refers to the company', async () => {
    // Deals cascade, so this is the case the previous guard reported as 204
    // while destroying them.
    const { result, tx } = await runDelete([
      [{ company_id: COMPANY }],
      [{ ...NONE, deals: 1 }],
    ]);

    expect(result).toEqual({ deleted: false, dependents: { ...NONE, deals: 1 } });
    expect(tx.order()).not.toContain('delete');
  });

  it('issues no delete when a contact still refers to the company', async () => {
    const { result, tx } = await runDelete([
      [{ company_id: COMPANY }],
      [{ ...NONE, people: 2 }],
    ]);

    expect(result).toEqual({ deleted: false, dependents: { ...NONE, people: 2 } });
    expect(tx.order()).not.toContain('delete');
  });

  it('keeps the delete idempotent when the company is already gone', async () => {
    // No row to lock. The route's 204 is preserved without a second query.
    const { result, tx } = await runDelete([[]]);

    expect(result).toEqual({ deleted: true });
    expect(tx.order()).not.toContain('delete');
  });

  it('reads counts as numbers, so the message picks the right noun', async () => {
    // count(*) is bigint and node-postgres returns bigint as a string. A string
    // "1" fails === 1 in dependentsMessage and renders "1 contacts".
    const { result } = await runDelete([
      [{ company_id: COMPANY }],
      [{ people: '1', requisitions: '0', entries: '0', deals: '0' }],
    ]);

    expect(result).toEqual({ deleted: false, dependents: { ...NONE, people: 1 } });
  });
});
