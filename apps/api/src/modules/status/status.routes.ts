import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { statusInputSchema } from './status.schema.js';
import { createStatus, deleteStatus, listStatuses, updateStatus } from './status.service.js';

export const statusRouter = Router();

statusRouter.get('/', async (_req, res) => {
  const statuses = await listStatuses();
  res.json(statuses);
});

statusRouter.post('/', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = statusInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const status = await createStatus(parsed.data);
  res.status(201).json(status);
});

statusRouter.put('/:id', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = statusInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const status = await updateStatus(req.params.id, parsed.data);
  res.json(status);
});

statusRouter.delete('/:id', requireRole('OrgAdmin'), async (req, res) => {
  await deleteStatus(req.params.id);
  res.status(204).send();
});
