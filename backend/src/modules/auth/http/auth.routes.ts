import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../core/AuthService';
import bcrypt from 'bcryptjs';
import { WhatsAppService } from '../../../shared/whatsapp/WhatsAppService';

const router = Router();
const prisma = new PrismaClient();

// Limit brute-force attempts on login: 100 requests / 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/lookup-tenants', async (req, res, next) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const users = await prisma.user.findMany({
      where: { email },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            features: true,
          },
        },
      },
    });

    if (users.length === 0) {
      return res.status(404).json({ message: 'No workspaces found for this email' });
    }

    const tenants = users.map((u) => ({
      tenantId: u.tenantId,
      name: u.tenant.name,
      code: u.tenant.code,
      features: u.tenant.features,
    }));

    res.json({ tenants });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
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

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { identifier } = req.body as { identifier?: string };
    if (!identifier) {
      return res.status(400).json({ message: 'identifier is required' });
    }

    const isEmail = identifier.includes('@');

    const user = await prisma.user.findFirst({
      where: isEmail ? { email: identifier } : { phone: identifier },
    });

    if (!user || !user.phone) {
      return res
        .status(400)
        .json({ message: 'User not found or no phone on record' });
    }

    const token = Math.floor(100000 + Math.random() * 900000)
      .toString()
      .slice(0, 6);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const whatsapp = new WhatsAppService(user.tenantId);
    await whatsapp.sendPasswordResetCode(user.phone, token);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { identifier, token, newPassword } = req.body as {
      identifier?: string;
      token?: string;
      newPassword?: string;
    };

    if (!identifier || !token || !newPassword) {
      return res
        .status(400)
        .json({ message: 'identifier, token and newPassword are required' });
    }

    const isEmail = identifier.includes('@');

    const user = await prisma.user.findFirst({
      where: isEmail ? { email: identifier } : { phone: identifier },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid reset request' });
    }

    const reset = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        token,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!reset) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      });
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;