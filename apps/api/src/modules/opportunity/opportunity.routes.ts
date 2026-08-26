import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { OpportunityStage } from '../../types.js';
import {
  addContactSchema,
  createOpportunitySchema,
  moveStageSchema,
  opportunityQuerySchema,
  updateOpportunitySchema,
} from './opportunity.schema.js';
import * as service from './opportunity.service.js';
import { stageTransition } from './stage.js';

export const opportunityRouter = Router();

opportunityRouter.get('/', async (req, res) => {
  const parsed = opportunityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.json(await service.listOpportunities(parsed.data));
});

opportunityRouter.get('/:opportunityId', async (req, res) => {
  const deal = await service.getOpportunity(req.params.opportunityId);
  if (!deal) {
    return res.status(404).json({ message: 'Deal not found' });
  }
  res.json(deal);
});

opportunityRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = createOpportunitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.status(201).json(await service.createOpportunity(req.dbUser.organization_id, parsed.data));
});

opportunityRouter.patch('/:opportunityId', async (req, res) => {
  const parsed = updateOpportunitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const updated = await service.updateOpportunity(req.params.opportunityId, parsed.data);
  if (!updated) {
    return res.status(404).json({ message: 'Deal not found' });
  }
  res.json(updated);
});

/** The join moment: winning a deal is what turns a prospect into a client and
 *  makes requisitions possible underneath it. Promotion, the stage change and
 *  the "deal won" activity all commit together or not at all. */
opportunityRouter.patch('/:opportunityId/stage', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = moveStageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const deal = await service.getOpportunityRaw(req.params.opportunityId);
  if (!deal) {
    return res.status(404).json({ message: 'Deal not found' });
  }

  const now = new Date().toISOString();
  const move = stageTransition(deal.stage, parsed.data.stage as OpportunityStage, now);

  if (move.requiresLostReason && !parsed.data.lost_reason?.trim()) {
    return res.status(400).json({ message: 'A lost deal needs a reason' });
  }

  const userId = req.dbUser.user_id;
  const updated = await service.transitionOpportunityStage({
    deal,
    nextStage: parsed.data.stage as
      | 'prospect'
      | 'contacted'
      | 'meeting'
      | 'proposal'
      | 'negotiation'
      | 'signed'
      | 'lost',
    lostReason: parsed.data.lost_reason,
    userId,
    move,
  });

  res.json(updated);
});


opportunityRouter.post('/:opportunityId/contacts', async (req, res) => {
  const parsed = addContactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.status(201).json(
    await service.addContact(req.params.opportunityId, parsed.data.person_id, parsed.data.role),
  );
});

opportunityRouter.delete('/:opportunityId/contacts/:personId', async (req, res) => {
  await service.removeContact(req.params.opportunityId, req.params.personId);
  res.status(204).end();
});

opportunityRouter.delete('/:opportunityId', async (req, res) => {
  await service.deleteOpportunity(req.params.opportunityId);
  res.status(204).end();
});
