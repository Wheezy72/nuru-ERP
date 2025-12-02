import { Prisma, StockTransferStatus } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

export class StockTransferService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  async listTransfers(params: { page?: number; pageSize?: number }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.StockTransferWhereInput = {
      tenantId: this.tenantId,
    };

    const [items, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          from: true,
          to: true,
          items: true,
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async createTransfer(input: {
    fromLocationId: string;
    toLocationId: string;
    createdByUserId?: string | null;
    items: {
      productId: string;
      uomId: string;
      quantity: Prisma.Decimal;
    }[];
  }) {
    const prisma = this.prisma;

    if (!input.items || input.items.length === 0) {
      throw new Error('Stock transfer must have at least one item');
    }
    if (input.fromLocationId === input.toLocationId) {
      throw new Error('fromLocationId and toLocationId must be different');
    }

    const transfer = await prisma.stockTransfer.create({
      data: {
        tenantId: this.tenantId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        createdByUserId: input.createdByUserId ?? null,
        status: StockTransferStatus.DRAFT,
        items: {
          create: input.items.map((item) => ({
            tenantId: this.tenantId,
            productId: item.productId,
            uomId: item.uomId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return transfer;
  }

  async postTransfer(id: string, userId?: string | null) {
    const prisma = this.prisma;

    const updated = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, tenantId: this.tenantId },
        include: {
          items: true,
        },
      });

      if (!transfer) {
        throw new Error('Stock transfer not found');
      }

      if (transfer.status === StockTransferStatus.CANCELLED) {
        throw new Error('Cannot post a cancelled transfer');
      }
      if (transfer.status === StockTransferStatus.POSTED) {
        throw new Error('Transfer already posted');
      }

      for (const item of transfer.items) {
        const qty = item.quantity as unknown as Prisma.Decimal;
        if (qty.lte(0)) {
          continue;
        }

        // Decrement from source
        await this.adjustStockTx(tx, {
          productId: item.productId,
          locationId: transfer.fromLocationId,
          uomId: item.uomId,
          quantityDelta: qty.mul(new Prisma.Decimal(-1)),
        });

        // Increment at destination
        await this.adjustStockTx(tx, {
          productId: item.productId,
          locationId: transfer.toLocationId,
          uomId: item.uomId,
          quantityDelta: qty,
        });
      }

      const posted = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: StockTransferStatus.POSTED,
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'STOCK_TRANSFER_POSTED',
          entityType: 'StockTransfer',
          entityId: transfer.id,
          metadata: {
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            itemCount: transfer.items.length,
          },
        },
      });

      return posted;
    });

    return updated;
  }

  private async adjustStockTx(
    tx: Prisma.TransactionClient,
    input: {
      productId: string;
      locationId: string;
      uomId: string;
      quantityDelta: Prisma.Decimal;
    },
  ) {
    const existing = await tx.stockQuant.findUnique({
      where: {
        tenantId_productId_locationId_batchId_uomId: {
          tenantId: this.tenantId,
          productId: input.productId,
          locationId: input.locationId,
          batchId: null,
          uomId: input.uomId,
        },
      },
    });

    if (!existing) {
      if (input.quantityDelta.lt(0)) {
        throw new Error('Insufficient stock for transfer');
      }

      return tx.stockQuant.create({
        data: {
          tenantId: this.tenantId,
          productId: input.productId,
          locationId: input.locationId,
          batchId: null,
          uomId: input.uomId,
          quantity: input.quantityDelta,
        },
      });
    }

    const newQty = (existing.quantity as unknown as Prisma.Decimal).add(
      input.quantityDelta,
    );

    if (newQty.lt(0)) {
      throw new Error('Insufficient stock for transfer');
    }

    return tx.stockQuant.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  }
}