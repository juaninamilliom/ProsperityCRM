import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { organizationInputSchema } from './organization.schema';
import { createOrganization, listOrganizations, updateOrganization } from './organization.service';

export const organizationRouter = Router();

organizationRouter.get('/', async (_req, res) => {
  const organizations = await listOrganizations();
  res.json(organizations);
});

organizationRouter.post('/', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = organizationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const organization = await createOrganization(parsed.data);
  res.status(201).json(organization);
});

organizationRouter.put('/:id', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = organizationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const organization = await updateOrganization(req.params.id, parsed.data);
  res.json(organization);
});
