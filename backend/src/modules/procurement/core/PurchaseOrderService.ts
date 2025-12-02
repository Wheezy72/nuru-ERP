import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';
import { AccountingService } from '../../accounting/core/AccountingService';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

export class PurchaseOrderService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  async listPurchaseOrders(params: {
    page?: number;
    pageSize?: number;
    status?: PurchaseOrderStatus | 'ALL' | string;
  }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId: this.tenantId,
      ...(params.status && params.status !== 'ALL'
        ? { status: params.status as PurchaseOrderStatus }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { orderDate: 'desc' },
        include: {
          supplier: true,
          project: true,
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async createPurchaseOrder(input: {
    supplierId: string;
    projectId?: string | null;
    orderDate: Date;
    expectedDate?: Date | null;
    items: {
      productId: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      uomId: string;
    }[];
  }) {
    const prisma = this.prisma;

    if (!input.items || input.items.length === 0) {
      throw new Error('Purchase order must have at least one item');
    }

    return prisma.$transaction(async (tx) => {
      const total = input.items.reduce(
        (acc, item) => acc.add(item.quantity.mul(item.unitCost)),
        new Prisma.Decimal(0),
      );

      const po = await tx.purchaseOrder.create({
        data: {
          tenantId: this.tenantId,
          supplierId: input.supplierId,
          projectId: input.projectId ?? null,
          status: PurchaseOrderStatus.DRAFT,
          orderDate: input.orderDate,
          expectedDate: input.expectedDate ?? null,
          totalAmount: total,
          items: {
            create: input.items.map((item) => ({
              tenantId: this.tenantId,
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              uomId: item.uomId,
              lineTotal: item.quantity.mul(item.unitCost),
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return po;
    });
  }

  async receivePurchaseOrder(
    id: string,
    locationId: string,
    userId?: string | null,
  ) {
    if (!locationId) {
      throw new Error('locationId is required to receive a purchase order');
    }

    const prisma = this.prisma;

    const updated = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId: this.tenantId },
        include: {
          items: true,
        },
      });

      if (!po) {
        throw new Error('Purchase order not found');
      }

      if (po.status === PurchaseOrderStatus.CANCELLED) {
        throw new Error('Cannot receive a cancelled purchase order');
      }

      if (po.status === PurchaseOrderStatus.RECEIVED) {
        throw new Error('Purchase order already received');
      }

      for (const item of po.items) {
        const qty = item.quantity as unknown as Prisma.Decimal;
        if (qty.lte(0)) {
          continue;
        }

        await this.adjustStockTx(tx, {
          productId: item.productId,
          locationId,
          uomId: item.uomId,
          quantityDelta: qty,
        });
      }

      const received = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: PurchaseOrderStatus.RECEIVED,
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'PURCHASE_ORDER_RECEIVED',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          metadata: {
            locationId,
            totalAmount: po.totalAmount,
          },
        },
      });

      return received;
    });

    // Best-effort GL posting; do not block receive operation if it fails.
    try {
      const accounting = new AccountingService(this.tenantId);
      await accounting.recordPurchaseOrderReceipt(id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        'Failed to record GL entry for purchase order',
        id,
        err,
      );
    }

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
      throw new Error('Insufficient stock to apply purchase order receipt');
    }

    return tx.stockQuant.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  }
}