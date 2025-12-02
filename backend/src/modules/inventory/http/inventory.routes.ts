import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { InventoryService } from '../core/InventoryService';
import { StockTransferService } from '../core/StockTransferService';
import { requireAuth } from '../../../shared/middleware/requireRole';

const router = Router();

router.use(requireAuth);

// Resolve tenant from authenticated user (preferred) or header (fallback)
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

// List products with server-side pagination
router.get('/products', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InventoryService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);
    const search = (req.query.search as string) || undefined;
    const isActiveParam = req.query.isActive as string | undefined;
    const isActive =
      isActiveParam !== undefined ? isActiveParam === 'true' : undefined;

    const result = await service.listProducts({
      page,
      pageSize,
      search,
      isActive,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InventoryService(tenantId);
    const product = await service.createProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

router.post('/stock/adjust', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InventoryService(tenantId);
    const result = await service.adjustStock(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/stock/break-bulk', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InventoryService(tenantId);
    const result = await service.breakBulk(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Stock transfer endpoints
router.get('/stock/transfers', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new StockTransferService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);

    const result = await service.listTransfers({ page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/stock/transfers', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new StockTransferService(tenantId);
    const { fromLocationId, toLocationId, items } = req.body as {
      fromLocationId?: string;
      toLocationId?: string;
      items?: { productId: string; uomId: string; quantity: string | number }[];
    };

    if (!fromLocationId || !toLocationId) {
      return res.status(400).json({
        message: 'fromLocationId and toLocationId are required',
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: 'items (non-empty array) are required',
      });
    }

    const parsedItems = items.map((item) => ({
      productId: item.productId,
      uomId: item.uomId,
      quantity: new Prisma.Decimal(item.quantity as any),
    }));

    const transfer = await service.createTransfer({
      fromLocationId,
      toLocationId,
      createdByUserId: null,
      items: parsedItems,
    });

    res.status(201).json(transfer);
  } catch (err) {
    next(err);
  }
});

router.post('/stock/transfers/:id/post', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new StockTransferService(tenantId);

    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;

    const transfer = await service.postTransfer(req.params.id, userId);
    res.json(transfer);
  } catch (err) {
    next(err);
  }
});

// Open Crate / Break Unit for a single product
router.post('/products/:id/break-unit', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InventoryService(tenantId);
    const { locationId, quantity, batchId } = req.body as {
      locationId?: string;
      quantity?: number;
      batchId?: string | null;
    };

    if (!locationId || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({
        message: 'locationId and a positive numeric quantity are required',
      });
    }

    const result = await service.breakUnit({
      productId: req.params.id,
      locationId,
      quantity,
      batchId: batchId ?? null,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;