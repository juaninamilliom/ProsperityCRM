import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { activityQuerySchema, createActivitySchema } from './activity.schema.js';
import * as service from './activity.service.js';

export const activityRouter = Router();

activityRouter.get('/', async (req, res) => {
  const parsed = activityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.json(await service.listActivities(parsed.data));
});

activityRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = createActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  res.status(201).json(
    await service.createActivity(req.dbUser.organization_id, req.dbUser.user_id, parsed.data),
  );
});
