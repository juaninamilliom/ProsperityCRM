import { Router } from 'express';
import { loginSchema, signupSchema } from './auth.schema.js';
import { createLocalToken } from './token.js';
import { getUserByEmail } from '../user/user.service.js';
import { toPublicUser } from '../user/public-user.js';
import { redeemInviteForLocalSignup } from '../invite/invite.service.js';
import { InviteError } from '../invite/invite.rules.js';

export const authRouter = Router();

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
    // The invite code decides the organisation and the role; both are ignored
    // if sent in the body. Redemption and user creation share one transaction.
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
