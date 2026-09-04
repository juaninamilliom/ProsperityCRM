import crypto from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { config } from '../../config.js';
import { db } from '../../db/drizzle.js';
import { magicLinks } from '../../db/schema.js';
import { getUserByEmail } from '../user/user.service.js';
import { toPublicUser } from '../user/public-user.js';
import { redeemInviteForLocalSignup } from '../invite/invite.service.js';
import { resolveTrustedOrigin } from './origin.js';
import { createLocalToken } from './token.js';
import { sendMagicLinkEmail } from './email.service.js';

interface RequestMagicLinkOptions {
  email: string;
  inviteCode?: string;
  name?: string;
  originHeader?: string;
}

export async function requestMagicLink({
  email,
  inviteCode,
  originHeader,
}: RequestMagicLinkOptions) {
  const cleanEmail = email.trim().toLowerCase();
  const existingUser = await getUserByEmail(cleanEmail);

  if (!existingUser && !inviteCode) {
    throw new Error(
      'No account found with this email. If you are joining a team, please enter your invite code.'
    );
  }

  if (existingUser && !existingUser.is_active) {
    throw new Error('This account has been deactivated.');
  }

  // Generate 32-byte secure random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const origin = resolveTrustedOrigin(originHeader, config.corsOrigins, config.appBaseUrl);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(magicLinks).values({
    email: cleanEmail,
    token_hash: tokenHash,
    invite_code: inviteCode?.trim() || null,
    expires_at: expiresAt,
  });

  const magicUrl = `${origin}/login?magic_token=${rawToken}`;

  // Dispatch email via Resend, SMTP/Gmail, or Brevo
  await sendMagicLinkEmail({ to: cleanEmail, magicUrl });

  return {
    success: true,
    message: `Sign-in link sent to ${cleanEmail}! Please check your inbox.`,
    // Opt in explicitly. This was gated on NODE_ENV !== 'production', and
    // render.yaml never sets NODE_ENV, so an unconfigured deployment handed
    // the raw sign-in token to any unauthenticated caller.
    devUrl: process.env.MAGIC_LINK_DEV_URL === 'true' ? magicUrl : undefined,
  };
}

export async function verifyMagicLink(rawToken: string, nameFallback?: string) {
  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

  /** Claiming the link and redeeming the invite happen together, or not at all.
   *
   *  Before, the link was marked used and THEN the code was redeemed, so a bad
   *  or exhausted code left a link that was already spent: the user was told
   *  the link was invalid, requesting a new one hit the same wall, and nothing
   *  ever mentioned the invite. Rolling back leaves the link unused, which is
   *  the honest state - nothing was consumed. */
  return db.transaction(async (tx) => {
    /** One conditional update, not a select and then an update. That pair was a
     *  race two concurrent verifications could both win: both passed the
     *  select, both wrote used_at, both received a token. Here the row is
     *  claimed by the same statement that tests it, so exactly one caller can
     *  match it. */
    const [claimed] = await tx
      .update(magicLinks)
      .set({ used_at: new Date() })
      .where(
        and(
          eq(magicLinks.token_hash, tokenHash),
          isNull(magicLinks.used_at),
          gt(magicLinks.expires_at, new Date())
        )
      )
      .returning();

    if (!claimed) {
      throw new Error('This sign-in link is invalid or has expired. Please request a new one.');
    }

    /** On `tx`, not on the module-level `db`. A read on `db` here would ask the
     *  pool for a second connection while this transaction holds the first;
     *  measured against the real pool, ten concurrent verifications acquired 0
     *  of 10 and waited forever, taking every route down with them. */
    let user = await getUserByEmail(claimed.email, tx);

    if (!user) {
      if (!claimed.invite_code) {
        throw new Error('User not found. Please sign up with an invite code first.');
      }

      // Inside the same transaction: if the code is revoked or exhausted this
      // throws, the claim above rolls back, and the link is still usable.
      const result = await redeemInviteForLocalSignup(
        {
          code: claimed.invite_code,
          email: claimed.email,
          name: nameFallback || claimed.email.split('@')[0],
          password: crypto.randomBytes(16).toString('hex'),
        },
        tx
      );
      user = result.user;
    }

    if (!user.is_active) {
      throw new Error('This account has been deactivated.');
    }

    const token = await createLocalToken(user);
    return { token, user: toPublicUser(user) };
  });
}
