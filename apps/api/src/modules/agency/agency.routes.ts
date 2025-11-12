import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { agencyInputSchema } from './agency.schema';
import { createAgency, deleteAgency, listAgencies, updateAgency } from './agency.service';

export const agencyRouter = Router();

agencyRouter.get('/', async (_req, res) => {
  const agencies = await listAgencies();
  res.json(agencies);
});

agencyRouter.post('/', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = agencyInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const agency = await createAgency(parsed.data);
  res.status(201).json(agency);
});

agencyRouter.put('/:id', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = agencyInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const agency = await updateAgency(req.params.id, parsed.data);
  res.json(agency);
});

agencyRouter.delete('/:id', requireRole('OrgAdmin'), async (req, res) => {
  await deleteAgency(req.params.id);
  res.status(204).send();
});
