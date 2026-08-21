import { z } from 'zod';

export const flagsSchema = z.array(z.string().min(1)).optional();

/** A pipeline entry is a pitch, not a person: name, email and skills live on
 *  people and are never accepted here. job_id is optional because an entry can
 *  aim at a company with no specific requisition yet. */
export const createEntrySchema = z.object({
  person_id: z.string().min(1),
  company_id: z.string().min(1),
  job_id: z.string().uuid().optional().nullable(),
  current_status_id: z.string().min(1),
  recruiter_id: z.string().min(1),
  flags: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
});

export const updateEntrySchema = createEntrySchema.partial();

export const moveEntrySchema = z.object({
  to_status_id: z.string().min(1),
});

export const entryQuerySchema = z.object({
  flag: z.string().optional(),
  company_id: z.string().optional(),
  person_id: z.string().optional(),
  job_id: z.string().uuid().optional(),
  status_id: z.string().uuid().optional(),
  search: z.string().optional(),
  skills: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) return [];
      const values = Array.isArray(value) ? value : value.split(',');
      return values
        .map((item) => item.trim())
        .filter((item): item is string => Boolean(item.length));
    }),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
