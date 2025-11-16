import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { jobInputSchema, jobSplitsPayloadSchema } from './job.schema.js';
import { createJob, deleteJob, getJobCandidates, getJobWithStats, listJobSplits, listJobs, replaceJobSplits, updateJob } from './job.service.js';

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

jobRouter.get('/:id', async (req, res) => {
  const job = await getJobWithStats(req.params.id);
  if (!job) {
    return res.status(404).json({ message: 'Job not found' });
  }
  const splits = await listJobSplits(req.params.id);
  const candidates = await getJobCandidates(req.params.id);
  res.json({ job, splits, candidates });
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

jobRouter.put('/:id/splits', requireRole('OrgAdmin'), async (req, res) => {
  const parsed = jobSplitsPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const splits = await replaceJobSplits(req.params.id, parsed.data.splits);
  res.json(splits);
});

jobRouter.get('/:id/splits', async (req, res) => {
  const splits = await listJobSplits(req.params.id);
  res.json(splits);
});
