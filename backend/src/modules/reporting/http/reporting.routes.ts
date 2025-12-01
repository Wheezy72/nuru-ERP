import { Router } from 'express';
import { ReportingService } from '../core/ReportingService';
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

router.get('/sales', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ReportingService(tenantId);
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const now = new Date();
    const defaultStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
      0,
      0,
      0,
      0
    );
    const defaultEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : defaultEnd;

    const csv = await service.getSalesCsv({ startDate: start, endDate: end });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales_${start.toISOString().slice(0, 10)}_${end
        .toISOString()
        .slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ReportingService(tenantId);

    const csv = await service.getInventoryCsv();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="inventory.csv"'
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/tax-details', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ReportingService(tenantId);
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const now = new Date();
    const defaultStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
      0,
      0,
      0,
      0
    );
    const defaultEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : defaultEnd;

    const items = await service.getTaxDetails({ startDate: start, endDate: end });

    res.json({
      items,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/tax-csv', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ReportingService(tenantId);
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const now = new Date();
    const defaultStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
      0,
      0,
      0,
      0
    );
    const defaultEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : defaultEnd;

    const csv = await service.getTaxCsv({ startDate: start, endDate: end });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="kra_tax_${start
        .toISOString()
        .slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/chama/statement', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ReportingService(tenantId);
    const { memberId, startDate, endDate } = req.query as {
      memberId?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!memberId) {
      return res.status(400).json({ message: 'memberId is required' });
    }

    const now = new Date();
    const defaultStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
      0,
      0,
      0,
      0
    );
    const defaultEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : defaultEnd;

    const pdf = await service.getMemberStatementPdf(memberId, {
      startDate: start,
      endDate: end,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="member_statement_${memberId}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

export default router;