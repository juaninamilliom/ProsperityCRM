import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { createInviteSchema } from './invite.schema';
import { createInviteCode, getInviteByCode, getInviteCodesForOrg, revokeInviteCode } from './invite.service';

export const inviteRouter = Router();

inviteRouter.get('/organizations/:orgId/invite-codes', requireRole('OrgAdmin'), async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser || req.dbUser.organization_id !== req.params.orgId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const invites = await getInviteCodesForOrg(req.params.orgId);
  res.json(invites);
});

inviteRouter.post('/organizations/:orgId/invite-codes', requireRole('OrgAdmin'), async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser || req.dbUser.organization_id !== req.params.orgId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const invite = await createInviteCode({
    organizationId: req.params.orgId,
    role: parsed.data.role,
    createdBy: req.dbUser.user_id,
    maxUses: parsed.data.maxUses,
  });
  res.status(201).json(invite);
});

inviteRouter.post('/invite-codes/:code/revoke', requireRole('OrgAdmin'), async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const invite = await getInviteByCode(req.params.code);
  if (!invite || invite.organization_id !== req.dbUser.organization_id) {
    return res.status(404).json({ message: 'Invite not found' });
  }
  await revokeInviteCode({ code: req.params.code, revokedBy: req.dbUser.user_id });
  res.status(204).send();
});
