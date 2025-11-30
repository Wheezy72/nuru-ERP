import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class DashboardService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async getSummary() {
    const prisma = this.prisma;

    const [metrics, cashFlow, chamaTrust, stockAlerts] = await Promise.all([
      this.getMetrics(prisma),
      this.getCashFlow(prisma),
      this.getChamaTrust(prisma),
      this.getStockAlerts(prisma),
    ]);

    return {
      metrics,
      cashFlow,
      chamaTrust,
      stockAlerts,
    };
  }

  private async getMetrics(prisma: ReturnType<typeof this['prisma']>) {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const startOfTomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );

    const invoicesAgg = await prisma.invoice.aggregate({
      where: {
        tenantId: this.tenantId,
        status: { in: ['Posted', 'Paid'] },
        issueDate: {
          gte: startOfDay,
          lt: startOfTomorrow,
        },
      },
      _sum: { totalAmount: true },
    });

    const accountsAgg = await prisma.account.aggregate({
      where: { tenantId: this.tenantId },
      _sum: { balance: true },
    });

    const totalSalesTodayDecimal = invoicesAgg._sum.totalAmount ?? new Prisma.Decimal(
      0
    );
    const cashAtHandDecimal = accountsAgg._sum.balance ?? new Prisma.Decimal(0);

    return {
      totalSalesToday: Number(totalSalesTodayDecimal.toString()),
      cashAtHand: Number(cashAtHandDecimal.toString()),
    };
  }

  private async getCashFlow(prisma: ReturnType<typeof this['prisma']>) {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0
    );

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: this.tenantId,
        createdAt: {
          gte: start,
        },
      },
    });

    const days: string[] = [];
    const income: number[] = [];
    const expenses: number[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i,
        0,
        0,
        0,
        0
      );
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      days.push(label);

      const dayTx = transactions.filter((tx) => {
        const t = tx.createdAt;
        return (
          t.getFullYear() === d.getFullYear() &&
          t.getMonth() === d.getMonth() &&
          t.getDate() === d.getDate()
        );
      });

      const incomeSum = dayTx
        .filter((tx) => tx.type === 'Credit')
        .reduce(
          (acc, tx) => acc.add(tx.amount as unknown as Prisma.Decimal),
          new Prisma.Decimal(0)
        );
      const expenseSum = dayTx
        .filter((tx) => tx.type === 'Debit')
        .reduce(
          (acc, tx) => acc.add(tx.amount as unknown as Prisma.Decimal),
          new Prisma.Decimal(0)
        );

      income.push(Number(incomeSum.toString()));
      expenses.push(Number(expenseSum.toString()));
    }

    return { days, income, expenses };
  }

  private async getChamaTrust(prisma: ReturnType<typeof this['prisma']>) {
    const accountsAgg = await prisma.account.aggregate({
      where: { tenantId: this.tenantId },
      _sum: { balance: true },
    });

    const loansAgg = await prisma.loan.aggregate({
      where: {
        tenantId: this.tenantId,
        status: { in: ['Active', 'Pending'] },
      },
      _sum: { principal: true },
    });

    const potSizeDecimal = accountsAgg._sum.balance ?? new Prisma.Decimal(0);
    const loansIssuedDecimal = loansAgg._sum.principal ?? new Prisma.Decimal(0);

    return {
      potSize: Number(potSizeDecimal.toString()),
      loansIssued: Number(loansIssuedDecimal.toString()),
    };
  }

  private async getStockAlerts(prisma: ReturnType<typeof this['prisma']>) {
    const products = await prisma.product.findMany({
      where: {
        tenantId: this.tenantId,
        minStockQuantity: {
          gt: new Prisma.Decimal(0),
        },
      },
      select: {
        id: true,
        name: true,
        minStockQuantity: true,
        defaultUom: {
          select: { name: true },
        },
      },
      take: 50,
    });

    const alerts: {
      productName: string;
      quantity: number;
      minQuantity: number;
      uomName: string;
    }[] = [];

    for (const product of products) {
      const agg = await prisma.stockQuant.aggregate({
        where: {
          tenantId: this.tenantId,
          productId: product.id,
        },
        _sum: { quantity: true },
      });

      const totalQtyDecimal = agg._sum.quantity ?? new Prisma.Decimal(0);
      const minQtyDecimal =
        (product.minStockQuantity as unknown as Prisma.Decimal) ||
        new Prisma.Decimal(0);

      if (totalQtyDecimal.lt(minQtyDecimal)) {
        alerts.push({
          productName: product.name,
          quantity: Number(totalQtyDecimal.toString()),
          minQuantity: Number(minQtyDecimal.toString()),
          uomName: product.defaultUom?.name ?? '',
        });
      }
    }

    return alerts;
  }
}