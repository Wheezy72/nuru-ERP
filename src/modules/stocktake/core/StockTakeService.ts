import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class StockTakeService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async createBlindStockTake(input: {
    locationId: string;
    productIds: string[];
    createdByUserId: string;
  }) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const stockTake = await tx.stockTake.create({
        data: {
          tenantId: this.tenantId,
          locationId: input.locationId,
          createdByUserId: input.createdByUserId,
          status: 'OPEN',
        },
      });

      const items: {
        tenantId: string;
        stockTakeId: string;
        productId: string;
        expectedQuantity: Prisma.Decimal;
      }[] = [];

      for (const productId of input.productIds) {
        const quants = await tx.stockQuant.findMany({
          where: {
            tenantId: this.tenantId,
            locationId: input.locationId,
            productId,
          },
        });

        const expected = quants.reduce(
          (acc, q) => acc.add(q.quantity),
          new Prisma.Decimal(0)
        );

        items.push({
          tenantId: this.tenantId,
          stockTakeId: stockTake.id,
          productId,
          expectedQuantity: expected,
        });
      }

      if (items.length > 0) {
        await tx.stockTakeItem.createMany({ data: items });
      }

      return tx.stockTake.findUnique({
        where: { id: stockTake.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });
  }

  async listStockTakes(params: { page?: number; pageSize?: number }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.StockTakeWhereInput = {
      tenantId: this.tenantId,
    };

    const [items, total] = await Promise.all([
      prisma.stockTake.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          location: true,
          createdBy: true,
        },
      }),
      prisma.stockTake.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async getStockTakeForUser(stockTakeId: string, role: 'ADMIN' | 'MANAGER' | 'CASHIER') {
    const prisma = this.prisma;

    const stockTake = await prisma.stockTake.findFirst({
      where: { id: stockTakeId, tenantId: this.tenantId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        location: true,
        createdBy: true,
      },
    });

    if (!stockTake) {
      throw new Error('Stock take not found');
    }

    if (role === 'CASHIER') {
      return {
        id: stockTake.id,
        status: stockTake.status,
        location: {
          id: stockTake.location.id,
          name: stockTake.location.name,
        },
        items: stockTake.items.map((item) => ({
          id: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
          },
          status: item.status,
        })),
      };
    }

    return stockTake;
  }

  async submitCount(params: {
    stockTakeId: string;
    itemId: string;
    countedQuantity: Prisma.Decimal | number | string;
    countedByUserId: string;
  }) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const item = await tx.stockTakeItem.findFirst({
        where: {
          id: params.itemId,
          stockTakeId: params.stockTakeId,
          tenantId: this.tenantId,
        },
        include: {
          stockTake: true,
          product: true,
        },
      });

      if (!item) {
        throw new Error('Stock take item not found');
      }

      if (item.stockTake.status !== 'OPEN') {
        throw new Error('Stock take is not open for counting');
      }

      const counted = new Prisma.Decimal(params.countedQuantity as any);
      const variance = counted.sub(item.expectedQuantity);

      const updated = await tx.stockTakeItem.update({
        where: { id: item.id },
        data: {
          countedQuantity: counted,
          variance,
          status: 'COUNTED',
        },
      });

      if (!variance.eq(0)) {
        await tx.systemLog.create({
          data: {
            tenantId: this.tenantId,
            userId: params.countedByUserId,
            action: 'STOCKTAKE_VARIANCE',
            entityType: 'StockTakeItem',
            entityId: item.id,
            metadata: {
              productId: item.productId,
              productName: item.product.name,
              locationId: item.stockTake.locationId,
              expectedQuantity: item.expectedQuantity,
              countedQuantity: counted,
              variance,
              stockTakeId: item.stockTakeId,
            },
          },
        });
      }

      // Optionally mark the whole stock take as completed when all items are counted
      const remaining = await tx.stockTakeItem.count({
        where: {
          tenantId: this.tenantId,
          stockTakeId: params.stockTakeId,
          status: 'PENDING',
        },
      });

      if (remaining === 0) {
        await tx.stockTake.update({
          where: { id: params.stockTakeId },
          data: { status: 'COMPLETED' },
        });
      }

      return updated;
    });
  }
}