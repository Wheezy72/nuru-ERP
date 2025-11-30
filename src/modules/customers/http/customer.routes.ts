import { Router } from 'express';
import { CustomerService } from '../core/CustomerService';

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
    const service = new CustomerService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);
    const search = (req.query.search as string) || undefined;

    const result = await service.listCustomers({ page, pageSize, search });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new CustomerService(tenantId);
    const customer = await service.createCustomer(req.body);
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new CustomerService(tenantId);
    const customer = await service.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new CustomerService(tenantId);
    const customer = await service.updateCustomer(req.params.id, req.body);
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

export default router;