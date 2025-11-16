import { z } from 'zod';

export const flagsSchema = z.array(z.string().min(1)).optional();
export const skillsSchema = z.array(z.string().min(1)).optional();

export const createCandidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  target_agency_id: z.string().min(1),
  current_status_id: z.string().min(1),
  recruiter_id: z.string().min(1),
  job_requisition_id: z.string().uuid().optional(),
  flags: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const updateCandidateSchema = createCandidateSchema.partial();

export const moveCandidateSchema = z.object({
  to_status_id: z.string().min(1),
});

export const candidateQuerySchema = z.object({
  flag: z.string().optional(),
  agency_id: z.string().optional(),
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

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
