import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { jobInputSchema, jobSplitsPayloadSchema } from './job.schema.js';
import { classify } from '../../common/pg-errors.js';
import { countJobDependents, createJob, deleteJob, getJobEntries, getJobWithStats, listJobSplits, listJobs, replaceJobSplits, updateJob } from './job.service.js';

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
  const entries = await getJobEntries(req.params.id);
  res.json({ job, splits, entries });
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
  /** pipeline_entries.job_id is NO ACTION (0010:95), so deleting a requisition
   *  that has candidates raised 23503 and reached the client as a bare 500 —
   *  from a live admin button. The constraint announces the problem, so this
   *  catches rather than counting up front: no query on the success path, and
   *  no window between a count and the delete. The count runs only to name
   *  what is in the way. */
  try {
    await deleteJob(req.params.id);
  } catch (error) {
    const conflict = classify(error, 'delete');
    if (!conflict) throw error;
    /** classify also maps 22P02 to a 400, and no path parameter is validated
     *  anywhere, so DELETE /jobs/not-a-uuid arrives here. Falling through to
     *  the count would re-throw the same error from inside this catch. */
    if (conflict.code !== 'has_dependents') {
      return res.status(conflict.status).json({ message: conflict.message });
    }
    const dependents = await countJobDependents(req.params.id);
    return res.status(409).json({
      message: `This requisition has ${dependents.entries} ${
        dependents.entries === 1 ? 'candidate' : 'candidates'
      } in the pipeline. Move or remove them first.`,
      dependents,
    });
  }
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
