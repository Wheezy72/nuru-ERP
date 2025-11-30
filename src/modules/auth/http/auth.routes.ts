import { Router } from 'express';
import { AuthService } from '../core/AuthService';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, tenantId } = req.body as {
      email?: string;
      password?: string;
      tenantId?: string;
    };

    if (!email || !password || !tenantId) {
      return res.status(400).json({ message: 'email, password and tenantId are required' });
    }

    const service = new AuthService(tenantId);
    const result = await service.login(email, password);

    res.json(result);
  } catch (err: any) {
    if (err.message === 'Invalid credentials') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    next(err);
  }
});

export default router;