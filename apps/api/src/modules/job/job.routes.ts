import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { jobInputSchema } from './job.schema.js';
import { createJob, deleteJob, listJobs, updateJob } from './job.service.js';

export const jobRouter = Router();

jobRouter.get('/', async (_req, res) => {
  const jobs = await listJobs();
  res.json(jobs);
});

jobRouter.post('/', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = jobInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const job = await createJob(parsed.data);
  res.status(201).json(job);
});

jobRouter.put('/:id', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = jobInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const job = await updateJob(req.params.id, parsed.data);
  res.json(job);
});

jobRouter.delete('/:id', requireRole('OrgAdmin'), async (req, res) => {
  await deleteJob(req.params.id);
  res.status(204).send();
});
