import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

export class ImportService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  async importCustomers(params: {
    rows: Record<string, unknown>[];
    dryRun?: boolean;
  }) {
    const prisma = this.prisma;
    const dryRun = params.dryRun ?? false;
    const rows = params.rows;

    const result = {
      total: rows.length,
      created: 0,
      updated: 0,
      errors: [] as { index: number; message: string }[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const name = String(row.name ?? row.Name ?? '').trim();
      const phone = String(row.phone ?? row.Phone ?? '').trim() || null;
      const email =
        (row.email ?? row.Email) != null
          ? String(row.email ?? row.Email).trim() || null
          : null;
      const kraPin =
        (row.kraPin ?? row.KRAPIN ?? row.kra_pin) != null
          ? String(row.kraPin ?? row.KRAPIN ?? row.kra_pin).trim() || null
          : null;

      if (!name) {
        result.errors.push({
          index: i,
          message: 'Missing name',
        });
        continue;
      }

      if (!phone && !email) {
        result.errors.push({
          index: i,
          message: 'At least one of phone or email is required',
        });
        continue;
      }

      if (dryRun) {
        continue;
      }

      const existing = await prisma.customer.findFirst({
        where: {
          tenantId: this.tenantId,
          OR: [
            email ? { email } : undefined,
            phone ? { phone } : undefined,
          ].filter(Boolean) as any,
        },
      });

      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name,
            phone,
            email,
            kraPin,
          },
        });
        result.updated += 1;
      } else {
        await prisma.customer.create({
          data: {
            tenantId: this.tenantId,
            name,
            phone,
            email,
            kraPin,
          },
        });
        result.created += 1;
      }
    }

    return result;
  }

  async importProducts(params: {
    rows: Record<string, unknown>[];
    dryRun?: boolean;
  }) {
    const prisma = this.prisma;
    const dryRun = params.dryRun ?? false;
    const rows = params.rows;

    const result = {
      total: rows.length,
      created: 0,
      updated: 0,
      errors: [] as { index: number; message: string }[],
    };

    // Preload UoMs for quick lookup by name
    const uoms = await prisma.unitOfMeasure.findMany({
      where: { tenantId: this.tenantId },
    });
    const uomByName = uoms.reduce<Record<string, string>>((acc, u) => {
      acc[u.name.toLowerCase()] = u.id;
      return acc;
    }, {});

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const name = String(row.name ?? row.Name ?? '').trim();
      const sku = String(row.sku ?? row.SKU ?? '').trim();
      const category =
        (row.category ?? row.Category) != null
          ? String(row.category ?? row.Category).trim() || null
          : null;
      const defaultUomName =
        (row.defaultUom ?? row['default uom'] ?? row.uom ?? row.UOM) != null
          ? String(
              row.defaultUom ?? row['default uom'] ?? row.uom ?? row.UOM,
            ).trim()
          : '';
      const defaultPriceRaw =
        row.defaultPrice ??
        row.price ??
        row.Price ??
        row['default price'] ??
        row['unit price'];
      const minStockRaw =
        row.minStockQuantity ??
        row['min stock'] ??
        row['min_stock'] ??
        row.MinStockQuantity;

      if (!name || !sku) {
        result.errors.push({
          index: i,
          message: 'Missing name or SKU',
        });
        continue;
      }

      let defaultUomId: string | null = null;
      if (defaultUomName) {
        const key = defaultUomName.toLowerCase();
        defaultUomId = uomByName[key] ?? null;
      }

      if (!defaultUomId) {
        result.errors.push({
          index: i,
          message: `Unknown default UoM: "${defaultUomName}"`,
        });
        continue;
      }

      const defaultPrice = defaultPriceRaw
        ? new Prisma.Decimal(
            Number(String(defaultPriceRaw).replace(/[^\d.-]/g, '')) || 0,
          )
        : new Prisma.Decimal(0);

      const minStock = minStockRaw
        ? new Prisma.Decimal(
            Number(String(minStockRaw).replace(/[^\d.-]/g, '')) || 0,
          )
        : new Prisma.Decimal(0);

      if (dryRun) {
        continue;
      }

      const existing = await prisma.product.findFirst({
        where: {
          tenantId: this.tenantId,
          OR: [{ sku }, { name }],
        },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name,
            sku,
            category,
            defaultUomId,
            defaultPrice,
            minStockQuantity: minStock,
          },
        });
        result.updated += 1;
      } else {
        await prisma.product.create({
          data: {
            tenantId: this.tenantId,
            name,
            sku,
            category,
            defaultUomId,
            defaultPrice,
            minStockQuantity: minStock,
          },
        });
        result.created += 1;
      }
    }

    return result;
  }
}