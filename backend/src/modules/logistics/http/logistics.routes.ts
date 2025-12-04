import { Router } from 'express';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';
import { LogisticsService } from '../core/LogisticsService';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['ADMIN', 'MANAGER']));

function getTenantAndUser(req: any) {
  const user = (req as any).user as
    | { id?: string; tenantId?: string }
    | undefined;
  if (!user?.tenantId) {
    throw new Error('Missing tenant context');
  }
  return user;
}

/**
 * List recent trips with their vehicles and gate passes.
 */
router.get('/trips', async (req, res, next) => {
  try {
    const user = getTenantAndUser(req);
    const service = new LogisticsService(user.tenantId);
    const trips = await service.listTrips();
    res.json({ trips });
  } catch (err) {
    next(err);
  }
});

/**
 * Create a new trip and initial gate pass between two locations.
 * Expects:
 *  - vehicleRegistration (string)
 *  - driverName? (string)
 *  - driverPhone? (string)
 *  - fromLocationCode (string)
 *  - toLocationCode (string)
 *  - plannedDate? (ISO string)
 */
router.post('/trips', async (req, res, next) => {
  try {
    const user = getTenantAndUser(req);
    const service = new LogisticsService(user.tenantId);
    const {
      vehicleRegistration,
      driverName,
      driverPhone,
      fromLocationCode,
      toLocationCode,
      plannedDate,
    } = req.body as {
      vehicleRegistration?: string;
      driverName?: string;
      driverPhone?: string;
      fromLocationCode?: string;
      toLocationCode?: string;
      plannedDate?: string;
    };

    if (!vehicleRegistration || !fromLocationCode || !toLocationCode) {
      return res.status(400).json({
        message:
          'vehicleRegistration, fromLocationCode, and toLocationCode are required',
      });
    }

    const planned =
      plannedDate && !Number.isNaN(Date.parse(plannedDate))
        ? new Date(plannedDate)
        : new Date();

    const result = await service.createTripWithGatePass({
      vehicleRegistration,
      driverName,
      driverPhone,
      fromLocationCode,
      toLocationCode,
      plannedDate: planned,
      userId: user.id,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Mark a gate pass as ISSUED (usually done by dispatch).
 */
router.post('/gate-passes/:id/issue', async (req, res, next) => {
  try {
    const user = getTenantAndUser(req);
    const service = new LogisticsService(user.tenantId);
    const { id } = req.params;
    const result = await service.issueGatePass(id, user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Security scan-out action at the gate. Marks gate pass as SCANNED_OUT and trip as DISPATCHED.
 */
router.post('/gate-passes/:id/scan-out', async (req, res, next) => {
  try {
    const user = getTenantAndUser(req);
    const service = new LogisticsService(user.tenantId);
    const { id } = req.params;
    const result = await service.scanGatePassOut(id, user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;