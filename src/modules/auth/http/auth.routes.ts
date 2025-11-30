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
      return res
        .status(400)
        .json({ message: 'email, password and tenantId are required' });
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

router.post('/google', async (req, res, next) => {
  try {
    const { idToken, tenantId } = req.body as {
      idToken?: string;
      tenantId?: string;
    };

    if (!idToken || !tenantId) {
      return res
        .status(400)
        .json({ message: 'idToken and tenantId are required' });
    }

    const service = new AuthService(tenantId);
    const result = await service.loginWithGoogle(idToken);

    res.json(result);
  } catch (err: any) {
    if (err.message === 'Invalid Google token') {
      return res.status(401).json({ message: 'Invalid Google token' });
    }
    if (err.message === 'Google Client ID not configured') {
      return res.status(500).json({ message: 'Google Client ID not configured' });
    }
    next(err);
  }
});

export default router;