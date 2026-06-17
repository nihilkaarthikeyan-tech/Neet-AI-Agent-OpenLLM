import { type Response, type NextFunction } from 'express';
import { type AuthRequest } from './auth.js';

/** Only ADMIN role gets through. Must be used AFTER authenticate(). */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  next();
}
