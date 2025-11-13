import { SignJWT, jwtVerify } from 'jose';
import { config } from '../../config.js';
import type { User } from '../../types.js';

const localSecret = new TextEncoder().encode(config.localAuthSecret);

export async function createLocalToken(user: User) {
  return new SignJWT({ userId: user.user_id, provider: 'local' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(localSecret);
}

export async function verifyLocalToken(token: string) {
  const { payload } = await jwtVerify(token, localSecret);
  if (payload.provider !== 'local' || typeof payload.userId !== 'string') {
    throw new Error('Invalid local token');
  }
  return payload.userId as string;
}
