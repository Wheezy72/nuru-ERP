import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class CustomerService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async listCustomers(params: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerWhereInput = {
      tenantId: this.tenantId,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { kraPin: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async createCustomer(input: {
    name: string;
    phone?: string;
    email?: string;
    kraPin?: string;
  }) {
    const prisma = this.prisma;

    return prisma.customer.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        kraPin: input.kraPin,
      },
    });
  }

  async updateCustomer(id: string, input: { name?: string; phone?: string; email?: string; kraPin?: string }) {
    const prisma = this.prisma;

    return prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.kraPin !== undefined ? { kraPin: input.kraPin } : {}),
      },
    });
  }

  async getCustomer(id: string) {
    const prisma = this.prisma;
    return prisma.customer.findUnique({ where: { id } });
  }
}