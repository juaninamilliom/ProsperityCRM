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

  const [linkRecord] = await db
    .select()
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.token_hash, tokenHash),
        isNull(magicLinks.used_at),
        gt(magicLinks.expires_at, new Date())
      )
    );

  if (!linkRecord) {
    throw new Error('This sign-in link is invalid or has expired. Please request a new one.');
  }

  // Mark as used immediately to prevent replay
  await db
    .update(magicLinks)
    .set({ used_at: new Date() })
    .where(eq(magicLinks.link_id, linkRecord.link_id));

  let user = await getUserByEmail(linkRecord.email);

  if (!user) {
    if (!linkRecord.invite_code) {
      throw new Error('User not found. Please sign up with an invite code first.');
    }

    // Auto-provision user with invite code
    const result = await redeemInviteForLocalSignup({
      code: linkRecord.invite_code,
      email: linkRecord.email,
      name: nameFallback || linkRecord.email.split('@')[0],
      password: crypto.randomBytes(16).toString('hex'),
    });
    user = result.user;
  }

  if (!user.is_active) {
    throw new Error('This account has been deactivated.');
  }

  const token = await createLocalToken(user);
  return { token, user: toPublicUser(user) };
}
