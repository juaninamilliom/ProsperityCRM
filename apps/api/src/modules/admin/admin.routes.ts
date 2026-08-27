import { Router } from 'express';
import { organizationInputSchema } from '../organization/organization.schema.js';
import { createOrganization, listOrganizations } from '../organization/organization.service.js';
import { adminCreateUserSchema, createUserSchema } from '../user/user.schema.js';
import { createLocalUser, deleteUser, getUserByEmail, listAllUsers, updateUserRoleAndOrg } from '../user/user.service.js';
import { createInviteSchema } from '../invite/invite.schema.js';
import { createInviteCode } from '../invite/invite.service.js';
import { requireRootAdmin } from '../../middleware/root-admin.js';
import { toPublicUser } from '../user/public-user.js';

export const adminRouter = Router();

adminRouter.get('/organizations', requireRootAdmin, async (_req, res) => {
  const orgs = await listOrganizations();
  res.json(orgs);
});

adminRouter.post('/organizations', requireRootAdmin, async (req, res) => {
  const parsed = organizationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const org = await createOrganization(parsed.data);
  res.status(201).json(org);
});

adminRouter.post('/organizations/:id/admins', requireRootAdmin, async (req, res) => {
  const { user_id } = req.body as { user_id?: string };
  if (!user_id) {
    return res.status(400).json({ message: 'user_id required' });
  }
  const updated = await updateUserRoleAndOrg({
    userId: user_id,
    organizationId: req.params.id,
    role: 'OrgAdmin',
  });
  res.json(updated ? toPublicUser(updated) : updated);
});

adminRouter.post('/organizations/:id/users', requireRootAdmin, async (req, res) => {
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
    organization_id: req.params.id,
    role: parsed.data.role,
  });
  res.status(201).json(toPublicUser(user));
});

adminRouter.get('/users', requireRootAdmin, async (_req, res) => {
  const users = await listAllUsers();
  res.json(users);
});

adminRouter.post('/users', requireRootAdmin, async (req, res) => {
  const parsed = adminCreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  let orgId = parsed.data.organization_id;
  if (!orgId) {
    const orgs = await listOrganizations();
    if (!orgs.length) {
      return res.status(400).json({ message: 'No organization exists yet. Create one first.' });
    }
    orgId = orgs[0].organization_id;
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const user = await createLocalUser({
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name,
    organization_id: orgId,
    role: parsed.data.role,
  });
  res.status(201).json(toPublicUser(user));
});

adminRouter.delete('/users/:id', requireRootAdmin, async (req, res) => {
  await deleteUser(req.params.id);
  res.status(204).end();
});

adminRouter.post('/organizations/:id/invite-codes', requireRootAdmin, async (req, res) => {
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const invite = await createInviteCode({
    organizationId: req.params.id,
    role: parsed.data.role,
    maxUses: parsed.data.maxUses,
  });
  res.status(201).json(invite);
});

