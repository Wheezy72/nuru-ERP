import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

export class ProjectService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  async listProjects() {
    const prisma = this.prisma;

    const projects = await prisma.project.findMany({
      where: { tenantId: this.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  async createProject(input: {
    name: string;
    code: string;
    startDate: Date;
    endDate?: Date | null;
  }) {
    const prisma = this.prisma;

    const project = await prisma.project.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        code: input.code,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
      },
    });

    return project;
  }

  async getProjectSummary(projectId: string) {
    const prisma = this.prisma;

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: this.tenantId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const [invoiceAgg, poAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          tenantId: this.tenantId,
          projectId: project.id,
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.purchaseOrder.aggregate({
        where: {
          tenantId: this.tenantId,
          projectId: project.id,
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const invoiced =
      invoiceAgg._sum.totalAmount ?? new Prisma.Decimal(0);
    const costs = poAgg._sum.totalAmount ?? new Prisma.Decimal(0);
    const margin = invoiced.sub(costs);

    return {
      project,
      totals: {
        invoiced: Number(invoiced.toString()),
        costs: Number(costs.toString()),
        margin: Number(margin.toString()),
      },
    };
  }
}