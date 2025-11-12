import { z } from 'zod';

export const createInviteSchema = z.object({
  role: z.enum(['OrgAdmin', 'OrgEmployee']).default('OrgEmployee'),
  maxUses: z.number().int().min(1).max(10).default(1),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
