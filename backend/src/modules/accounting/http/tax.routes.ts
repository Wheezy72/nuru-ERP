import { Router } from 'express';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';
import { TaxService } from '../core/TaxService';

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

/**
 * Enqueue an invoice for tax signing.
 */
router.post('/queue/:invoiceId', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new TaxService(tenantId);
    const { invoiceId } = req.params;

    const entry = await service.enqueueInvoice(invoiceId);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

/**
 * Process pending tax queue entries for this tenant.
 * Intended to be triggered by an admin or a cron-like job.
 */
router.post('/queue/process', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new TaxService(tenantId);
    const { max } = req.body as { max?: number };
    const result = await service.processPending(max ?? 20);
    res.json({ processed: result });
  } catch (err) {
    next(err);
  }
});

export default router;