import { Router } from 'express';
import { InvoiceService } from '../core/InvoiceService';

const router = Router();

function getTenantId(req: any): string {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!tenantId) {
    throw new Error('Missing x-tenant-id header');
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
    const invoice = await service.postInvoice(req.params.id, locationId || '');
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

export default router;