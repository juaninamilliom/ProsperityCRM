import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export function requireRootAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-admin-token'];

  console.log('Root admin token from config:', config.rootAdminToken);
  console.log('Root admin token from request header:', token);
  if (!config.rootAdminToken) {
    return res.status(500).json({ message: 'Root admin token not configured' });
  }
  if (token !== config.rootAdminToken) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}
