import { Router } from 'express';
import { loginSchema, signupSchema } from './auth.schema.js';
import { createLocalToken } from './token.js';
import { createLocalUser, getUserByEmail } from '../user/user.service.js';
import { getOrganizationById } from '../organization/organization.service.js';

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

  const org = await getOrganizationById(parsed.data.organization_id);
  if (!org) {
    return res.status(404).json({ message: 'Organization not found' });
  }

  const user = await createLocalUser(parsed.data);
  const token = await createLocalToken(user);
  res.status(201).json({ token, user });
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
  res.json({ token, user });
});
