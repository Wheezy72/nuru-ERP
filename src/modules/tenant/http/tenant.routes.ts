import { Router } from 'express';
import { TenantService } from '../core/TenantService';

const router = Router();

function getTenantId(req: any): string {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    throw new Error('Missing x-tenant-id header');
  }
  return tenantId;
}

router.get('/features', async (req, res, next) =&gt; {
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