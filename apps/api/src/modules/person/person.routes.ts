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
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
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
