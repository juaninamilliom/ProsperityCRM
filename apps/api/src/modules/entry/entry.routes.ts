import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  createEntry,
  deleteEntry,
  getEntryById,
  listEntries,
  moveEntry,
  updateEntry,
} from './entry.service.js';
import {
  createEntrySchema,
  entryQuerySchema,
  moveEntrySchema,
  updateEntrySchema,
} from './entry.schema.js';

export const entryRouter = Router();

entryRouter.get('/', async (req, res) => {
  const parsed = entryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.json(await listEntries(parsed.data));
});

entryRouter.get('/:id', async (req, res) => {
  const entry = await getEntryById(req.params.id);
  if (!entry) {
    return res.status(404).json({ message: 'Pipeline entry not found' });
  }
  res.json(entry);
});

entryRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.status(201).json(await createEntry(parsed.data, req.dbUser.organization_id));
});

entryRouter.put('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = updateEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.json(await updateEntry(req.params.id, parsed.data));
});

entryRouter.delete('/:id', async (req, res) => {
  await deleteEntry(req.params.id);
  res.status(204).send();
});

entryRouter.post('/:id/move_status', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = moveEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  // changed_by is a foreign key to users(user_id); the token's sub is only the
  // same value under local auth, so read the resolved row instead.
  const moved = await moveEntry({
    entryId: req.params.id,
    toStatusId: parsed.data.to_status_id,
    changedBy: req.dbUser.user_id,
  });

  res.json(moved);
});
