import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeTx, renderSql } from '../../test/fake-tx.js';

/** All three defects this fix addresses live in `verifyMagicLink`, and until
 *  this file existed nothing tested it - the sibling invite tests pin the
 *  callee's contract, so reverting this function wholesale left every suite
 *  green. The three, and the assertion that catches each:
 *
 *    1. select-then-update    a race two verifications could both win, both
 *                             walking away with a token. Pinned by asserting
 *                             the claim is ONE conditional update.
 *    2. claim before redeem   a bad code left a link already spent, so the
 *                             user was told it was invalid forever. Pinned by
 *                             asserting the redemption gets the caller's tx
 *                             and that a failed redemption is not swallowed.
 *    3. a read on `db` inside the transaction, which asks the pool for a
 *                             second connection while the first is held and
 *                             deadlocks the process. Pinned by asserting the
 *                             user read is handed the transaction.
 *
 *  The table objects are the REAL ones. Mocking them to plain strings made the
 *  predicate assertions substring matches, which cannot tell `and` from `or` -
 *  and `or` here matches every unused link, minting a token for an arbitrary
 *  account from a garbage token. `db/schema.ts` opens no connection, so there
 *  was never a reason to fake it.
 *
 *  The rollback itself needs a real database and no test here has one; the
 *  manual verification is in the PR. */

const transaction = vi.fn();

vi.mock('../../db/drizzle.js', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('../../db/schema.js')),
  db: { transaction },
}));
vi.mock('../user/user.service.js', () => ({ getUserByEmail: vi.fn() }));
vi.mock('../invite/invite.service.js', () => ({ redeemInviteForLocalSignup: vi.fn() }));
vi.mock('./token.js', () => ({ createLocalToken: vi.fn() }));
vi.mock('./email.service.js', () => ({ sendMagicLinkEmail: vi.fn() }));

const ACTIVE_USER = {
  user_id: 'u1',
  email: 'a@b.c',
  is_active: true,
  // Present on purpose: the response must not carry it out of the API.
  password: 'stored-secret',
};

/** A claimed magic_links row, as the conditional UPDATE returns it. */
const claimedLink = (overrides: Record<string, unknown> = {}) => ({
  email: 'a@b.c',
  invite_code: null,
  ...overrides,
});

/** Padded deliberately. With a clean fixture, dropping `.trim()` in
 *  production changed nothing and the mutation survived - a link pasted with
 *  a trailing newline out of an email client would then never verify. */
const RAW_TOKEN = '  raw-token\n';
const TOKEN_HASH = crypto.createHash('sha256').update(RAW_TOKEN.trim()).digest('hex');

let users: typeof import('../user/user.service.js');
let invites: typeof import('../invite/invite.service.js');
let tokens: typeof import('./token.js');

beforeEach(async () => {
  vi.clearAllMocks();
  users = await import('../user/user.service.js');
  invites = await import('../invite/invite.service.js');
  tokens = await import('./token.js');
  vi.mocked(tokens.createLocalToken).mockResolvedValue('signed-token');
});

/** Runs verifyMagicLink with `db.transaction` wired to a fake handle, and hands
 *  back the handle so callers can assert it was threaded through. */
async function verifyWith(results: unknown[]) {
  const tx = fakeTx(results);
  transaction.mockImplementation((callback: (handle: unknown) => unknown) => callback(tx.handle));
  const { verifyMagicLink } = await import('./magic-link.service.js');
  return { ...tx, run: (name?: string) => verifyMagicLink(RAW_TOKEN, name) };
}

describe('verifyMagicLink', () => {
  it('claims the link with one conditional update, never a select then an update', async () => {
    const { order, run } = await verifyWith([[claimedLink()]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(ACTIVE_USER as never);

    await run();

    // The race. The old shape read the row, then wrote it in a second
    // statement, so two verifications could both pass the read. A `select`
    // appearing here at all is that shape coming back.
    expect(order()).not.toContain('select');
    expect(order()[0]).toBe('update');
  });

  it('matches only an unused, unexpired link, on all three conditions at once', async () => {
    const { firstArgOf, run } = await verifyWith([[claimedLink()]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(ACTIVE_USER as never);

    await run();

    // Rendered, not substring-matched. Every one of these is a guard whose
    // removal typechecks and lints: dropping used_at makes a spent link
    // replayable for its whole window; dropping expires_at means a link in an
    // inbox never dies; and turning `and` into `or` matches EVERY unused link,
    // so any garbage token mints a token for whoever's row comes back.
    const { sql, params } = renderSql(firstArgOf('where'));
    expect(sql).toBe(
      '("magic_links"."token_hash" = $1 and "magic_links"."used_at" is null and ' +
        '"magic_links"."expires_at" > $2)'
    );
    // Matched by hash, never by the raw value out of the URL.
    expect(params[0]).toBe(TOKEN_HASH);
    // Compared against now, not a fixed instant that never expires anything.
    expect(Date.parse(params[1] as string)).toBeGreaterThan(Date.now() - 5_000);
  });

  it('marks the link used, which is what makes it single-use', async () => {
    const { firstArgOf, run } = await verifyWith([[claimedLink()]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(ACTIVE_USER as never);

    await run();

    // Writing null here leaves the predicate above matching forever, so the
    // link is replayable without limit. Every other assertion still holds.
    expect(firstArgOf('set')).toMatchObject({ used_at: expect.any(Date) });
  });

  it('reads the user on the transaction, not on a second pool connection', async () => {
    const { handle, run } = await verifyWith([[claimedLink()]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(ACTIVE_USER as never);

    await run();

    // A read on the module-level `db` here asks the pool for a second
    // connection while this transaction holds the first. Measured against the
    // real pool at max 10: ten concurrent verifications acquired 0 of 10 and
    // waited forever, with no connectionTimeoutMillis to break it.
    expect(users.getUserByEmail).toHaveBeenCalledWith('a@b.c', handle);
  });

  it('redeems the invite on the caller transaction, so a failure rolls the claim back', async () => {
    const { handle, run } = await verifyWith([[claimedLink({ invite_code: 'abc' })]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(undefined);
    vi.mocked(invites.redeemInviteForLocalSignup).mockResolvedValue({
      user: ACTIVE_USER,
    } as never);

    await run('Jane');

    expect(invites.redeemInviteForLocalSignup).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'abc', email: 'a@b.c', name: 'Jane' }),
      handle
    );
  });

  it('gives each provisioned account its own password', async () => {
    const passwordFrom = async () => {
      const { run } = await verifyWith([[claimedLink({ invite_code: 'abc' })]]);
      vi.mocked(users.getUserByEmail).mockResolvedValue(undefined);
      vi.mocked(invites.redeemInviteForLocalSignup).mockResolvedValue({
        user: ACTIVE_USER,
      } as never);
      await run();
      return vi.mocked(invites.redeemInviteForLocalSignup).mock.calls.at(-1)?.[0].password;
    };

    const [first, second] = [await passwordFrom(), await passwordFrom()];

    // Shape alone is not enough: a hardcoded 32-character hex constant matches
    // any regex for the right shape. Local login compares this column in
    // plaintext, so a constant is one shared password across every
    // magic-link-provisioned account.
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
  });

  it('does the whole verification in a single transaction', async () => {
    const { run } = await verifyWith([[claimedLink()]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(ACTIVE_USER as never);

    await run();

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('does not return the stored password to the caller', async () => {
    const { run } = await verifyWith([[claimedLink()]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(ACTIVE_USER as never);

    const result = await run();

    // The response boundary is the only place this column is stripped, so
    // skipping it here puts the password in the verify response.
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).toMatchObject({ user_id: 'u1', email: 'a@b.c' });
  });

  it('refuses a link that is already used or expired, without redeeming', async () => {
    // The conditional update matched nothing, which is how a used or expired
    // link now presents - there is no separate read to disagree with it.
    const { run } = await verifyWith([[]]);

    await expect(run()).rejects.toThrow(/invalid or has expired/);
    expect(invites.redeemInviteForLocalSignup).not.toHaveBeenCalled();
    expect(tokens.createLocalToken).not.toHaveBeenCalled();
  });

  it('lets a failed redemption escape, rather than swallowing it', async () => {
    const { run } = await verifyWith([[claimedLink({ invite_code: 'abc' })]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(undefined);
    vi.mocked(invites.redeemInviteForLocalSignup).mockRejectedValue(
      new Error('That invite code has been revoked.')
    );

    // Catching here would commit the claim and burn the link on a failure the
    // user cannot fix - the original bug, restated.
    await expect(run()).rejects.toThrow(/revoked/);
    expect(tokens.createLocalToken).not.toHaveBeenCalled();
  });

  it('does not redeem anything for a user who already exists', async () => {
    const { run } = await verifyWith([[claimedLink({ invite_code: 'abc' })]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(ACTIVE_USER as never);

    const result = await run();

    expect(invites.redeemInviteForLocalSignup).not.toHaveBeenCalled();
    expect(result.token).toBe('signed-token');
  });

  it('refuses a deactivated account and issues no token', async () => {
    const { run } = await verifyWith([[claimedLink()]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue({
      ...ACTIVE_USER,
      is_active: false,
    } as never);

    await expect(run()).rejects.toThrow(/deactivated/);
    expect(tokens.createLocalToken).not.toHaveBeenCalled();
  });

  it('refuses an unknown user with no invite code on the link', async () => {
    const { run } = await verifyWith([[claimedLink({ invite_code: null })]]);
    vi.mocked(users.getUserByEmail).mockResolvedValue(undefined);

    await expect(run()).rejects.toThrow(/sign up with an invite code/);
    expect(tokens.createLocalToken).not.toHaveBeenCalled();
  });
});
