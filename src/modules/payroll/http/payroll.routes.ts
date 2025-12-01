import { Router } from 'express';
import { PayrollService } from '../core/PayrollService';
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

router.get('/employees', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new PayrollService(tenantId);
    const employees = await service.listActiveEmployees();
    res.json({ items: employees });
  } catch (err) {
    next(err);
  }
});

router.post('/runs', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new PayrollService(tenantId);

    const { entries } = req.body as {
      entries?: { employeeId: string; daysWorked: number; channel?: 'CASH' | 'MPESA' }[];
    };

    if (!entries || entries.length === 0) {
      return res.status(400).json({ message: 'entries are required' });
    }

    const result = await service.createRun(entries);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;