import { Router } from 'express';
import {
  requireAuth,
  requireRole,
} from '../../../shared/middleware/requireRole';
import { DepreciationService } from '../core/DepreciationService';

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

router.get('/assets', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new DepreciationService(tenantId);
    const assets = await service.listAssets();
    res.json(assets);
  } catch (err) {
    next(err);
  }
});

router.get('/depreciation-runs', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new DepreciationService(tenantId);
    const runs = await service.listRuns();
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

router.post('/depreciation/run', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new DepreciationService(tenantId);
    const { period } = req.body as { period?: string };

    if (!period) {
      return res.status(400).json({ message: 'period (YYYY-MM) is required' });
    }

    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;

    const result = await service.runPeriod(period, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;