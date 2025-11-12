import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config';
import type { User } from '../types';
import { getUserById, getUserBySsoId } from '../modules/user/user.service';
import { verifyLocalToken } from '../modules/auth/token';

const jwks = config.oauthJwksUrl ? createRemoteJWKSet(new URL(config.oauthJwksUrl)) : null;

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email?: string;
    name?: string;
  };
  dbUser?: User;
}

async function tryLocalAuth(token: string) {
  try {
    const userId = await verifyLocalToken(token);
    const user = await getUserById(userId);
    if (!user || !user.is_active) {
      return null;
    }
    return user;
  } catch (error) {
    return null;
  }
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }

  const token = header.replace('Bearer ', '').trim();

  const localUser = await tryLocalAuth(token);
  if (localUser) {
    req.dbUser = localUser;
    req.user = { sub: localUser.user_id, email: localUser.email, name: localUser.name };
    return next();
  }

  if (!jwks) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      audience: process.env.OAUTH_AUDIENCE,
      issuer: process.env.OAUTH_ISSUER,
    });

    req.user = {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
    };

    if (req.user?.sub) {
      const dbUser = await getUserBySsoId(req.user.sub);
      if (dbUser && dbUser.is_active) {
        req.dbUser = dbUser;
        return next();
      }
    }

    return res.status(403).json({ message: 'User not registered' });
  } catch (error) {
    console.error('[auth] token verification failed', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireRole(role: 'OrgAdmin' | 'OrgEmployee') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser || req.dbUser.role !== role) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}
