import type { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface AuthUser {
  id: string;
  tenantId: string;
  role: Role;
  email?: string;
}

interface TokenPayload extends JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  email?: string;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : '';

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: missing token' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'JWT_SECRET is not configured' });
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    const user: AuthUser = {
      id: decoded.sub,
      tenantId: decoded.tenantId,
      role: decoded.role,
      email: decoded.email,
    };
    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
};

export const requireRole =
  (allowed: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser | undefined;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowed.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }

    next();
  };