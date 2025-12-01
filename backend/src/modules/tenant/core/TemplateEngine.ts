import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';
import {
  BASE_TEMPLATES,
  FEATURE_BLOCKS,
  type BusinessBaseTypeId,
  type FeatureBlockId,
} from '../../../config/templates';

export class TemplateEngine {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async getMeta() {
    return {
      baseTemplates: BASE_TEMPLATES,
      featureBlocks: FEATURE_BLOCKS,
    };
  }

  async applyTemplate(input: {
    baseType?: BusinessBaseTypeId | string;
    blocks: FeatureBlockId[];
  }) {
    const prisma = this.prisma;

    // Normalise and dedupe blocks
    const validBlocks = FEATURE_BLOCKS.map((b) => b.id);
    const blocks = Array.from(
      new Set(input.blocks.filter((b) => validBlocks.includes(b)))
    ) as FeatureBlockId[];

    const tenant = await prisma.tenant.findFirst({
      where: { id: this.tenantId },
      select: { features: true },
    });

    const existingFeatures = (tenant?.features || {}) as any;
    const existingTemplate = (existingFeatures.template || {}) as any;

    const currentBlocks: FeatureBlockId[] = Array.isArray(
      existingTemplate.blocks
    )
      ? existingTemplate.blocks
      : [];

    const mergedBlocks = Array.from(
      new Set([...currentBlocks, ...blocks])
    ) as FeatureBlockId[];

    const newTemplate = {
      baseType: (input.baseType ||
        existingTemplate.baseType ||
        'GENERIC') as string,
      blocks: mergedBlocks,
    };

    await prisma.tenant.update({
      where: { id: this.tenantId },
      data: {
        features: {
          ...(existingFeatures || {}),
          template: newTemplate,
        },
      } as any,
    });

    // Apply data changes for each selected block
    for (const block of blocks) {
      // eslint-disable-next-line no-await-in-loop
      await this.applyBlock(block);
    }
  }

  private async getOrCreateDefaultLocation() {
    const prisma = this.prisma;

    const existing = await prisma.location.findFirst({
      where: { tenantId: this.tenantId },
    });

    if (existing) return existing;

    return prisma.location.create({
      data: {
        tenantId: this.tenantId,
        name: 'Main Shop',
        code: 'MAIN',
        isActive: true,
      },
    });
  }

  private async getOrCreateUnitOfMeasure(params: {
    name: string;
    category: string;
    ratio: number;
    baseUnitName?: string;
  }) {
    const prisma = this.prisma;
    const existing = await prisma.unitOfMeasure.findFirst({
      where: {
        tenantId: this.tenantId,
        name: params.name,
      },
    });
    if (existing) return existing;

    let baseUnitId: string | undefined;
    if (params.baseUnitName) {
      const baseExisting = await prisma.unitOfMeasure.findFirst({
        where: {
          tenantId: this.tenantId,
          name: params.baseUnitName,
        },
      });
      if (baseExisting) {
        baseUnitId = baseExisting.id;
      }
    }

    return prisma.unitOfMeasure.create({
      data: {
        tenantId: this.tenantId,
        name: params.name,
        category: params.category,
        ratio: new Prisma.Decimal(params.ratio),
        baseUnitId,
      },
    });
  }

  private async getOrCreateProduct(params: {
    sku: string;
    name: string;
    category?: string;
    defaultUomId: string;
    minStockQuantity?: number;
  }) {
    const prisma = this.prisma;
    const existing = await prisma.product.findFirst({
      where: {
        tenantId: this.tenantId,
        sku: params.sku,
      },
    });
    if (existing) return existing;

    return prisma.product.create({
      data: {
        tenantId: this.tenantId,
        name: params.name,
        sku: params.sku,
        defaultUomId: params.defaultUomId,
        category: params.category,
        minStockQuantity:
          typeof params.minStockQuantity === 'number'
            ? new Prisma.Decimal(params.minStockQuantity)
            : new Prisma.Decimal(0),
      },
    });
  }

  private async ensureStockQuant(params: {
    productId: string;
    locationId: string;
    uomId: string;
    quantity: number;
  }) {
    const prisma = this.prisma;
    const existing = await prisma.stockQuant.findFirst({
      where: {
        tenantId: this.tenantId,
        productId: params.productId,
        locationId: params.locationId,
        uomId: params.uomId,
      },
    });
    if (existing) return existing;

    return prisma.stockQuant.create({
      data: {
        tenantId: this.tenantId,
        productId: params.productId,
        locationId: params.locationId,
        uomId: params.uomId,
        quantity: new Prisma.Decimal(params.quantity),
      },
    });
  }

  private async applyBlock(block: FeatureBlockId) {
    switch (block) {
      case 'SINGLES_COUNTER':
        return this.applySinglesCounter();
      case 'SNACK_BAR':
        return this.applySnackBar();
      case 'GAME_SESSION':
        return this.applyGameSession();
      case 'DIGITAL_SERVICE':
        return this.applyDigitalService();
      case 'BEVERAGE_SHELF':
        return this.applyBeverageShelf();
      default:
        return;
    }
  }

  private async applySinglesCounter() {
    const location = await this.getOrCreateDefaultLocation();

    const bundle = await this.getOrCreateUnitOfMeasure({
      name: 'Bundle',
      category: 'Unit',
      ratio: 1,
    });

    const single = await this.getOrCreateUnitOfMeasure({
      name: 'Single Item',
      category: 'Unit',
      ratio: 20, // 1 Bundle = 20 Singles (example)
      baseUnitName: 'Bundle',
    });

    const bundledItem = await this.getOrCreateProduct({
      sku: 'SN-BUNDLE-20',
      name: 'Bundled Item (Pack)',
      defaultUomId: bundle.id,
      category: 'Singles',
      minStockQuantity: 10,
    });

    await this.ensureStockQuant({
      productId: bundledItem.id,
      locationId: location.id,
      uomId: bundle.id,
      quantity: 200,
    });

    void single;
  }

  private async applySnackBar() {
    const location = await this.getOrCreateDefaultLocation();

    const pack = await this.getOrCreateUnitOfMeasure({
      name: 'Pack',
      category: 'Unit',
      ratio: 1,
    });

    const unit = await this.getOrCreateUnitOfMeasure({
      name: 'Unit',
      category: 'Unit',
      ratio: 1,
    });

    const snackPack = await this.getOrCreateProduct({
      sku: 'SNACK-PACK-SM',
      name: 'Snack Pack (Small)',
      defaultUomId: pack.id,
      category: 'Snacks',
      minStockQuantity: 20,
    });

    const snackUnit = await this.getOrCreateProduct({
      sku: 'SNACK-UNIT-1',
      name: 'Snack Item (Unit)',
      defaultUomId: unit.id,
      category: 'Snacks',
      minStockQuantity: 20,
    });

    await this.ensureStockQuant({
      productId: snackPack.id,
      locationId: location.id,
      uomId: pack.id,
      quantity: 100,
    });

    await this.ensureStockQuant({
      productId: snackUnit.id,
      locationId: location.id,
      uomId: unit.id,
      quantity: 200,
    });
  }

  private async applyGameSession() {
    const location = await this.getOrCreateDefaultLocation();

    const minute = await this.getOrCreateUnitOfMeasure({
      name: 'Minute',
      category: 'Time',
      ratio: 1,
    });

    const gameSession = await this.getOrCreateProduct({
      sku: 'SRV-GAME-10',
      name: 'Game Session (10 Mins)',
      defaultUomId: minute.id,
      category: 'Service',
      minStockQuantity: 0,
    });

    await this.ensureStockQuant({
      productId: gameSession.id,
      locationId: location.id,
      uomId: minute.id,
      quantity: 100000,
    });
  }

  private async applyDigitalService() {
    const location = await this.getOrCreateDefaultLocation();

    const gb = await this.getOrCreateUnitOfMeasure({
      name: 'GB',
      category: 'Digital',
      ratio: 1,
    });

    const service = await this.getOrCreateUnitOfMeasure({
      name: 'Service',
      category: 'Service',
      ratio: 1,
    });

    const dataTransfer = await this.getOrCreateProduct({
      sku: 'SRV-DATA-GB',
      name: 'Data Transfer (Per GB)',
      defaultUomId: gb.id,
      category: 'Digital',
      minStockQuantity: 0,
    });

    const contentBundle = await this.getOrCreateProduct({
      sku: 'SRV-CONTENT-BUNDLE',
      name: 'Content Bundle',
      defaultUomId: service.id,
      category: 'Digital',
      minStockQuantity: 0,
    });

    await this.ensureStockQuant({
      productId: dataTransfer.id,
      locationId: location.id,
      uomId: gb.id,
      quantity: 100000,
    });

    await this.ensureStockQuant({
      productId: contentBundle.id,
      locationId: location.id,
      uomId: service.id,
      quantity: 100000,
    });
  }

  private async applyBeverageShelf() {
    const location = await this.getOrCreateDefaultLocation();

    const smallBottle = await this.getOrCreateUnitOfMeasure({
      name: 'Bottle 250ml',
      category: 'Volume',
      ratio: 1,
    });

    const largeBottle = await this.getOrCreateUnitOfMeasure({
      name: 'Bottle 500ml',
      category: 'Volume',
      ratio: 1,
    });

    const pour = await this.getOrCreateUnitOfMeasure({
      name: 'Pour',
      category: 'Volume',
      ratio: 4, // 1 small bottle = 4 pours (example)
      baseUnitName: 'Bottle 250ml',
    });

    const premiumBeverage = await this.getOrCreateProduct({
      sku: 'BEV-PREMIUM-250',
      name: 'Premium Beverage 250ml',
      defaultUomId: smallBottle.id,
      category: 'Beverage',
      minStockQuantity: 6,
    });

    const standardBeer = await this.getOrCreateProduct({
      sku: 'BEV-STANDARD-500',
      name: 'Standard Beverage 500ml',
      defaultUomId: largeBottle.id,
      category: 'Beverage',
      minStockQuantity: 12,
    });

    await this.ensureStockQuant({
      productId: premiumBeverage.id,
      locationId: location.id,
      uomId: smallBottle.id,
      quantity: 24,
    });

    await this.ensureStockQuant({
      productId: standardBeer.id,
      locationId: location.id,
      uomId: largeBottle.id,
      quantity: 48,
    });

    void pour;
  }
}