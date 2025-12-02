import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { PurchaseOrderService } from '../core/PurchaseOrderService';
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

router.get('/purchase-orders', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new PurchaseOrderService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);
    const status = (req.query.status as string) || 'ALL';

    const result = await service.listPurchaseOrders({
      page,
      pageSize,
      status,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/purchase-orders', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new PurchaseOrderService(tenantId);
    const { supplierId, projectId, orderDate, expectedDate, items } = req.body as {
      supplierId?: string;
      projectId?: string;
      orderDate?: string;
      expectedDate?: string;
      items?: {
        productId: string;
        quantity: string | number;
        unitCost: string | number;
        uomId: string;
      }[];
    };

    if (!supplierId) {
      return res.status(400).json({ message: 'supplierId is required' });
    }
    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ message: 'items (non-empty array) are required' });
    }

    const parsedItems = items.map((item) => ({
      productId: item.productId,
      quantity: new (require('@prisma/client').Prisma.Decimal)(
        item.quantity as any,
      ),
      unitCost: new (require('@prisma/client').Prisma.Decimal)(
        item.unitCost as any,
      ),
      uomId: item.uomId,
    }));

    const po = await service.createPurchaseOrder({
      supplierId,
      projectId: projectId || null,
      orderDate: orderDate ? new Date(orderDate) : new Date(),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      items: parsedItems,
    });

    res.status(201).json(po);
  } catch (err) {
    next(err);
  }
});

router.post('/purchase-orders/:id/receive', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new PurchaseOrderService(tenantId);
    const { locationId } = req.body as { locationId?: string };

    if (!locationId) {
      return res
        .status(400)
        .json({ message: 'locationId is required to receive a PO' });
    }

    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;

    const po = await service.receivePurchaseOrder(
      req.params.id,
      locationId,
      userId,
    );

    res.json(po);
  } catch (err) {
    next(err);
  }
});

export default router;