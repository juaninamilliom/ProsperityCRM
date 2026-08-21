import { z } from 'zod';
import { normalizeLinkedInUrl } from './linkedin.js';

export const createPersonSchema = z.object({
  full_name: z.string().min(1),
  /** Nullable by design: LinkedIn does not expose email, and a placeholder
   *  address would poison the partial unique index. */
  email: z.string().email().optional().nullable().default(null),
  phone: z.string().optional().nullable().default(null),
  linkedin_url: z.string().optional().nullable().transform((value) => normalizeLinkedInUrl(value)),
  headline: z.string().optional().nullable().default(null),
  location: z.string().optional().nullable().default(null),
  current_company_id: z.string().uuid().optional().nullable().default(null),
  current_title: z.string().optional().nullable().default(null),
  skills: z.array(z.string()).default([]),
  notes: z.string().optional().nullable().default(null),
  source: z.enum(['manual', 'linkedin_capture', 'import']).default('manual'),
});

export const updatePersonSchema = createPersonSchema.partial();

export const personQuerySchema = z.object({
  search: z.string().optional(),
  company_id: z.string().uuid().optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
