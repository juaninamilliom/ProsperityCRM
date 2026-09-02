import { z } from 'zod';

export const updateRoleSchema = z.object({
  role: z.enum(['OrgAdmin', 'OrgEmployee']),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['OrgAdmin', 'OrgEmployee']).default('OrgEmployee'),
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['OrgAdmin', 'OrgEmployee']).default('OrgEmployee'),
  organization_id: z.string().uuid().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

