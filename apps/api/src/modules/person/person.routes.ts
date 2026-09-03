import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { createPersonSchema, personQuerySchema, updatePersonSchema } from './person.schema.js';
import * as service from './person.service.js';

export const personRouter = Router();

const UNIQUE_VIOLATION = '23505';

personRouter.get('/', async (req, res) => {
  const parsed = personQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.json(await service.listPeople(parsed.data));
});

personRouter.get('/lookup-linkedin', async (req: AuthenticatedRequest, res) => {
  const url = req.query.url as string | undefined;
  if (!url || !req.dbUser) {
    return res.status(400).json({ message: 'LinkedIn URL and auth required' });
  }
  const duplicate = await service.findDuplicatePerson(req.dbUser.organization_id, url, undefined);
  res.json({ match: Boolean(duplicate), person: duplicate });
});

personRouter.get('/:personId', async (req, res) => {
  const person = await service.getPerson(req.params.personId);
  if (!person) {
    return res.status(404).json({ message: 'Person not found' });
  }
  res.json(person);
});

personRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = createPersonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  try {
    res.status(201).json(await service.createPerson(req.dbUser.organization_id, parsed.data));
  } catch (error) {
    // Behaviour-preserving narrowing of what used to be `any`. The six-way
    // sniff itself is not defensible - company.routes.ts checks `code` alone -
    // but replacing it belongs with the shared isUniqueViolation helper, not
    // in a commit whose job is to make lint pass.
    const pgError = error as {
      code?: string;
      cause?: { code?: string };
      message?: string;
      detail?: string;
    };
    const isUniqueViolation =
      pgError?.code === UNIQUE_VIOLATION ||
      pgError?.cause?.code === UNIQUE_VIOLATION ||
      pgError?.code === '23505' ||
      pgError?.message?.includes('unique constraint') ||
      pgError?.message?.includes('duplicate key') ||
      pgError?.detail?.includes('already exists');

    if (!isUniqueViolation) throw error;
    const existing = await service.findDuplicatePerson(
      req.dbUser.organization_id,
      parsed.data.linkedin_url,
      parsed.data.email,
    );
    res.status(409).json({ message: 'You already have this person', existing });
  }
});

personRouter.patch('/:personId', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = updatePersonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const updated = await service.updatePerson(
    req.params.personId,
    req.dbUser.organization_id,
    parsed.data,
  );
  if (!updated) {
    return res.status(404).json({ message: 'Person not found' });
  }
  res.json(updated);
});
