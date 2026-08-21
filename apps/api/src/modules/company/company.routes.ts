import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { companyQuerySchema, createCompanySchema, updateCompanySchema } from './company.schema.js';
import * as service from './company.service.js';

export const companyRouter = Router();

/** Postgres unique_violation. Surfaced as 409 plus the existing row so the
 *  caller can offer "you already have this - open it?" rather than an error.
 *  This is exactly the affordance the capture inbox will need. */
const UNIQUE_VIOLATION = '23505';

companyRouter.get('/', async (req, res) => {
  const parsed = companyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.json(await service.listCompanies(parsed.data));
});

companyRouter.get('/:companyId', async (req, res) => {
  const company = await service.getCompany(req.params.companyId);
  if (!company) {
    return res.status(404).json({ message: 'Company not found' });
  }
  res.json(company);
});

companyRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    res.status(201).json(await service.createCompany(req.dbUser.organization_id, parsed.data));
  } catch (error) {
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
    const existing = await service.findDuplicateCompany(
      req.dbUser.organization_id,
      parsed.data.name,
      parsed.data.linkedin_url,
      parsed.data.domain,
    );
    res.status(409).json({ message: 'You already have this company', existing });
  }
});

companyRouter.patch('/:companyId', async (req, res) => {
  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const updated = await service.updateCompany(req.params.companyId, parsed.data);
  if (!updated) {
    return res.status(404).json({ message: 'Company not found' });
  }
  res.json(updated);
});

companyRouter.delete('/:companyId', async (req, res) => {
  // pipeline_entries.company_id has no cascade on purpose: deleting a company
  // must never silently delete pipeline history. Explain instead.
  const entries = await service.countEntriesForCompany(req.params.companyId);
  if (entries > 0) {
    return res.status(409).json({
      message: 'This company has pipeline entries. Move or remove them first.',
      entry_count: entries,
    });
  }
  await service.deleteCompany(req.params.companyId);
  res.status(204).end();
});
