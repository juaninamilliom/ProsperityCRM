import { z } from 'zod';

export const statusInputSchema = z.object({
  name: z.string().min(1),
  order_index: z.number().int().nonnegative(),
  is_terminal: z.boolean().default(false),
});

export type StatusInput = z.infer<typeof statusInputSchema>;
