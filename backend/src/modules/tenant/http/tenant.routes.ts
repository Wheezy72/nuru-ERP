import { Router } from 'express';
import { TenantService } from '../core/TenantService';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';
import { TemplateEngine } from '../core/TemplateEngine';

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

/**
 * Update tenant feature flags (mode, role visibility, etc.).
 * Restricted to ADMIN.
 */
router.post('/features', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new TenantService(tenantId);
    const patch = req.body as Record<string, unknown>;
    const features = await service.updateFeatures(patch);
    res.json({ features });
  } catch (err) {
    next(err);
  }
});

router.get('/templates/meta', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const engine = new TemplateEngine(tenantId);
    const meta = await engine.getMeta();
    res.json(meta);
  } catch (err) {
    next(err);
  }
});

router.post('/templates/apply', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const engine = new TemplateEngine(tenantId);
    const { baseType, blocks } = req.body as {
      baseType?: string;
      blocks?: string[];
    };

    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      return res
        .status(400)
        .json({ message: 'At least one feature block must be selected' });
    }

    await engine.applyTemplate({
      baseType: baseType as any,
      blocks: blocks as any,
    });

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

export default router;