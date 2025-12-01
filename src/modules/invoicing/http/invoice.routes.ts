import { Router } from 'express';
import { InvoiceService } from '../core/InvoiceService';
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

router.get('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const result = await service.listInvoices({ page, pageSize, status, search });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);
    const invoice = await service.createInvoice(req.body);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/post', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);
    const locationId = req.body.locationId as string | undefined;
    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;
    const invoice = await service.postInvoice(
      req.params.id,
      locationId || '',
      userId
    );
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

router.post('/bulk/school-term', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);
    const { productId, unitPrice, issueDate } = req.body as {
      productId?: string;
      unitPrice?: number;
      issueDate?: string;
    };

    if (!productId || typeof unitPrice !== 'number') {
      return res
        .status(400)
        .json({ message: 'productId and unitPrice are required' });
    }

    const issue = issueDate ? new Date(issueDate) : new Date();

    const result = await service.bulkGenerateForAllCustomers({
      productId,
      unitPrice,
      issueDate: issue,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;