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
}