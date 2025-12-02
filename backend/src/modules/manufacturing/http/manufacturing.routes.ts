import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { ManufacturingService } from '../core/ManufacturingService';
import {
  requireAuth,
  requireRole,
} from '../../../shared/middleware/requireRole';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['ADMIN', 'MANAGER']));

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

router.get('/boms', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ManufacturingService(tenantId);
    const boms = await service.listBoms();
    res.json({ items: boms });
  } catch (err) {
    next(err);
  }
});

router.post('/boms', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ManufacturingService(tenantId);
    const { productId, name, items } = req.body as {
      productId?: string;
      name?: string;
      items?: {
        componentProductId: string;
        uomId: string;
        quantity: string | number;
      }[];
    };

    if (!productId || !name) {
      return res
        .status(400)
        .json({ message: 'productId and name are required' });
    }

    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ message: 'items (non-empty array) are required' });
    }

    const parsedItems = items.map((item) => ({
      componentProductId: item.componentProductId,
      uomId: item.uomId,
      quantity: new Prisma.Decimal(item.quantity as any),
    }));

    const bom = await service.createBom({
      productId,
      name,
      items: parsedItems,
    });

    res.status(201).json(bom);
  } catch (err) {
    next(err);
  }
});

router.post('/production-orders', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ManufacturingService(tenantId);
    const { bomId, locationId, quantity, scheduledAt } = req.body as {
      bomId?: string;
      locationId?: string;
      quantity?: string | number;
      scheduledAt?: string;
    };

    if (!bomId || !locationId || quantity === undefined) {
      return res.status(400).json({
        message: 'bomId, locationId and quantity are required',
      });
    }

    const order = await service.createProductionOrder({
      bomId,
      locationId,
      quantity: new Prisma.Decimal(quantity as any),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.post('/production-orders/:id/complete', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ManufacturingService(tenantId);

    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;

    const order = await service.completeProductionOrder(req.params.id, userId);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

export default router;