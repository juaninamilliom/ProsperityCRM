import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { createCandidate, deleteCandidate, getCandidateById, listCandidates, moveCandidate, updateCandidate } from './candidate.service.js';
import {
  candidateQuerySchema,
  createCandidateSchema,
  moveCandidateSchema,
  updateCandidateSchema,
} from './candidate.schema.js';

export const candidateRouter = Router();

candidateRouter.get('/', async (req, res) => {
  const parsed = candidateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const rows = await listCandidates({
    flag: parsed.data.flag,
    agency_id: parsed.data.agency_id,
    job_id: parsed.data.job_id,
    status_id: parsed.data.status_id,
    search: parsed.data.search,
    skills: parsed.data.skills,
  });
  res.json(rows);
});

candidateRouter.get('/:id', async (req, res) => {
  const candidate = await getCandidateById(req.params.id);
  if (!candidate) {
    return res.status(404).json({ message: 'Candidate not found' });
  }
  res.json(candidate);
});

candidateRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = createCandidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const candidate = await createCandidate(parsed.data, req.dbUser.organization_id);
  res.status(201).json(candidate);
});

candidateRouter.put('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = updateCandidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const updated = await updateCandidate(req.params.id, parsed.data, req.dbUser.organization_id);
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
