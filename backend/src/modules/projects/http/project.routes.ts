import { Router } from 'express';
import { ProjectService } from '../core/ProjectService';
import {
  requireAuth,
  requireRole,
} from '../../../shared/middleware/requireRole';

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

router.get('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ProjectService(tenantId);
    const projects = await service.listProjects();
    res.json({ items: projects });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ProjectService(tenantId);
    const { name, code, startDate, endDate } = req.body as {
      name?: string;
      code?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!name || !code || !startDate) {
      return res.status(400).json({
        message: 'name, code and startDate are required',
      });
    }

    const project = await service.createProject({
      name,
      code,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    });

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/summary', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const service = new ProjectService(tenantId);
    const summary = await service.getProjectSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;