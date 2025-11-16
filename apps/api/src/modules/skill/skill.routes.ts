import { Router } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { createSkillSchema } from './skill.schema.js';
import { createOrganizationSkill, listOrganizationSkills } from './skill.service.js';

export const skillRouter = Router();

skillRouter.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const skills = await listOrganizationSkills(req.dbUser.organization_id);
  res.json(skills);
});

skillRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.dbUser) {
    return res.status(403).json({ message: 'User context not available' });
  }
  const parsed = createSkillSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }
  const skill = await createOrganizationSkill(req.dbUser.organization_id, parsed.data.name);
  res.status(201).json(skill);
});
