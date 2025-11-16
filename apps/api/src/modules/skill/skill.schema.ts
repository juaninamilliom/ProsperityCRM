import { z } from 'zod';

export const createSkillSchema = z.object({
  name: z.string().min(1).max(120),
});
