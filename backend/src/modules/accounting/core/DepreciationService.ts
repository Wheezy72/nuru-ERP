import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';
import { AccountingService } from './AccountingService';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

export class DepreciationService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  async listAssets() {
    const prisma = this.prisma;
    const assets = await prisma.asset.findMany({
      where: { tenantId: this.tenantId },
      orderBy: { purchaseDate: 'asc' },
    });

    return assets.map((asset) => {
      const cost = asset.purchaseCost as unknown as Prisma.Decimal;
      const accum =
        (asset.accumulatedDepreciation as unknown as Prisma.Decimal) ||
        new Prisma.Decimal(0);
      const net = cost.sub(accum);
      return {
        ...asset,
        netBookValue: Number(net.toString()),
      };
    });
  }

  async listRuns() {
    const prisma = this.prisma;
    return prisma.depreciationRun.findMany({
      where: { tenantId: this.tenantId },
      orderBy: { period: 'desc' },
    });
  }

  /**
   * Run straight-line depreciation for a given period (YYYY-MM).
   * Creates a GL journal:
   *   DR Depreciation Expense
   *   CR Accumulated Depreciation
   * Updates Asset.accumulatedDepreciation and records a DepreciationRun.
   */
  async runPeriod(period: string, userId?: string | null) {
    if (!/^[0-9]{4}-[0-9]{2}$/.test(period)) {
      throw new Error('Period must be in format YYYY-MM');
    }

    const [yearStr, monthStr] = period.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr); // 1-12

    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      throw new Error('Invalid period value');
    }

    const periodEnd = new Date(year, month, 0); // last day of month

    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.depreciationRun.findFirst({
        where: {
          tenantId: this.tenantId,
          period,
        },
      });

      if (existing) {
        throw new Error(`Depreciation already run for period ${period}`);
      }

      const assets = await tx.asset.findMany({
        where: { tenantId: this.tenantId },
      });

      if (assets.length === 0) {
        // Still record an empty run to avoid confusion later
        const run = await tx.depreciationRun.create({
          data: {
            tenantId: this.tenantId,
            period,
          },
        });
        return { totalDepreciation: 0, run };
      }

      const updates: { id: string; amount: Prisma.Decimal }[] = [];
      let totalDep = new Prisma.Decimal(0);

      for (const asset of assets) {
        const cost = asset.purchaseCost as unknown as Prisma.Decimal;
        const salvage = asset.salvageValue as unknown as Prisma.Decimal;
        const accum =
          (asset.accumulatedDepreciation as unknown as Prisma.Decimal) ||
          new Prisma.Decimal(0);

        const depreciableBase = cost.sub(salvage);
        if (depreciableBase.lte(0)) {
          continue;
        }

        const remaining = depreciableBase.sub(accum);
        if (remaining.lte(0)) {
          continue;
        }

        const monthsTotal = new Prisma.Decimal(asset.lifespanYears * 12);
        if (monthsTotal.lte(0)) {
          continue;
        }

        let monthly = depreciableBase.div(monthsTotal);
        if (monthly.lte(0)) {
          continue;
        }

        if (monthly.gt(remaining)) {
          monthly = remaining;
        }

        if (monthly.lte(0)) {
          continue;
        }

        updates.push({ id: asset.id, amount: monthly });
        totalDep = totalDep.add(monthly);
      }

      if (totalDep.lte(0)) {
        const run = await tx.depreciationRun.create({
          data: {
            tenantId: this.tenantId,
            period,
          },
        });
        return { totalDepreciation: 0, run };
      }

      // Post GL entry for depreciation
      const accounting = new AccountingService(this.tenantId);
      const accounts = await accounting.ensureDefaultAccounts(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx as any,
      );

      await tx.gLJournalEntry.create({
        data: {
          tenantId: this.tenantId,
          date: periodEnd,
          description: `Depreciation for period ${period}`,
          lines: {
            create: [
              {
                tenantId: this.tenantId,
                accountId: accounts.depreciationExpense.id,
                debit: totalDep,
                credit: new Prisma.Decimal(0),
              },
              {
                tenantId: this.tenantId,
                accountId: accounts.accumulatedDepreciation.id,
                debit: new Prisma.Decimal(0),
                credit: totalDep,
              },
            ],
          },
        },
      });

      // Update assets
      for (const upd of updates) {
        await tx.asset.update({
          where: { id: upd.id },
          data: {
            accumulatedDepreciation: (
              await tx.asset.findUniqueOrThrow({ where: { id: upd.id } })
            ).accumulatedDepreciation
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .add(upd.amount as any),
          },
        });
      }

      const run = await tx.depreciationRun.create({
        data: {
          tenantId: this.tenantId,
          period,
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'DEPRECIATION_RUN',
          entityType: 'Depreciation',
          entityId: period,
          metadata: {
            period,
            totalDepreciation: totalDep,
          },
        },
      });

      return {
        totalDepreciation: Number(totalDep.toString()),
        run,
      };
    });
  }
}