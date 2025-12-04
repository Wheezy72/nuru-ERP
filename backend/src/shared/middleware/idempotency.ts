import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma/client';
import type { AuthUser } from './requireRole';

/**
 * Idempotency middleware for write operations.
 *
 * - Looks for `Idempotency-Key` header on POST/PUT/PATCH.
 * - If a completed entry exists, returns the cached response.
 * - Otherwise lets the request proceed and stores the JSON response
 *   when `res.json` or `res.send` is called.
 *
 * This is best-effort: if the idempotency store fails, the request
 * still goes through as a normal non-idempotent call.
 */
export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(method)) {
    return next();
  }

  const headerKey =
    (req.headers['idempotency-key'] as string | undefined) ??
    (req.headers['idempotency_key'] as string | undefined);

  if (!headerKey) {
    return next();
  }

  const user = (req as any).user as AuthUser | undefined;
  const tenantId = user?.tenantId ?? null;

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        key_tenantId: {
          key: headerKey,
          tenantId,
        },
      },
    });

    if (existing && existing.response && existing.statusCode) {
      res.status(existing.statusCode).json(existing.response);
      return;
    }
  } catch {
    // If lookup fails, fall through and treat as non-idempotent.
  }

  // Create a stub row so we can update it later; ignore errors (e.g. unique conflict).
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: headerKey,
        tenantId,
        method,
        path: req.originalUrl.slice(0, 1900),
      },
    });
  } catch {
    // Ignore; another request may have created it first.
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  const saveResponse = async (body: any, isJson: boolean) => {
    const statusCode = res.statusCode || 200;

    try {
      await prisma.idempotencyKey.update({
        where: {
          key_tenantId: {
            key: headerKey,
            tenantId,
          },
        },
        data: {
          response: isJson ? body : undefined,
          statusCode,
        },
      });
    } catch {
      // If persistence fails, we still return the response to the client.
    }
  };

  // Wrap res.json
  (res as any).json = (body: any) => {
    void saveResponse(body, true);
    return originalJson(body);
  };

  // Wrap res.send for non-JSON responses
  (res as any).send = (body: any) => {
    void saveResponse(body, false);
    return originalSend(body);
  };

  next();
};