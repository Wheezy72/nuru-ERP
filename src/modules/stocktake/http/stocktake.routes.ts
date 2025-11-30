import { Router } from 'express';
import { StockTakeService } from '../core/StockTakeService';
import { requireAuth, requireRole, AuthUser } from '../../../shared/middleware/requireRole';

const router = Router();

router.use(requireAuth);

function getTenantContext(req: any) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user?.tenantId) {
    throw new Error('Missing tenant context');
  }
  return user;
}

// Manager/Owner initiates blind stock takes
router.post('/', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const user = getTenantContext(req);
    const service = new StockTakeService(user.tenantId);
    const { locationId, productIds } = req.body as {
      locationId?: string;
      productIds?: string[];
    };

    if (!locationId || !productIds || productIds.length === 0) {
      return res
        .status(400)
        .json({ message: 'locationId and at least one productId are required' });
    }

    const stockTake = await service.createBlindStockTake({
      locationId,
      productIds,
      createdByUserId: user.id,
    });

    res.status(201).json(stockTake);
  } catch (err) {
    next(err);
  }
});

// Manager/Owner listing
router.get('/', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const user = getTenantContext(req);
    const service = new StockTakeService(user.tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);

    const result = await service.listStockTakes({ page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Cashier/Manager/Owner fetch tasks
router.get('/:id/items', async (req, res, next) => {
  try {
    const user = getTenantContext(req);
    const service = new StockTakeService(user.tenantId);
    const stockTake = await service.getStockTakeForUser(
      req.params.id,
      user.role
    );
    res.json(stockTake);
  } catch (err) {
    next(err);
  }
});

// Cashier submits count; variance is hidden from them
router.post('/:id/items/:itemId/count', async (req, res, next) => {
  try {
    const user = getTenantContext(req);
    const service = new StockTakeService(user.tenantId);
    const countedQuantity = req.body.countedQuantity;

    if (countedQuantity === undefined || countedQuantity === null) {
      return res.status(400).json({ message: 'countedQuantity is required' });
    }

    await service.submitCount({
      stockTakeId: req.params.id,
      itemId: req.params.itemId,
      countedQuantity,
      countedByUserId: user.id,
    });

    // Intentionally do not return expected quantity or variance
    res.json({ status: 'COUNTED' });
  } catch (err) {
    next(err);
  }
});

export default router;