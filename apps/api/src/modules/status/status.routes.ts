import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { statusInputSchema } from './status.schema.js';
import { classify, listPhrase } from '../../common/pg-errors.js';
import {
  countStatusDependents,
  createStatus,
  deleteStatus,
  listStatuses,
  updateStatus,
} from './status.service.js';

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
  /** pipeline_entries.current_status_id (0010:96) and both direction columns of
   *  entry_status_history (0010:113-114) are NO ACTION, so this was a bare 500.
   *
   *  The history half is the trap worth naming: a status with no live entries
   *  can still be undeletable because past transitions refer to it. That is
   *  right — deleting it would erase what those transitions meant — but the
   *  message has to say so, or an admin moves every entry off the status and
   *  gets the same 409 with nothing left to act on. */
  try {
    await deleteStatus(req.params.id);
  } catch (error) {
    const conflict = classify(error, 'delete');
    if (!conflict) throw error;
    if (conflict.code !== 'has_dependents') {
      return res.status(conflict.status).json({ message: conflict.message });
    }
    const dependents = await countStatusDependents(req.params.id);
    const parts: string[] = [];
    if (dependents.entries > 0) {
      parts.push(
        `${dependents.entries} pipeline ${dependents.entries === 1 ? 'entry' : 'entries'}`
      );
    }
    if (dependents.history > 0) {
      parts.push(
        `${dependents.history} status history ${dependents.history === 1 ? 'row' : 'rows'}`
      );
    }
    return res.status(409).json({
      message:
        parts.length > 0
          ? `This status is still used by ${listPhrase(parts)}.`
          : 'This status is still referenced.',
      dependents,
    });
  }
  res.status(204).send();
});
