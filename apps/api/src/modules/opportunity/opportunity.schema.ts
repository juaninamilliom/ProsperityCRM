import { z } from 'zod';
import { STAGES } from './stage.js';

const stageEnum = z.enum(STAGES as unknown as [string, ...string[]]);

export const createOpportunitySchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(1),
  stage: stageEnum.default('prospect'),
  fee_percent: z.number().min(0).max(100).optional().nullable().default(null),
  est_annual_value: z.number().min(0).optional().nullable().default(null),
  expected_close: z.string().optional().nullable().default(null),
  owner_id: z.string().uuid().optional().nullable().default(null),
});

export const updateOpportunitySchema = createOpportunitySchema.partial();

export const moveStageSchema = z.object({
  stage: stageEnum,
  lost_reason: z.string().optional().nullable(),
});

export const addContactSchema = z.object({
  person_id: z.string().uuid(),
  role: z.enum(['champion', 'decision_maker', 'influencer', 'blocker', 'intro']).optional(),
});

export const opportunityQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  stage: stageEnum.optional(),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
