import { Router } from 'express';
import { SystemLogService } from '../core/SystemLogService';
import { requireRole } from '../../../shared/middleware/requireRole';

const router = Router();

function getTenantId(req: any): string {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    throw new Error('Missing x-tenant-id header');
  }
  return tenantId;
}

// All system endpoints require ADMIN role
router.use(requireRole(['ADMIN']));

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