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

export const magicLinkRequestSchema = z.object({
  email: z.string().email(),
  invite_code: z.string().optional(),
  name: z.string().optional(),
});

export const magicLinkVerifySchema = z.object({
  token: z.string().min(1),
  name: z.string().optional(),
});

export const passkeyLoginOptionsSchema = z.object({
  email: z.string().email().optional(),
});

export const passkeyLoginVerifySchema = z.object({
  response: z.record(z.any()),
  challengeId: z.string().uuid(),
});

export const passkeyRegisterVerifySchema = z.object({
  response: z.record(z.any()),
  challengeId: z.string().uuid(),
  deviceName: z.string().optional(),
});

