import { Router } from 'express';
import { TenantService } from '../core/TenantService';
import { requireAuth } from '../../../shared/middleware/requireRole';

const router = Router();

router.use(requireAuth);

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

router.get('/features', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new TenantService(tenantId);
    const features = await service.getFeatures();
    res.json({ features });
  } catch (err) {
    next(err);
  }
});

export default router;