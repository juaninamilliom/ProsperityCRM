import { z } from 'zod';

export const jobInputSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['open', 'on_hold', 'closed']).default('open'),
  description: z.string().optional(),
  close_date: z.string().optional(),
  deal_amount: z.string().optional(),
  weighted_deal_amount: z.string().optional(),
  owner_name: z.string().optional(),
  stage: z.string().optional(),
});

export const jobSplitSchema = z.object({
  teammate_name: z.string().min(1),
  teammate_status: z.string().optional(),
  role: z.string().optional(),
  split_percent: z.string().optional(),
  total_deal: z.string().optional(),
  weighted_deal: z.string().optional(),
});

export const jobSplitsPayloadSchema = z.object({
  splits: z.array(jobSplitSchema)
});

export type JobInput = z.infer<typeof jobInputSchema>;
