import { Router } from 'express';
import { DashboardService } from '../core/DashboardService';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';

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

router.get('/summary', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new DashboardService(tenantId);
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };
    const summary = await service.getSummary({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;