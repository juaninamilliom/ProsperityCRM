import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { createPersonSchema, personQuerySchema, updatePersonSchema } from './person.schema.js';
import * as service from './person.service.js';
import { pgErrorOf, SQLSTATE } from '../../common/pg-errors.js';

export const personRouter = Router();

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
    /** This route worked, but the old comment here had it backwards: it
     *  called the six-way sniff indefensible and pointed at company.routes.ts
     *  checking `code` alone as the better pattern. In fact `.cause.code` was
     *  the only clause that ever fired, and `code` alone is the broken one -
     *  which is why the company route's 409 never ran. The two message
     *  sniffs were also reading driver text that now contains bound
     *  parameters. */
    if (pgErrorOf(error)?.code !== SQLSTATE.UNIQUE_VIOLATION) throw error;
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
