import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { classify } from '../../common/pg-errors.js';
import {
  createEntry,
  deleteEntry,
  findDuplicateEntry,
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
  /** A duplicate entry was an unexplained 500 where person and company both
   *  return a 409 with the existing row. The body matches theirs verbatim, so a
   *  page copying either handler renders this with no extra work.
   *
   *  classify rather than a bare unique-violation check, which closes two more
   *  500 classes on the same path: a bad person_id, company_id, job_id,
   *  current_status_id or recruiter_id raises 23503 and becomes a 400, and
   *  since createEntrySchema validates those as z.string().min(1), a non-uuid
   *  string passes zod, reaches the driver as 22P02, and becomes a 400 too. */
  try {
    res.status(201).json(await createEntry(parsed.data, req.dbUser.organization_id));
  } catch (error) {
    const conflict = classify(error, 'insert');
    if (!conflict) throw error;
    if (conflict.code !== 'duplicate') {
      return res.status(conflict.status).json({ message: conflict.message });
    }
    const existing = await findDuplicateEntry(parsed.data.person_id, parsed.data.job_id);
    res.status(409).json({ message: 'This person is already on this requisition', existing });
  }
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
