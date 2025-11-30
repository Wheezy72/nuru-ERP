import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class AuthService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async login(email: string, password: string) {
    const prisma = this.prisma;

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new Error('Invalid credentials');
    }

    return this.issueToken(user.id);
  }

  async loginWithGoogle(idToken: string) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID is not configured');
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('Invalid Google token');
    }

    const prisma = this.prisma;
    const email = payload.email;
    const name = payload.name || payload.given_name || null;

    let user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      // Auto-register with conservative default role
      user = await prisma.user.create({
        data: {
          tenantId: this.tenantId,
          email,
          name,
          role: 'CASHIER',
          passwordHash: await bcrypt.hash(
            Math.random().toString(36).slice(2),
            10
          ),
        },
      });
    }

    return this.issueToken(user.id);
  }

  private async issueToken(userId: string) {
    const prisma = this.prisma;

    const user = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const token = jwt.sign(
      {
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
      },
      secret,
      { expiresIn: '1d' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }
}