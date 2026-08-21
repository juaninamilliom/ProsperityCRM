import { z } from 'zod';
import { normalizeLinkedInUrl } from '../person/linkedin.js';

const RELATIONSHIPS = ['prospect', 'client', 'former', 'do_not_contact'] as const;

export const createCompanySchema = z.object({
  name: z.string().min(1),
  /** Normalised on the way in, so the partial unique index sees one spelling. */
  linkedin_url: z.string().optional().nullable().transform((value) => normalizeLinkedInUrl(value)),
  domain: z.string().optional().nullable().default(null),
  industry: z.string().optional().nullable().default(null),
  headcount: z.string().optional().nullable().default(null),
  location: z.string().optional().nullable().default(null),
  relationship: z.enum(RELATIONSHIPS).default('prospect'),
  contact_email: z.string().email().optional().nullable().default(null),
  notes: z.string().optional().nullable().default(null),
});

export const updateCompanySchema = createCompanySchema.partial();

export const companyQuerySchema = z.object({
  relationship: z.enum(RELATIONSHIPS).optional(),
  search: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
