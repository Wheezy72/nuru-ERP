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
      case 'TOBACCO_COUNTER':
        return this.applyTobaccoCounter();
      case 'MICRO_SNACKS':
        return this.applyMicroSnacks();
      case 'GAME_LOUNGE':
        return this.applyGameLounge();
      case 'DIGITAL_CONTENT':
        return this.applyDigitalContent();
      case 'LIQUOR_SHELF':
        return this.applyLiquorShelf();
      default:
        return;
    }
  }

  private async applyTobaccoCounter() {
    const prisma = this.prisma;
    const location = await this.getOrCreateDefaultLocation();

    const packet = await this.getOrCreateUnitOfMeasure({
      name: 'Packet',
      category: 'Unit',
      ratio: 1,
    });

    const stick = await this.getOrCreateUnitOfMeasure({
      name: 'Stick',
      category: 'Unit',
      ratio: 20, // 1 Packet = 20 Sticks
      baseUnitName: 'Packet',
    });

    const sportsman = await this.getOrCreateProduct({
      sku: 'TOB-SPORTS-20',
      name: 'Sportsman (Packet)',
      defaultUomId: packet.id,
      category: 'Tobacco',
      minStockQuantity: 10,
    });

    await this.ensureStockQuant({
      productId: sportsman.id,
      locationId: location.id,
      uomId: packet.id,
      quantity: 200,
    });

    // Ensure stick exists primarily for break-bulk; no stock seeded at stick level.
    void stick;
  }

  private async applyMicroSnacks() {
    const prisma = this.prisma;
    const location = await this.getOrCreateDefaultLocation();

    const packet = await this.getOrCreateUnitOfMeasure({
      name: 'Packet',
      category: 'Unit',
      ratio: 1,
    });

    const piece = await this.getOrCreateUnitOfMeasure({
      name: 'Piece',
      category: 'Unit',
      ratio: 1,
    });

    const peanuts = await this.getOrCreateProduct({
      sku: 'SNK-PEANUT-10',
      name: 'Peanuts (10 Bob Pkt)',
      defaultUomId: packet.id,
      category: 'Snacks',
      minStockQuantity: 20,
    });

    const smokie = await this.getOrCreateProduct({
      sku: 'SNK-SMOKIE-1',
      name: 'Smokie (Piece)',
      defaultUomId: piece.id,
      category: 'Snacks',
      minStockQuantity: 20,
    });

    await this.ensureStockQuant({
      productId: peanuts.id,
      locationId: location.id,
      uomId: packet.id,
      quantity: 100,
    });

    await this.ensureStockQuant({
      productId: smokie.id,
      locationId: location.id,
      uomId: piece.id,
      quantity: 200,
    });
  }

  private async applyGameLounge() {
    const prisma = this.prisma;
    const location = await this.getOrCreateDefaultLocation();

    const minute = await this.getOrCreateUnitOfMeasure({
      name: 'Minute',
      category: 'Time',
      ratio: 1,
    });

    const fifa = await this.getOrCreateProduct({
      sku: 'GL-FIFA-10',
      name: 'FIFA Game (10 Mins)',
      defaultUomId: minute.id,
      category: 'Service',
      minStockQuantity: 0,
    });

    // Services are treated as effectively infinite stock to avoid stock errors.
    await this.ensureStockQuant({
      productId: fifa.id,
      locationId: location.id,
      uomId: minute.id,
      quantity: 100000,
    });
  }

  private async applyDigitalContent() {
    const prisma = this.prisma;
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

    const movieTransfer = await this.getOrCreateProduct({
      sku: 'DC-MOVIE-GB',
      name: 'Movie Transfer (Per GB)',
      defaultUomId: gb.id,
      category: 'Digital',
      minStockQuantity: 0,
    });

    const fullSeries = await this.getOrCreateProduct({
      sku: 'DC-SERIES-FULL',
      name: 'Full Series',
      defaultUomId: service.id,
      category: 'Digital',
      minStockQuantity: 0,
    });

    await this.ensureStockQuant({
      productId: movieTransfer.id,
      locationId: location.id,
      uomId: gb.id,
      quantity: 100000,
    });

    await this.ensureStockQuant({
      productId: fullSeries.id,
      locationId: location.id,
      uomId: service.id,
      quantity: 100000,
    });
  }

  private async applyLiquorShelf() {
    const prisma = this.prisma;
    const location = await this.getOrCreateDefaultLocation();

    const bottle250 = await this.getOrCreateUnitOfMeasure({
      name: 'Bottle 250ml',
      category: 'Volume',
      ratio: 1,
    });

    const bottle500 = await this.getOrCreateUnitOfMeasure({
      name: 'Bottle 500ml',
      category: 'Volume',
      ratio: 1,
    });

    const tot = await this.getOrCreateUnitOfMeasure({
      name: 'Tot',
      category: 'Volume',
      ratio: 4, // 1 Bottle = 4 Tots
      baseUnitName: 'Bottle 250ml',
    });

    const chrome = await this.getOrCreateProduct({
      sku: 'LQ-CHROME-250',
      name: 'Chrome Vodka 250ml',
      defaultUomId: bottle250.id,
      category: 'Liquor',
      minStockQuantity: 6,
    });

    const tusker = await this.getOrCreateProduct({
      sku: 'LQ-TUSKER-500',
      name: 'Tusker Lager',
      defaultUomId: bottle500.id,
      category: 'Beer',
      minStockQuantity: 12,
    });

    await this.ensureStockQuant({
      productId: chrome.id,
      locationId: location.id,
      uomId: bottle250.id,
      quantity: 24,
    });

    await this.ensureStockQuant({
      productId: tusker.id,
      locationId: location.id,
      uomId: bottle500.id,
      quantity: 48,
    });

    void tot;
  }
}