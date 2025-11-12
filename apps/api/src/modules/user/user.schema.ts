import { z } from 'zod';

export const upsertUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  sso_id: z.string().min(1),
  organization_id: z.string().min(1),
  role: z.enum(['OrgAdmin', 'OrgEmployee']).default('OrgEmployee'),
});

export const ssoSignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  sso_id: z.string().min(1),
  passcode: z.string().min(4).optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['OrgAdmin', 'OrgEmployee']),
});

export type UpsertUserInput = z.infer<typeof upsertUserSchema>;
