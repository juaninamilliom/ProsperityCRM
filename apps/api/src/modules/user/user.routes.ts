import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import { createUserSchema, updateRoleSchema } from './user.schema.js';
import { createLocalUser, getUserByEmail, getUserById, getUserBySsoId, listUsersByOrg, updateUserRoleAndOrg } from './user.service.js';
import { toPublicUser } from './public-user.js';

export const userRouter = Router();

userRouter.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const users = await listUsersByOrg(req.dbUser.organization_id);
  res.json(users.map(toPublicUser));
});

userRouter.post('/', requireRole('OrgAdmin'), async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const user = await createLocalUser({
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name,
    organization_id: req.dbUser.organization_id,
    role: parsed.data.role,
  });

  res.status(201).json(toPublicUser(user));
});


userRouter.get('/me', async (req: AuthenticatedRequest, res) => {
  if (req.dbUser) {
    return res.json({
      tokenUser: req.user ?? { sub: req.dbUser.user_id, email: req.dbUser.email, name: req.dbUser.name },
      dbUser: toPublicUser(req.dbUser),
    });
  }

  if (!req.user?.sub) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }

  const dbUser = await getUserBySsoId(req.user.sub);
  res.json({
    tokenUser: req.user,
    dbUser: dbUser ? toPublicUser(dbUser) : dbUser,
  });
});

/* There is deliberately no POST /users/sso.
 *
 * It let any authenticated employee rewrite another user's email by sso_id and
 * then take that account over through the magic-link flow, and its first-time
 * branch was unreachable anyway: the router is mounted after authMiddleware,
 * so a brand-new SSO user is rejected before ever reaching it.
 *
 * When SSO is genuinely wired up it needs a route mounted BEFORE the auth
 * middleware, alongside the other unauthenticated auth routes. Rebuilding it
 * there is cleaner than carrying a broken one here. */

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

  res.json(updated ? toPublicUser(updated) : updated);
});
