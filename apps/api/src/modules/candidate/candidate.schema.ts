import { z } from 'zod';

export const flagsSchema = z.array(z.string().min(1)).optional();

export const createCandidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  target_agency_id: z.string().min(1),
  current_status_id: z.string().min(1),
  recruiter_id: z.string().min(1),
  flags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const updateCandidateSchema = createCandidateSchema.partial();

export const moveCandidateSchema = z.object({
  to_status_id: z.string().min(1),
});

export const candidateQuerySchema = z.object({
  flag: z.string().optional(),
  agency_id: z.string().optional(),
});

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
