import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config';
import type { User } from '../types';
import { getUserBySsoId } from '../modules/user/user.service';

const jwks = config.oauthJwksUrl ? createRemoteJWKSet(new URL(config.oauthJwksUrl)) : null;

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email?: string;
    name?: string;
  };
  dbUser?: User;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!jwks) {
    console.warn('[auth] OAUTH_JWKS_URL not configured; rejecting requests');
    return res.status(500).json({ message: 'Auth misconfigured' });
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }

  const token = header.replace('Bearer ', '').trim();

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
      if (dbUser) {
        req.dbUser = dbUser;
      }
    }

    next();
  } catch (error) {
    console.error('[auth] token verification failed', error);
    res.status(401).json({ message: 'Invalid token' });
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
