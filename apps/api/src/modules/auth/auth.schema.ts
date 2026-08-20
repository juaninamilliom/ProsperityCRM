import { z } from 'zod';

/** Joining is by invite code only. The code carries the organisation and the
 *  role, so neither is accepted from the request body - a signup form must not
 *  be able to choose its own role. */
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  invite_code: z.string().min(1, 'An invite code is required'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
