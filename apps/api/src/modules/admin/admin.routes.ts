import { Router } from 'express';
import { organizationInputSchema } from '../organization/organization.schema.js';
import { createOrganization, listOrganizations } from '../organization/organization.service.js';
import { adminCreateUserSchema, createUserSchema } from '../user/user.schema.js';
import { classify, listPhrase } from '../../common/pg-errors.js';
import { countUserDependents, createLocalUser, deleteUser, getUserByEmail, listAllUsers, updateUserRoleAndOrg } from '../user/user.service.js';
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
  /** Six foreign keys point at users and none cascades, so deleting a user who
   *  has done anything was a bare 500.
   *
   *  This blocks rather than nulling the references out, because
   *  pipeline_entries.recruiter_id is NOT NULL (0010:97) — there is no
   *  nulling-out option. Reassigning a departing recruiter's pipeline is a
   *  feature, and a delete guard is the wrong place to improvise one. */
  try {
    await deleteUser(req.params.id);
  } catch (error) {
    const conflict = classify(error, 'delete');
    if (!conflict) throw error;
    if (conflict.code !== 'has_dependents') {
      return res.status(conflict.status).json({ message: conflict.message });
    }
    const dependents = await countUserDependents(req.params.id);
    const parts: string[] = [];
    if (dependents.entries > 0) {
      parts.push(
        `is the recruiter on ${dependents.entries} pipeline ${
          dependents.entries === 1 ? 'entry' : 'entries'
        }`
      );
    }
    if (dependents.deals > 0) {
      parts.push(`owns ${dependents.deals} ${dependents.deals === 1 ? 'deal' : 'deals'}`);
    }
    if (dependents.activities > 0) {
      parts.push(
        `appears on ${dependents.activities} ${
          dependents.activities === 1 ? 'activity' : 'activities'
        }`
      );
    }
    if (dependents.history > 0) {
      parts.push(
        `recorded ${dependents.history} status ${dependents.history === 1 ? 'change' : 'changes'}`
      );
    }
    if (dependents.invites > 0) {
      parts.push(
        `issued ${dependents.invites} invite ${dependents.invites === 1 ? 'code' : 'codes'}`
      );
    }
    return res.status(409).json({
      message:
        parts.length > 0
          ? `This user ${listPhrase(parts)}.`
          : 'Something still refers to this user.',
      dependents,
    });
  }
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

