import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { createCandidate, deleteCandidate, listCandidates, moveCandidate, updateCandidate } from './candidate.service';
import {
  candidateQuerySchema,
  createCandidateSchema,
  moveCandidateSchema,
  updateCandidateSchema,
} from './candidate.schema';

export const candidateRouter = Router();

candidateRouter.get('/', async (req, res) => {
  const parsed = candidateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const rows = await listCandidates({
    flag: parsed.data.flag,
    agency_id: parsed.data.agency_id,
  });
  res.json(rows);
});

candidateRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const parsed = createCandidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const candidate = await createCandidate(parsed.data);
  res.status(201).json(candidate);
});

candidateRouter.put('/:id', async (req, res) => {
  const parsed = updateCandidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const updated = await updateCandidate(req.params.id, parsed.data);
  res.json(updated);
});

candidateRouter.delete('/:id', async (req, res) => {
  await deleteCandidate(req.params.id);
  res.status(204).send();
});

candidateRouter.post('/:id/move_status', async (req: AuthenticatedRequest, res) => {
  const parsed = moveCandidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const moved = await moveCandidate({
    candidateId: req.params.id,
    toStatusId: parsed.data.to_status_id,
    changedBy: req.user?.sub ?? 'system',
  });

  res.json(moved);
});
