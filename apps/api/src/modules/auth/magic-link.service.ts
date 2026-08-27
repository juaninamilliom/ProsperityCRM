import crypto from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../db/drizzle.js';
import { magicLinks, users } from '../../db/schema.js';
import { getUserByEmail } from '../user/user.service.js';
import { toPublicUser } from '../user/public-user.js';
import { redeemInviteForLocalSignup } from '../invite/invite.service.js';
import { createLocalToken } from './token.js';

interface RequestMagicLinkOptions {
  email: string;
  inviteCode?: string;
  name?: string;
  originHeader?: string;
}

export async function requestMagicLink({
  email,
  inviteCode,
  name,
  originHeader,
}: RequestMagicLinkOptions) {
  const cleanEmail = email.trim().toLowerCase();
  const existingUser = await getUserByEmail(cleanEmail);

  if (!existingUser && !inviteCode) {
    throw new Error(
      'No account found with this email. If you have an invite code, please include it.'
    );
  }

  if (existingUser && !existingUser.is_active) {
    throw new Error('This account has been deactivated.');
  }

  // Generate 32-byte secure random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const origin = (originHeader || 'http://localhost:5173').replace(/\/+$/, '');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(magicLinks).values({
    email: cleanEmail,
    token_hash: tokenHash,
    invite_code: inviteCode?.trim() || null,
    expires_at: expiresAt,
  });

  const magicUrl = `${origin}/login?magic_token=${rawToken}`;

  // Log prominently for dev/staging
  console.log(`\n========================================`);
  console.log(`✨ [Magic Link] Sign-in link for: ${cleanEmail}`);
  console.log(`🔗 URL: ${magicUrl}`);
  console.log(`========================================\n`);

  // Optional: Send email if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || 'Prosperity CRM <onboarding@resend.dev>';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanEmail],
          subject: 'Sign in to Prosperity CRM',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 20px;">
              <h2 style="color: #111827; margin-bottom: 16px;">Sign in to Prosperity CRM</h2>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">Click the button below to sign in instantly. This link will expire in 15 minutes.</p>
              <div style="margin: 28px 0;">
                <a href="${magicUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                  Sign In to Prosperity CRM
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 13px;">If you did not request this link, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('[Magic Link] Error sending email via Resend:', err);
    }
  }

  return {
    success: true,
    message: 'Magic link sent! Check your inbox or server log.',
    // Included in dev mode for ease of development
    devUrl: process.env.NODE_ENV !== 'production' ? magicUrl : undefined,
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
      password: crypto.randomBytes(16).toString('hex'), // Random password since user uses magic links/passkeys
    });
    user = result.user;
  }

  if (!user.is_active) {
    throw new Error('This account has been deactivated.');
  }

  const token = await createLocalToken(user);
  return { token, user: toPublicUser(user) };
}
