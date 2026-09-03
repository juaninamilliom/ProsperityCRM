import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { timingSafeEqualString } from './secret-compare.js';

export function requireRootAdmin(req: Request, res: Response, next: NextFunction) {
  const adminHeader =
    (req.headers['x-admin-token'] as string | undefined) ??
    (req.headers['x-root-admin-token'] as string | undefined);

  let token = adminHeader?.trim();

  // Also support Authorization: Bearer <ROOT_ADMIN_TOKEN>
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.replace('Bearer ', '').trim();
  }

  const expectedToken = config.rootAdminToken?.trim();

  if (!expectedToken) {
    return res.status(500).json({ message: 'Root admin token not configured' });
  }

  if (!timingSafeEqualString(token ?? '', expectedToken)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
}
