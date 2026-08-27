import { Router } from 'express';
import {
  loginSchema,
  magicLinkRequestSchema,
  magicLinkVerifySchema,
  passkeyLoginOptionsSchema,
  passkeyLoginVerifySchema,
  passkeyRegisterVerifySchema,
  signupSchema,
} from './auth.schema.js';
import { createLocalToken } from './token.js';
import { getUserByEmail } from '../user/user.service.js';
import { toPublicUser } from '../user/public-user.js';
import { redeemInviteForLocalSignup } from '../invite/invite.service.js';
import { InviteError } from '../invite/invite.rules.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth.js';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  deleteUserPasskey,
  generatePasskeyAuthOptions,
  generatePasskeyRegistrationOptions,
  listUserPasskeys,
  verifyPasskeyAuth,
  verifyPasskeyRegistration,
} from './passkey.service.js';
import { requestMagicLink, verifyMagicLink } from './magic-link.service.js';

export const authRouter = Router();

// ─── Traditional Auth ────────────────────────────────────────────────────────

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  try {
    const { user } = await redeemInviteForLocalSignup({
      code: parsed.data.invite_code.trim(),
      email: parsed.data.email,
      name: parsed.data.name,
      password: parsed.data.password,
    });
    const token = await createLocalToken(user);
    return res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    if (error instanceof InviteError) {
      return res.status(400).json({ message: error.message, reason: error.reason });
    }
    throw error;
  }
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const user = await getUserByEmail(parsed.data.email);
  if (!user || !user.password || !user.is_active) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.password !== parsed.data.password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = await createLocalToken(user);
  res.json({ token, user: toPublicUser(user) });
});

// ─── Magic Link Auth ─────────────────────────────────────────────────────────

authRouter.post('/magic-link/request', async (req, res) => {
  const parsed = magicLinkRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    const origin = req.headers.origin as string | undefined;
    const result = await requestMagicLink({
      email: parsed.data.email,
      inviteCode: parsed.data.invite_code,
      name: parsed.data.name,
      originHeader: origin,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

authRouter.post('/magic-link/verify', async (req, res) => {
  const parsed = magicLinkVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    const result = await verifyMagicLink(parsed.data.token, parsed.data.name);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ─── Passkey (WebAuthn / Biometric) Auth ──────────────────────────────────────

authRouter.post('/passkey/login-options', async (req, res) => {
  const parsed = passkeyLoginOptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const origin = req.headers.origin as string | undefined;
  const result = await generatePasskeyAuthOptions(parsed.data.email, origin);
  res.json(result);
});

authRouter.post('/passkey/login-verify', async (req, res) => {
  const parsed = passkeyLoginVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    const origin = req.headers.origin as string | undefined;
    const result = await verifyPasskeyAuth(
      parsed.data.response as AuthenticationResponseJSON,
      parsed.data.challengeId,
      origin
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Authenticated passkey registration and management
authRouter.post('/passkey/register-options', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const origin = req.headers.origin as string | undefined;
  const result = await generatePasskeyRegistrationOptions(req.dbUser, origin);
  res.json(result);
});

authRouter.post('/passkey/register-verify', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const parsed = passkeyRegisterVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    const origin = req.headers.origin as string | undefined;
    const result = await verifyPasskeyRegistration(
      req.dbUser,
      parsed.data.response as RegistrationResponseJSON,
      parsed.data.challengeId,
      parsed.data.deviceName,
      origin
    );
    res.status(201).json({ success: true, passkey: result });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

authRouter.get('/passkeys', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const userPasskeys = await listUserPasskeys(req.dbUser.user_id);
  res.json(userPasskeys);
});

authRouter.delete('/passkeys/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  await deleteUserPasskey(req.dbUser.user_id, req.params.id);
  res.status(204).end();
});
