import { Router } from 'express';
import { getEntryHistory, getPlacementMetrics } from './history.service.js';

export const historyRouter = Router();

historyRouter.get('/entry/:id', async (req, res) => {
  const rows = await getEntryHistory(req.params.id);
  res.json(rows);
});

historyRouter.get('/placements', async (_req, res) => {
  const rows = await getPlacementMetrics();
  res.json(rows);
});
