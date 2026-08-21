import { z } from 'zod';

export const createActivitySchema = z
  .object({
    person_id: z.string().uuid().optional().nullable().default(null),
    company_id: z.string().uuid().optional().nullable().default(null),
    opportunity_id: z.string().uuid().optional().nullable().default(null),
    entry_id: z.string().uuid().optional().nullable().default(null),
    channel: z.enum(['li_message', 'li_inmail', 'li_connect', 'email', 'call', 'meeting', 'note']),
    direction: z.enum(['outbound', 'inbound', 'internal']).default('outbound'),
    occurred_at: z.string().datetime().optional(),
    subject: z.string().optional().nullable().default(null),
    body: z.string().optional().nullable().default(null),
  })
  // Mirrors the activities_has_subject check constraint, so the caller gets a
  // 400 they can read rather than a 500 out of Postgres.
  .refine((value) => Boolean(value.person_id) || Boolean(value.company_id), {
    message: 'An activity must be attached to a person or a company',
  });

export const activityQuerySchema = z.object({
  person_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
