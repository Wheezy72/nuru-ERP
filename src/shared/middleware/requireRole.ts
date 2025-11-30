import type { Request, Response, NextFunction } from 'express';

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

export const requireRole =
  (allowed: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const roleHeader = req.headers['x-user-role'];
    const role =
      (Array.isArray(roleHeader) ? roleHeader[0] : roleHeader)?.toString() || '';

    if (!allowed.includes(role as Role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }

    next();
  };