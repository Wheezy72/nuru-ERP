import { Router } from 'express';
import { InvoiceService } from '../core/InvoiceService';
import { TaxService } from '../../accounting/core/TaxService';
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

router.get('/:id', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);
    const result = await service.getInvoiceWithBalances(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);
    const result = await service.getInvoiceHistory(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);

    const trainingHeader = (req.headers['x-training-mode'] ||
      req.headers['x_training_mode'] ||
      '') as string;
    const isTraining =
      typeof trainingHeader === 'string' &&
      ['1', 'true', 'yes'].includes(trainingHeader.toLowerCase());

    const invoice = await service.createInvoice({
      ...req.body,
      isTraining,
    });
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

    // Enqueue for tax signing if tax integration is configured.
    try {
      const taxService = new TaxService(tenantId);
      await taxService.enqueueInvoice(invoice.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to enqueue invoice for tax signing', err);
    }

    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/manual-payment', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);
    const { amount, method, reference, paidAt } = req.body as {
      amount?: number;
      method?: string;
      reference?: string;
      paidAt?: string;
    };

    if (typeof amount !== 'number' || !method) {
      return res
        .status(400)
        .json({ message: 'amount and method are required' });
    }

    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;

    const paidAtDate = paidAt ? new Date(paidAt) : new Date();

    const invoice = await service.recordExternalPayment(req.params.id, {
      amount,
      method,
      reference,
      paidAt: paidAtDate,
      userId,
    });

    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/remind', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);

    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;

    await service.sendPaymentReminder(req.params.id, userId);
    res.json({ message: 'Reminder sent (if WhatsApp is configured).' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/redeem-loyalty', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new InvoiceService(tenantId);
    const { points } = req.body as { points?: number };

    if (typeof points !== 'number' || points <= 0) {
      return res.status(400).json({ message: 'points (positive number) is required' });
    }

    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;

    const invoice = await service.redeemLoyalty(req.params.id, points, userId);

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