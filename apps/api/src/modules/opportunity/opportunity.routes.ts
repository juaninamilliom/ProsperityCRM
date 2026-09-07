import { Router } from 'express';
import { classify } from '../../common/pg-errors.js';
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
  /** job_requisitions.opportunity_id is NO ACTION (0010:147), so deleting a
   *  deal that produced a requisition was a bare 500. opportunity_contacts
   *  (0010:83) and activities (0010:126) cascade and are left alone: neither
   *  means anything apart from the deal. */
  try {
    await service.deleteOpportunity(req.params.opportunityId);
  } catch (error) {
    const conflict = classify(error, 'delete');
    if (!conflict) throw error;
    if (conflict.code !== 'has_dependents') {
      return res.status(conflict.status).json({ message: conflict.message });
    }
    const dependents = await service.countOpportunityDependents(req.params.opportunityId);
    return res.status(409).json({
      message: `This deal produced ${dependents.requisitions} ${
        dependents.requisitions === 1 ? 'requisition' : 'requisitions'
      }. Detach or delete them first.`,
      dependents,
    });
  }
  res.status(204).end();
});
