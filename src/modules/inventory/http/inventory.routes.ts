import { Router } from 'express';
import { InventoryService } from '../core/InventoryService';

const router = Router();

// Middleware to extract tenantId from request (e.g. from JWT or header)
function getTenantId(req: any): string {
  // For now, read from header. In production, derive from authenticated user.
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    throw new Error('Missing x-tenant-id header');
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

export default router;