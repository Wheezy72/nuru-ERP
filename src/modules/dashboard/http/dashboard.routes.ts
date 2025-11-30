import { Router } from 'express';
import { DashboardService } from '../core/DashboardService';

const router = Router();

function getTenantId(req: any): string {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    throw new Error('Missing x-tenant-id header');
  }
  return tenantId;
}

router.get('/summary', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new DashboardService(tenantId);
    const summary = await service.getSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;