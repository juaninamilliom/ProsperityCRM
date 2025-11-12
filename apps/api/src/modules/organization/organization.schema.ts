import { z } from 'zod';

export const organizationInputSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/i, 'Slug must be alphanumeric and may include dashes'),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
