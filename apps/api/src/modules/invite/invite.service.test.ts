import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeTx, renderSql } from '../../test/fake-tx.js';
import { InviteError } from './invite.rules.js';

/** The magic-link flow has to claim the link and redeem the invite in ONE
 *  transaction: before, the link was marked used and then the code redeemed,
 *  so a revoked or exhausted code left a link that was already spent - the user
 *  was told it was invalid, requesting a new one hit the same wall, and nothing
 *  ever mentioned the invite.
 *
 *  Rolling that back only works if the redemption runs inside the CALLER's
 *  transaction. If it opened its own, its writes would commit independently and
 *  the claim would roll back around them - which looks identical in review and
 *  is the whole bug, moved. That is what this file pins.
 *
 *  What it cannot pin is the rollback itself: that needs a real database, and
 *  no test in this repo has one. The manual verification is in the PR. */

const transaction = vi.fn();

// Real tables, stubbed connection. Faking the tables made every predicate
// assertion a substring match, which cannot tell one column from another.
vi.mock('../../db/drizzle.js', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('../../db/schema.js')),
  db: { transaction },
}));

const USABLE_INVITE = {
  code_id: '5b8f1d02-0000-4000-8000-000000000001',
  organization_id: 'o1',
  // Deliberately the LOWER privilege. A mutation that hardcodes a role, or
  // reads one from anywhere but the invite, escalates - and the assertion
  // below is what catches it.
  role: 'OrgEmployee',
  max_uses: 5,
  used_count: 0,
  status: 'active',
};

const SIGNUP = { code: 'abc', email: 'a@b.c', name: 'A', password: 'pw' };

/** Enough queued results that every statement in `redeem` resolves. Tests that
 *  expect a throw use this too, so reaching a later statement CANNOT itself
 *  throw - otherwise a deleted guard passes by crashing further down. */
const allStatementsSucceed = (invite: unknown) => [[invite], [{ user_id: 'u1' }], undefined];

beforeEach(() => {
  // Shared across the file, so a change in declaration order would otherwise
  // leak call history into the tests that assert it was never called.
  transaction.mockReset();
});

describe('redeemInviteForLocalSignup', () => {
  it('runs inside a transaction it is given, rather than opening its own', async () => {
    const { redeemInviteForLocalSignup } = await import('./invite.service.js');
    const { handle, order } = fakeTx(allStatementsSucceed(USABLE_INVITE));

    await redeemInviteForLocalSignup(SIGNUP, handle as never);

    // The crux. A redemption that opened its own transaction would commit its
    // writes independently, and the caller's rollback would leave them behind.
    expect(transaction).not.toHaveBeenCalled();
    expect(order()).toContain('select');
    expect(order()).toContain('insert');
  });

  it('locks, checks, inserts, then advances the counter - in that order', async () => {
    const { redeemInviteForLocalSignup } = await import('./invite.service.js');
    const { handle, order } = fakeTx(allStatementsSucceed(USABLE_INVITE));

    await redeemInviteForLocalSignup(SIGNUP, handle as never);

    // That order is what stops two people racing the last use of a code.
    // Widening the transaction around it is fine; reordering it is not.
    const calls = order();
    expect(calls.indexOf('for(update)')).toBeGreaterThan(-1);
    expect(calls.indexOf('for(update)')).toBeLessThan(calls.indexOf('insert'));

    // The tail matters as much as the head: deleting the counter advance
    // entirely used to pass every test in this file, and leaves a max_uses:1
    // code redeemable without limit.
    expect(calls.indexOf('insert')).toBeLessThan(calls.indexOf('set'));
  });

  it('advances the counter by one and leaves a code with uses left active', async () => {
    const { redeemInviteForLocalSignup } = await import('./invite.service.js');
    const { handle, firstArgOf } = fakeTx(allStatementsSucceed(USABLE_INVITE));

    await redeemInviteForLocalSignup(SIGNUP, handle as never);

    expect(firstArgOf('set')).toMatchObject({ used_count: 1, status: 'active' });
  });

  it('spends a code that this redemption takes to its limit', async () => {
    const { redeemInviteForLocalSignup } = await import('./invite.service.js');
    const lastUse = { ...USABLE_INVITE, max_uses: 1, used_count: 0 };
    const { handle, firstArgOf } = fakeTx(allStatementsSucceed(lastUse));

    await redeemInviteForLocalSignup(SIGNUP, handle as never);

    expect(firstArgOf('set')).toMatchObject({ used_count: 1, status: 'used' });
  });

  it('advances the counter on this invite row, and only this one', async () => {
    const { redeemInviteForLocalSignup } = await import('./invite.service.js');
    const { handle, firstArgAfter } = fakeTx(allStatementsSucceed(USABLE_INVITE));

    await redeemInviteForLocalSignup(SIGNUP, handle as never);

    // Anchored on the WHERE that follows `set`, because the lock read issues
    // one too. Two failure modes, both of which typecheck and lint:
    // dropping the clause spends every invite code in every organization on
    // one signup, and keying it on `code` instead of `code_id` matches nothing,
    // so a max_uses:1 code is redeemable without limit. The bound parameter is
    // the load-bearing half - the SQL text alone is identical for the second.
    const { sql, params } = renderSql(firstArgAfter('set', 'where'));
    expect(sql).toBe('"org_invite_codes"."code_id" = $1');
    expect(params).toEqual([USABLE_INVITE.code_id]);
  });

  it('takes the role and organization from the invite, never from the request', async () => {
    const { redeemInviteForLocalSignup } = await import('./invite.service.js');
    const { handle, firstArgOf } = fakeTx(allStatementsSucceed(USABLE_INVITE));

    await redeemInviteForLocalSignup(SIGNUP, handle as never);

    // This is the escalation guard. Anything but the invite's own values here
    // is how someone holding an org id mints themselves an admin.
    expect(firstArgOf('values')).toMatchObject({
      role: 'OrgEmployee',
      organization_id: 'o1',
      email: SIGNUP.email,
      name: SIGNUP.name,
      // The caller generates this; dropping it on the floor would leave every
      // provisioned account with an empty password column.
      password: SIGNUP.password,
    });
  });

  it('refuses an exhausted code before inserting, so the caller can roll back', async () => {
    const { redeemInviteForLocalSignup } = await import('./invite.service.js');
    const exhausted = { ...USABLE_INVITE, used_count: 5, max_uses: 5 };
    // Fully stocked on purpose: if the usability check were deleted, execution
    // would reach the insert and SUCCEED rather than crash, so a bare
    // `.rejects.toThrow()` could not tell the two apart. This can only fail.
    const { handle, order } = fakeTx(allStatementsSucceed(exhausted));

    const error = await redeemInviteForLocalSignup(SIGNUP, handle as never).catch(
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(InviteError);
    expect((error as InviteError).reason).toBe('exhausted');
    // It threw BEFORE inserting, which is what lets the magic-link claim above
    // it roll back and leave the link usable.
    expect(order()).not.toContain('insert');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('opens its own transaction when it is not given one', async () => {
    const { redeemInviteForLocalSignup } = await import('./invite.service.js');
    transaction.mockResolvedValue({ user: { user_id: 'u1' }, invite: USABLE_INVITE });

    await redeemInviteForLocalSignup(SIGNUP);

    // The signup route has no transaction of its own, and must keep working.
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
