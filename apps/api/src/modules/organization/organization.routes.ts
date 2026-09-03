import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import { organizationInputSchema } from './organization.schema.js';
import { getOrganizationById, updateOrganization } from './organization.service.js';

/** `requireRole` checks the role and nothing else, so every route keyed by an
 *  organization id has to compare that id to the caller's own. The invite
 *  routes do; these did not, so any OrgAdmin could read every tenant and
 *  rename any of them. */
export const organizationRouter = Router();

organizationRouter.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  // Was an unfiltered list of every tenant, returned to any authenticated
  // user. Kept as an array so the response shape does not change.
  const organization = await getOrganizationById(req.dbUser.organization_id);
  res.json(organization ? [organization] : []);
});

/* There is deliberately no POST /organizations.
 *
 * It was guarded only by requireRole('OrgAdmin'), so any organization admin
 * could mint new tenants. POST /admin/organizations is the same handler behind
 * the root-admin header, which is where creating a tenant belongs. */

organizationRouter.put('/:id', requireRole('OrgAdmin'), async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser || req.dbUser.organization_id !== req.params.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const parsed = organizationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  // From the authenticated identity, not the path. They are provably equal by
  // the check above, so this is free - and it means a future edit to that
  // check cannot reopen a cross-tenant write.
  const organization = await updateOrganization(req.dbUser.organization_id, parsed.data);
  res.json(organization);
});
