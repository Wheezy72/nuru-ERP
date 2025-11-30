import { Prisma, UnitOfMeasure, StockQuant } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class InventoryService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async listProducts(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductWhereInput = {
      tenantId: this.tenantId,
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
              { category: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          defaultUom: {
            include: {
              derivedUnits: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async createProduct(input: {
    name: string;
    sku: string;
    defaultUomId: string;
    description?: string;
    category?: string;
  }) {
    const prisma = this.prisma;

    return prisma.product.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        sku: input.sku,
        defaultUomId: input.defaultUomId,
        description: input.description,
        category: input.category,
      },
    });
  }

  async adjustStock(input: {
    productId: string;
    locationId: string;
    batchId?: string | null;
    uomId: string;
    quantityDelta: Prisma.Decimal;
  }) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.stockQuant.findUnique({
        where: {
          tenantId_productId_locationId_batchId_uomId: {
            tenantId: this.tenantId,
            productId: input.productId,
            locationId: input.locationId,
            batchId: input.batchId ?? null,
            uomId: input.uomId,
          },
        },
      });

      if (!existing) {
        // Disallow going negative from an implicit zero balance
        if ((input.quantityDelta as unknown as Prisma.Decimal).lt(0)) {
          throw new Error('Insufficient stock');
        }

        return tx.stockQuant.create({
          data: {
            tenantId: this.tenantId,
            productId: input.productId,
            locationId: input.locationId,
            batchId: input.batchId ?? null,
            uomId: input.uomId,
            quantity: input.quantityDelta,
          },
        });
      }

      const newQty = (existing.quantity as unknown as Prisma.Decimal).add(
        input.quantityDelta
      );

      if (newQty.lt(0)) {
        throw new Error('Insufficient stock');
      }

      return tx.stockQuant.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    });
  }

  /**
   * Break bulk: convert quantity from a parent (larger) UoM into a child (smaller) UoM.
   *
   * Example:
   *  - Product default UoM: "Box of 12" (baseUnitId -> "Unit", ratio = 12)
   *  - breakBulk(productId, 1, targetUomId = "Unit") will:
   *      - decrement 1 Box from stock
   *      - increment 12 Units to stock
   */
  async breakBulk(params: {
    productId: string;
    locationId: string;
    batchId?: string | null;
    sourceUomId: string;
    targetUomId: string;
    sourceQuantity: Prisma.Decimal;
  }): Promise<{ from: StockQuant; to: StockQuant }> {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const [sourceUom, targetUom] = await Promise.all([
        tx.unitOfMeasure.findFirst({
          where: { id: params.sourceUomId, tenantId: this.tenantId },
        }),
        tx.unitOfMeasure.findFirst({
          where: { id: params.targetUomId, tenantId: this.tenantId },
        }),
      ]);

      if (!sourceUom || !targetUom) {
        throw new Error('Invalid source or target unit of measure for this tenant');
      }

      const conversionFactor = await this.getConversionFactor(
        tx,
        sourceUom,
        targetUom
      );

      if (conversionFactor.lte(0)) {
        throw new Error('Invalid conversion factor between units of measure');
      }

      const qtyToAdd = params.sourceQuantity.mul(conversionFactor);

      const fromQuant = await this.adjustStockTx(tx, {
        productId: params.productId,
        locationId: params.locationId,
        batchId: params.batchId ?? null,
        uomId: params.sourceUomId,
        quantityDelta: params.sourceQuantity.mul(new Prisma.Decimal(-1)),
      });

      const toQuant = await this.adjustStockTx(tx, {
        productId: params.productId,
        locationId: params.locationId,
        batchId: params.batchId ?? null,
        uomId: params.targetUomId,
        quantityDelta: qtyToAdd,
      });

      return { from: fromQuant, to: toQuant };
    });
  }

  private async adjustStockTx(
    tx: Prisma.TransactionClient,
    input: {
      productId: string;
      locationId: string;
      batchId?: string | null;
      uomId: string;
      quantityDelta: Prisma.Decimal;
    }
  ) {
    const existing = await tx.stockQuant.findUnique({
      where: {
        tenantId_productId_locationId_batchId_uomId: {
          tenantId: this.tenantId,
          productId: input.productId,
          locationId: input.locationId,
          batchId: input.batchId ?? null,
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
          batchId: input.batchId ?? null,
          uomId: input.uomId,
          quantity: input.quantityDelta,
        },
      });
    }

    const newQty = (existing.quantity as unknown as Prisma.Decimal).add(
      input.quantityDelta
    );

    return tx.stockQuant.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  }

  /**
   * Compute conversion factor from source to target UoM by traversing
   * the recursive tree via baseUnit relations.
   */
  private async getConversionFactor(
    tx: Prisma.TransactionClient,
    source: UnitOfMeasure,
    target: UnitOfMeasure
  ): Promise<Prisma.Decimal> {
    if (source.id === target.id) {
      return new Prisma.Decimal(1);
    }

    const pathToRoot = async (unit: UnitOfMeasure) => {
      const path: UnitOfMeasure[] = [];
      let current: UnitOfMeasure | null = unit;

      while (current) {
        path.push(current);
        if (!current.baseUnitId) break;
        current = await tx.unitOfMeasure.findUnique({
          where: { id: current.baseUnitId },
        });
      }

      return path;
    };

    const [sourcePath, targetPath] = await Promise.all([
      pathToRoot(source),
      pathToRoot(target),
    ]);

    const sourceRoot = sourcePath[sourcePath.length - 1];
    const targetRoot = targetPath[targetPath.length - 1];

    if (!sourceRoot || !targetRoot || sourceRoot.id !== targetRoot.id) {
      throw new Error('Units of measure are in different trees and cannot be converted');
    }

    const factorToRoot = (path: UnitOfMeasure[]) => {
      return path.reduce((acc, u, index) => {
        if (index === 0) return new Prisma.Decimal(1);
        return acc.mul(u.ratio);
      }, new Prisma.Decimal(1));
    };

    const sourceToRoot = factorToRoot(sourcePath);
    const targetToRoot = factorToRoot(targetPath);

    // sourceQty * (sourceToRoot / targetToRoot) = targetQty
    return sourceToRoot.div(targetToRoot);
  }
}