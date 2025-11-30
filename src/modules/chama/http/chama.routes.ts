import { Router } from 'express';
import { ChamaService } from '../core/ChamaService';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';

const router = Router();

// All Chama routes require authenticated ADMIN
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

// Members
router.get('/members', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ChamaService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);
    const search = (req.query.search as string) || undefined;

    const result = await service.listMembers({ page, pageSize, search });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/members', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ChamaService(tenantId);
    const member = await service.createMember(req.body);
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

// Accounts
router.post('/accounts', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ChamaService(tenantId);
    const account = await service.openAccount(req.body);
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

router.post('/accounts/:id/adjust', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ChamaService(tenantId);
    const account = await service.adjustAccountBalance({
      accountId: req.params.id,
      amount: req.body.amount,
      type: req.body.type,
      reference: req.body.reference,
    });
    res.json(account);
  } catch (err) {
    next(err);
  }
});

// Loans
router.post('/loans', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userIdHeader = req.headers['x-user-id'];
    const userId =
      (Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader)?.toString() ||
      null;
    const service = new ChamaService(tenantId);
    const loan = await service.createLoan(req.body, userId);
    res.status(201).json(loan);
  } catch (err) {
    next(err);
  }
});

router.get('/loans', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ChamaService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);
    const status = (req.query.status as string) || undefined;

    const result = await service.listLoans({ page, pageSize, status });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Sessions
router.post('/sessions', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ChamaService(tenantId);
    const session = await service.createSession(req.body);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.get('/sessions', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ChamaService(tenantId);
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '25', 10);

    const result = await service.listSessions({ page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;