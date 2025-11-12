import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { ssoSignupSchema, updateRoleSchema } from './user.schema';
import { getUserById, getUserBySsoId, updateUserRoleAndOrg, upsertUser } from './user.service';
import { redeemInviteCode } from '../invite/invite.service';

export const userRouter = Router();

userRouter.get('/me', async (req: AuthenticatedRequest, res) => {
  if (req.dbUser) {
    return res.json({
      tokenUser: req.user ?? { sub: req.dbUser.user_id, email: req.dbUser.email, name: req.dbUser.name },
      dbUser: req.dbUser,
    });
  }

  if (!req.user?.sub) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }

  const dbUser = await getUserBySsoId(req.user.sub);
  res.json({
    tokenUser: req.user,
    dbUser,
  });
});

userRouter.post('/sso', async (req, res) => {
  const parsed = ssoSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const existing = await getUserBySsoId(parsed.data.sso_id);
  if (existing) {
    const updated = await upsertUser({
      email: parsed.data.email,
      name: parsed.data.name,
      sso_id: parsed.data.sso_id,
      organization_id: existing.organization_id,
      role: existing.role,
    });
    return res.json(updated);
  }

  if (!parsed.data.passcode) {
    return res.status(400).json({ message: 'Passcode required for first-time sign-in' });
  }

  try {
    const { user } = await redeemInviteCode({
      code: parsed.data.passcode,
      userPayload: {
        email: parsed.data.email,
        name: parsed.data.name,
        sso_id: parsed.data.sso_id,
      },
    });
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

userRouter.patch('/:id/role', requireRole('OrgAdmin'), async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const target = await getUserById(req.params.id);
  if (!target || target.organization_id !== req.dbUser.organization_id) {
    return res.status(404).json({ message: 'User not found in your organization' });
  }

  const updated = await updateUserRoleAndOrg({
    userId: target.user_id,
    organizationId: target.organization_id,
    role: parsed.data.role,
  });

  res.json(updated);
});
