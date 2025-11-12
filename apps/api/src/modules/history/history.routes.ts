import { Router } from 'express';
import { getCandidateHistory, getPlacementMetrics } from './history.service';

export const historyRouter = Router();

historyRouter.get('/candidate/:id', async (req, res) => {
  const rows = await getCandidateHistory(req.params.id);
  res.json(rows);
});

historyRouter.get('/placements', async (_req, res) => {
  const rows = await getPlacementMetrics();
  res.json(rows);
});
