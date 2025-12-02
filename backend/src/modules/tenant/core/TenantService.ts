import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class TenantService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async getFeatures() {
    const prisma = this.prisma;

    const tenant = await prisma.tenant.findFirst({
      where: { id: this.tenantId },
      select: { features: true },
    });

    return tenant?.features || {};
  }

  async updateFeatures(patch: Record<string, unknown>) {
    const prisma = this.prisma;

    const current = await prisma.tenant.findFirst({
      where: { id: this.tenantId },
      select: { features: true },
    });

    const merged = {
      ...(current?.features || {}),
      ...patch,
    };

    const updated = await prisma.tenant.update({
      where: { id: this.tenantId },
      data: {
        features: merged,
      },
      select: { features: true },
    });

    return updated.features || {};
  }
}