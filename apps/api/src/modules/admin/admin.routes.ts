import { Router } from 'express';
import { organizationInputSchema } from '../organization/organization.schema';
import { createOrganization } from '../organization/organization.service';
import { updateUserRoleAndOrg } from '../user/user.service';
import { createInviteSchema } from '../invite/invite.schema';
import { createInviteCode } from '../invite/invite.service';
import { requireRootAdmin } from '../../middleware/root-admin';

export const adminRouter = Router();

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
  const updated = await updateUserRoleAndOrg({ userId: user_id, organizationId: req.params.id, role: 'OrgAdmin' });
  res.json(updated);
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
