import { Router } from 'express';
import { ImportService } from '../core/ImportService';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';
import { parseCsv } from '../../../shared/import/csv';

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

router.post('/customers', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ImportService(tenantId);
    const { csv, rows, dryRun } = req.body as {
      csv?: string;
      rows?: Record<string, unknown>[];
      dryRun?: boolean;
    };

    let parsedRows: Record<string, unknown>[] = [];

    if (Array.isArray(rows) && rows.length > 0) {
      parsedRows = rows;
    } else if (typeof csv === 'string' && csv.trim().length > 0) {
      const parsed = parseCsv(csv);
      parsedRows = parsed.rows;
    } else {
      return res.status(400).json({
        message: 'Provide either csv (string) or rows (array) in request body',
      });
    }

    const result = await service.importCustomers({
      rows: parsedRows,
      dryRun,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ImportService(tenantId);
    const { csv, rows, dryRun } = req.body as {
      csv?: string;
      rows?: Record<string, unknown>[];
      dryRun?: boolean;
    };

    let parsedRows: Record<string, unknown>[] = [];

    if (Array.isArray(rows) && rows.length > 0) {
      parsedRows = rows;
    } else if (typeof csv === 'string' && csv.trim().length > 0) {
      const parsed = parseCsv(csv);
      parsedRows = parsed.rows;
    } else {
      return res.status(400).json({
        message: 'Provide either csv (string) or rows (array) in request body',
      });
    }

    const result = await service.importProducts({
      rows: parsedRows,
      dryRun,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;