import crypto from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '../../db/drizzle.js';
import { authChallenges, passkeys, users } from '../../db/schema.js';
import type { User } from '../../types.js';
import { getUserById } from '../user/user.service.js';
import { toPublicUser } from '../user/public-user.js';
import { createLocalToken } from './token.js';

export function getWebAuthnConfig(originHeader?: string) {
  let origin = originHeader || 'http://localhost:5173';
  // Strip trailing slashes
  origin = origin.replace(/\/+$/, '');
  let hostname = 'localhost';
  try {
    const url = new URL(origin);
    hostname = url.hostname;
  } catch {}

  const rpID = process.env.RP_ID || hostname;
  const rpName = 'Prosperity CRM';

  return { origin, rpID, rpName };
}

export async function generatePasskeyRegistrationOptions(user: User, originHeader?: string) {
  const { rpID, rpName } = getWebAuthnConfig(originHeader);

  const existingPasskeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.user_id, user.user_id));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: isoUint8Array.fromUTF8String(user.user_id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existingPasskeys.map((p) => ({
      id: p.credential_id,
      transports: (p.transports ?? []) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  const [challengeRecord] = await db
    .insert(authChallenges)
    .values({
      user_id: user.user_id,
      challenge: options.challenge,
      expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    })
    .returning();

  return { options, challengeId: challengeRecord.challenge_id };
}

export async function verifyPasskeyRegistration(
  user: User,
  response: RegistrationResponseJSON,
  challengeId: string,
  deviceName?: string,
  originHeader?: string
) {
  const { origin, rpID } = getWebAuthnConfig(originHeader);

  const [challengeRecord] = await db
    .select()
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.challenge_id, challengeId),
        gt(authChallenges.expires_at, new Date())
      )
    );

  if (!challengeRecord) {
    throw new Error('Registration challenge expired or invalid. Please try again.');
  }

  // Cleanup challenge so it cannot be re-used
  await db.delete(authChallenges).where(eq(authChallenges.challenge_id, challengeId));

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey verification failed.');
  }

  const { credential } = verification.registrationInfo;

  const [newPasskey] = await db
    .insert(passkeys)
    .values({
      user_id: user.user_id,
      credential_id: credential.id,
      public_key: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      device_name: deviceName || 'Biometric Passkey (Touch ID / Face ID)',
      transports: (response.response.transports ?? []) as string[],
    })
    .returning();

  return newPasskey;
}

export async function generatePasskeyAuthOptions(email?: string, originHeader?: string) {
  const { rpID } = getWebAuthnConfig(originHeader);

  let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;
  let targetUserId: string | null = null;

  if (email) {
    const [user] = await db.select().from(users).where(eq(users.email, email.trim()));
    if (user) {
      targetUserId = user.user_id;
      const userPasskeys = await db
        .select()
        .from(passkeys)
        .where(eq(passkeys.user_id, user.user_id));

      if (userPasskeys.length > 0) {
        allowCredentials = userPasskeys.map((p) => ({
          id: p.credential_id,
          transports: (p.transports ?? []) as AuthenticatorTransportFuture[],
        }));
      }
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  const [challengeRecord] = await db
    .insert(authChallenges)
    .values({
      user_id: targetUserId,
      challenge: options.challenge,
      expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    })
    .returning();

  return { options, challengeId: challengeRecord.challenge_id };
}

export async function verifyPasskeyAuth(
  response: AuthenticationResponseJSON,
  challengeId: string,
  originHeader?: string
) {
  const { origin, rpID } = getWebAuthnConfig(originHeader);

  const [challengeRecord] = await db
    .select()
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.challenge_id, challengeId),
        gt(authChallenges.expires_at, new Date())
      )
    );

  if (!challengeRecord) {
    throw new Error('Authentication challenge expired or invalid. Please try again.');
  }

  // Cleanup challenge
  await db.delete(authChallenges).where(eq(authChallenges.challenge_id, challengeId));

  const [passkey] = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.credential_id, response.id));

  if (!passkey) {
    throw new Error('Passkey not recognized. Please sign in with another method.');
  }

  const user = await getUserById(passkey.user_id);
  if (!user || !user.is_active) {
    throw new Error('User account is inactive or not found.');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credential_id,
      publicKey: isoBase64URL.toBuffer(passkey.public_key),
      counter: passkey.counter,
      transports: (passkey.transports ?? []) as AuthenticatorTransportFuture[],
    },
  });

  if (!verification.verified) {
    throw new Error('Passkey signature could not be verified.');
  }

  // Update counter and last_used_at
  await db
    .update(passkeys)
    .set({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date(),
    })
    .where(eq(passkeys.passkey_id, passkey.passkey_id));

  const token = await createLocalToken(user);
  return { token, user: toPublicUser(user) };
}

export async function listUserPasskeys(userId: string) {
  return db
    .select({
      passkey_id: passkeys.passkey_id,
      device_name: passkeys.device_name,
      created_at: passkeys.created_at,
      last_used_at: passkeys.last_used_at,
    })
    .from(passkeys)
    .where(eq(passkeys.user_id, userId))
    .orderBy(desc(passkeys.created_at));
}

export async function deleteUserPasskey(userId: string, passkeyId: string) {
  await db
    .delete(passkeys)
    .where(and(eq(passkeys.user_id, userId), eq(passkeys.passkey_id, passkeyId)));
}
