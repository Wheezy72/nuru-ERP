import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class SystemLogService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async listLogs(params: { page?: number; pageSize?: number }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.systemLog.findMany({
        where: { tenantId: this.tenantId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.systemLog.count({
        where: { tenantId: this.tenantId },
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }
}