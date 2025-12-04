import { Router } from 'express';
import { ShiftService } from '../core/ShiftService';
import { requireAuth } from '../../../shared/middleware/requireRole';

const router = Router();

router.use(requireAuth);

function getTenantAndUser(req: any) {
  const user = (req as any).user as { id: string; tenantId: string } | undefined;
  if (!user?.tenantId || !user?.id) {
    throw new Error('Missing authenticated user/tenant context');
  }
  return user;
}

/**
 * Get the current open shift for the authenticated user (if any).
 */
router.get('/current', async (req, res, next) => {
  try {
    const user = getTenantAndUser(req);
    const service = new ShiftService(user.tenantId);
    const shift = await service.getCurrentShift(user.id);
    res.json({ shift });
  } catch (err) {
    next(err);
  }
});

/**
 * Open a new shift with an opening float (cash in till).
 */
router.post('/open', async (req, res, next) => {
  try {
    const user = getTenantAndUser(req);
    const service = new ShiftService(user.tenantId);
    const { openingFloat } = req.body as { openingFloat?: number };
    if (openingFloat === undefined || openingFloat === null) {
      return res
        .status(400)
        .json({ message: 'openingFloat is required' });
    }
    const shift = await service.openShift({
      userId: user.id,
      openingFloat: Number(openingFloat),
    });
    res.json(shift);
  } catch (err) {
    next(err);
  }
});

/**
 * Close the current OPEN shift with a blind cash count.
 */
router.post('/close', async (req, res, next) => {
  try {
    const user = getTenantAndUser(req);
    const service = new ShiftService(user.tenantId);
    const { closingFloat } = req.body as { closingFloat?: number };
    if (closingFloat === undefined || closingFloat === null) {
      return res
        .status(400)
        .json({ message: 'closingFloat is required' });
    }
    const shift = await service.closeShift({
      userId: user.id,
      closingFloat: Number(closingFloat),
    });
    res.json(shift);
  } catch (err) {
    next(err);
  }
});

export default router;