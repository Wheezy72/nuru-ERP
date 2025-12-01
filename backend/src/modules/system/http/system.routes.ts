import { Router } from 'express';
import { SystemLogService } from '../core/SystemLogService';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';

const router = Router();

router.use(requireAuth);

// All system endpoints require ADMIN role
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

router.get('/logs', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new SystemLogService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '50', 10);

    const result = await service.listLogs({ page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;