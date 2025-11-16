import { z } from 'zod';

export const jobInputSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['open', 'on_hold', 'closed']).default('open'),
  description: z.string().optional(),
});

export type JobInput = z.infer<typeof jobInputSchema>;
