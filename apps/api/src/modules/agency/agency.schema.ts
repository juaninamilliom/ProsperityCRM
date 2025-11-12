import { z } from 'zod';

export const agencyInputSchema = z.object({
  name: z.string().min(1),
  contact_email: z.string().email().optional(),
});

export type AgencyInput = z.infer<typeof agencyInputSchema>;
