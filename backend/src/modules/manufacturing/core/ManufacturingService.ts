import { Prisma, ProductionOrderStatus } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

export class ManufacturingService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  async listBoms() {
    const prisma = this.prisma;

    const boms = await prisma.billOfMaterial.findMany({
      where: { tenantId: this.tenantId },
      include: {
        product: true,
        items: {
          include: {
            componentProduct: true,
            uom: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return boms;
  }

  async createBom(input: {
    productId: string;
    name: string;
    items: {
      componentProductId: string;
      uomId: string;
      quantity: Prisma.Decimal;
    }[];
  }) {
    const prisma = this.prisma;

    if (!input.items || input.items.length === 0) {
      throw new Error('Bill of material must have at least one component');
    }

    return prisma.$transaction(async (tx) => {
      const bom = await tx.billOfMaterial.create({
        data: {
          tenantId: this.tenantId,
          productId: input.productId,
          name: input.name,
          isActive: true,
          items: {
            create: input.items.map((item) => ({
              tenantId: this.tenantId,
              componentProductId: item.componentProductId,
              uomId: item.uomId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return bom;
    });
  }

  async createProductionOrder(input: {
    bomId: string;
    locationId: string;
    quantity: Prisma.Decimal;
    scheduledAt?: Date | null;
  }) {
    const prisma = this.prisma;

    if (input.quantity.lte(0)) {
      throw new Error('Production order quantity must be positive');
    }

    return prisma.$transaction(async (tx) => {
      const bom = await tx.billOfMaterial.findFirst({
        where: { id: input.bomId, tenantId: this.tenantId },
      });

      if (!bom) {
        throw new Error('Bill of material not found');
      }

      const order = await tx.productionOrder.create({
        data: {
          tenantId: this.tenantId,
          bomId: bom.id,
          productId: bom.productId,
          locationId: input.locationId,
          quantity: input.quantity,
          status: ProductionOrderStatus.PLANNED,
          startedAt: input.scheduledAt ?? null,
        },
      });

      return order;
    });
  }

  async completeProductionOrder(id: string, userId?: string | null) {
    const prisma = this.prisma;

    const completed = await prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id, tenantId: this.tenantId },
        include: {
          bom: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error('Production order not found');
      }

      if (order.status === ProductionOrderStatus.CANCELLED) {
        throw new Error('Cannot complete a cancelled production order');
      }

      if (order.status === ProductionOrderStatus.COMPLETED) {
        throw new Error('Production order already completed');
      }

      const quantity = order.quantity as unknown as Prisma.Decimal;

      for (const item of order.bom.items) {
        const perUnitQty = item.quantity as unknown as Prisma.Decimal;
        const totalToConsume = perUnitQty.mul(quantity);

        if (totalToConsume.lte(0)) continue;

        await this.adjustStockTx(tx, {
          productId: item.componentProductId,
          locationId: order.locationId,
          uomId: item.uomId,
          quantityDelta: totalToConsume.mul(new Prisma.Decimal(-1)),
        });
      }

      await this.adjustStockTx(tx, {
        productId: order.productId,
        locationId: order.locationId,
        uomId: (await tx.product.findUnique({
          where: { id: order.productId },
          select: { defaultUomId: true },
        }))!.defaultUomId,
        quantityDelta: quantity,
      });

      const updated = await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          status: ProductionOrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'PRODUCTION_ORDER_COMPLETED',
          entityType: 'ProductionOrder',
          entityId: order.id,
          metadata: {
            bomId: order.bomId,
            productId: order.productId,
            locationId: order.locationId,
            quantity: order.quantity,
          },
        },
      });

      return updated;
    });

    return completed;
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
        throw new Error('Insufficient stock for production order');
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
      throw new Error('Insufficient stock for production order');
    }

    return tx.stockQuant.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  }
}