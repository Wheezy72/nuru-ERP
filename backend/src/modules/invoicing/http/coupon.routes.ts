import { Router } from 'express';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['ADMIN']));

function getTenantId(req: any): string {
  const authUser = (req as any).user as { tenantId?: string } | undefined;
  if (authUser?.tenantId) {
    return authUser.tenantId;
  }

  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    throw new Error('Missing tenant context');
  }
  return tenantId;
}

// List coupons with basic pagination and optional search.
router.get('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const prisma = createTenantPrismaClient(tenantId);

    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);
    const search = (req.query.search as string) || undefined;
    const activeParam = (req.query.active as string) || undefined;

    const where: any = {
      tenantId,
      ...(typeof search === 'string' && search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    if (activeParam === 'true') {
      where.active = true;
    } else if (activeParam === 'false') {
      where.active = false;
    }

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coupon.count({ where }),
    ]);

    res.json({
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    });
  } catch (err) {
    next(err);
  }
});

// Create a new coupon.
router.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const prisma = createTenantPrismaClient(tenantId);

    const {
      code,
      description,
      percentageOff,
      amountOff,
      active,
      validFrom,
      validTo,
      maxUses,
      minSubtotal,
    } = req.body as {
      code?: string;
      description?: string;
      percentageOff?: number | null;
      amountOff?: number | null;
      active?: boolean;
      validFrom?: string | null;
      validTo?: string | null;
      maxUses?: number | null;
      minSubtotal?: number | null;
    };

    if (!code) {
      return res.status(400).json({ message: 'Coupon code is required' });
    }

    if (!percentageOff && !amountOff) {
      return res
        .status(400)
        .json({ message: 'Provide either percentageOff or amountOff' });
    }

    const normalizedCode = code.trim().toUpperCase();

    const existing = await prisma.coupon.findFirst({
      where: { tenantId, code: normalizedCode },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: 'Coupon code already exists for this tenant' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        tenantId,
        code: normalizedCode,
        description: description || null,
        percentageOff:
          typeof percentageOff === 'number' && percentageOff > 0
            ? percentageOff
            : null,
        amountOff:
          typeof amountOff === 'number' && amountOff > 0 ? amountOff : null,
        active: active ?? true,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        maxUses:
          typeof maxUses === 'number' && maxUses > 0 ? Math.floor(maxUses) : null,
        minSubtotal:
          typeof minSubtotal === 'number' && minSubtotal > 0
            ? minSubtotal
            : null,
      },
    });

    res.status(201).json(coupon);
  } catch (err) {
    next(err);
  }
});

export default router;