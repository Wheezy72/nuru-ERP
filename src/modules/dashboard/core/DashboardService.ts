import { Prisma, TaxRate } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type DateRange = {
  startDate?: Date;
  endDate?: Date;
};

export class DashboardService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async getSummary(range: DateRange) {
    const prisma = this.prisma;

    const [
      metrics,
      cashFlow,
      chamaTrust,
      stockAlerts,
      insights,
      taxLiability,
    ] = await Promise.all([
      this.getMetrics(prisma, range),
      this.getCashFlow(prisma, range),
      this.getChamaTrust(prisma),
      this.getStockAlerts(prisma),
      this.getSmartInsights(prisma),
      this.getTaxLiability(prisma, range),
    ]);

    return {
      metrics,
     
  private async getMetrics(
    prisma: ReturnType<typeof this['prisma']>,
    range: DateRange
  ) {
    let start: Date;
    let end: Date;

    if (range.startDate && range.endDate) {
      start = range.startDate;
      end = range.endDate;
    } else {
      const now = new Date();
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0
      );
    }

    const invoicesAgg = await prisma.invoice.aggregate({
      where: {
        tenantId: this.tenantId,
        status: { in: ['Posted', 'Paid'] },
        issueDate: {
          gte: start,
          lt: end,
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

  private async getCashFlow(
    prisma: ReturnType<typeof this['prisma']>,
    range: DateRange
  ) {
    let start: Date;
    let end: Date;

    if (range.startDate && range.endDate) {
      start = range.startDate;
      end = range.endDate;
    } else {
      const now = new Date();
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6,
        0,
        0,
        0,
        0
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0
      );
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: this.tenantId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });

    const days: string[] = [];
    const income: number[] = [];
    const expenses: number[] = [];

    const dayCount =
      Math.max(
        1,
        Math.min(
          31,
          Math.ceil(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      );

    for (let i = 0; i < dayCount; i++) {
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

  /**
   * Compute VAT/tax liability for the selected period.
   * This is the backbone for an eTIMS-style \"Regulator View\".
   */
  private async getTaxLiability(
    prisma: ReturnType<typeof this['prisma']>,
    range: DateRange
  ) {
    let start: Date;
    let end: Date;

    if (range.startDate && range.endDate) {
      start = range.startDate;
      end = range.endDate;
    } else {
      const now = new Date();
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0
      );
    }

    const items = await prisma.invoiceItem.findMany({
      where: {
        tenantId: this.tenantId,
        invoice: {
          tenantId: this.tenantId,
          status: { in: ['Posted', 'Paid'] },
          issueDate: {
            gte: start,
            lt: end,
          },
        },
      },
      select: {
        lineTotal: true,
        taxRate: true,
      },
    });

    const breakdown = {
      vat16: {
        taxable: new Prisma.Decimal(0),
        tax: new Prisma.Decimal(0),
      },
      vat8: {
        taxable: new Prisma.Decimal(0),
        tax: new Prisma.Decimal(0),
      },
      exempt: {
        amount: new Prisma.Decimal(0),
      },
      zeroRated: {
        amount: new Prisma.Decimal(0),
      },
      totalTax: new Prisma.Decimal(0),
    };

    const rateFor = (rate: TaxRate) => {
      switch (rate) {
        case 'VAT_16':
          return new Prisma.Decimal(0.16);
        case 'VAT_8':
          return new Prisma.Decimal(0.08);
        case 'EXEMPT':
        case 'ZERO':
        default:
          return new Prisma.Decimal(0);
      }
    };

    for (const item of items) {
      const amount = item.lineTotal as unknown as Prisma.Decimal;
      const rate = item.taxRate as TaxRate;
      const r = rateFor(rate);
      const tax = amount.mul(r);

      if (rate === 'VAT_16') {
        breakdown.vat16.taxable = breakdown.vat16.taxable.add(amount);
        breakdown.vat16.tax = breakdown.vat16.tax.add(tax);
      } else if (rate === 'VAT_8') {
        breakdown.vat8.taxable = breakdown.vat8.taxable.add(amount);
        breakdown.vat8.tax = breakdown.vat8.tax.add(tax);
      } else if (rate === 'EXEMPT') {
        breakdown.exempt.amount = breakdown.exempt.amount.add(amount);
      } else if (rate === 'ZERO') {
        breakdown.zeroRated.amount = breakdown.zeroRated.amount.add(amount);
      }

      breakdown.totalTax = breakdown.totalTax.add(tax);
    }

    return {
      totalTax: Number(breakdown.totalTax.toString()),
      vat16: {
        taxable: Number(breakdown.vat16.taxable.toString()),
        tax: Number(breakdown.vat16.tax.toString()),
      },
      vat8: {
        taxable: Number(breakdown.vat8.taxable.toString()),
        tax: Number(breakdown.vat8.tax.toString()),
      },
      exempt: {
        amount: Number(breakdown.exempt.amount.toString()),
      },
      zeroRated: {
        amount: Number(breakdown.zeroRated.amount.toString()),
      },
    };
  }

  /**
   * Smart AI-like heuristics for actionable insights.
   * - Churn risk: customers with no purchases in last 30 days.
   * - Stockout prediction: items likely to run out soon based on average daily sales.
   * - Dead stock: items with high stock and no sales in 60 days.
   */
  private async getSmartInsights(prisma: ReturnType<typeof this['prisma']>) {
    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
      0,
      0,
      0,
      0
    );
    const sixtyDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 60,
      0,
      0,
      0,
      0
    );
    const ninetyDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 90,
      0,
      0,
      0,
      0
    );

    const [churnRisks, stockoutRisks, deadStock] = await Promise.all([
      this.getChurnRisk(prisma, thirtyDaysAgo),
      this.getStockoutPrediction(prisma, ninetyDaysAgo),
      this.getDeadStock(prisma, sixtyDaysAgo),
    ]);

    const insights: {
      type: 'RISK' | 'WARNING' | 'OPPORTUNITY';
      title: string;
      detail: string;
    }[] = [];

    if (churnRisks.length > 0) {
      const top = churnRisks[0];
      insights.push({
        type: 'RISK',
        title: 'Churn Risk',
        detail: `Customer ${top.name} is at risk of churn (last purchase over 30 days ago).`,
      });
    }

    if (stockoutRisks.length > 0) {
      const top = stockoutRisks[0];
      insights.push({
        type: 'WARNING',
        title: 'Stockout Prediction',
        detail: `${top.productName} may run out in approximately ${top.daysUntilStockout} day(s).`,
      });
    }

    if (deadStock.length > 0) {
      const top = deadStock[0];
      insights.push({
        type: 'OPPORTUNITY',
        title: 'Dead Stock',
        detail: `Consider discounting or promoting ${top.productName} to release cash tied up in slow-moving stock.`,
      });
    }

    return insights.slice(0, 3);
  }

  private async getChurnRisk(
    prisma: ReturnType<typeof this['prisma']>,
    cutoff: Date
  ) {
    const customers = await prisma.customer.findMany({
      where: { tenantId: this.tenantId },
      select: {
        id: true,
        name: true,
        invoices: {
          where: {
            tenantId: this.tenantId,
            status: { in: ['Posted', 'Paid'] },
          },
          select: {
            issueDate: true,
          },
          orderBy: { issueDate: 'desc' },
          take: 1,
        },
      },
    });

    const risks: { id: string; name: string; lastPurchase?: Date }[] = [];

    for (const c of customers) {
      const lastInvoice = c.invoices[0];
      if (!lastInvoice) {
        continue;
      }
      if (lastInvoice.issueDate < cutoff) {
        risks.push({
          id: c.id,
          name: c.name,
          lastPurchase: lastInvoice.issueDate,
        });
      }
    }

    risks.sort((a, b) => {
      if (!a.lastPurchase || !b.lastPurchase) return 0;
      return a.lastPurchase.getTime() - b.lastPurchase.getTime();
    });

    return risks;
  }

  private async getStockoutPrediction(
    prisma: ReturnType<typeof this['prisma']>,
    historyStart: Date
  ) {
    const now = new Date();

    const items = await prisma.invoiceItem.findMany({
      where: {
        tenantId: this.tenantId,
        invoice: {
          status: { in: ['Posted', 'Paid'] },
          issueDate: { gte: historyStart, lte: now },
        },
      },
      select: {
        productId: true,
        quantity: true,
        invoice: { select: { issueDate: true } },
        product: { select: { name: true } },
      },
    });

    const productMap: Record<
      string,
      { name: string; totalQty: Prisma.Decimal; days: Set<string> }
    > = {};

    for (const item of items) {
      const key = item.productId;
      if (!productMap[key]) {
        productMap[key] = {
          name: item.product.name,
          totalQty: new Prisma.Decimal(0),
          days: new Set<string>(),
        };
      }
      productMap[key].totalQty = productMap[key].totalQty.add(
        item.quantity as any
      );
      const d = item.invoice.issueDate;
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      productMap[key].days.add(dayKey);
    }

    if (Object.keys(productMap).length === 0) {
      return [];
    }

    const activeProducts = await prisma.product.findMany({
      where: {
        tenantId: this.tenantId,
        id: { in: Object.keys(productMap) },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const stockAgg = await prisma.stockQuant.groupBy({
      by: ['productId'],
      where: {
        tenantId: this.tenantId,
        productId: { in: activeProducts.map((p) => p.id) },
      },
      _sum: { quantity: true },
    });

    const stockMap: Record<string, Prisma.Decimal> = {};
    for (const s of stockAgg) {
      stockMap[s.productId] = s._sum.quantity ?? new Prisma.Decimal(0);
    }

    const predictions: {
      productId: string;
      productName: string;
      daysUntilStockout: number;
    }[] = [];

    for (const [productId, stats] of Object.entries(productMap)) {
      const daysCount = stats.days.size || 1;
      const avgDaily = stats.totalQty.div(daysCount);
      const currentStock = stockMap[productId] ?? new Prisma.Decimal(0);

      if (avgDaily.lte(0)) {
        continue;
      }

      if (currentStock.lte(0)) {
        continue;
      }

      const daysLeft = currentStock.div(avgDaily);
      const daysNumber = Math.floor(Number(daysLeft.toString()));

      if (daysNumber <= 7) {
        predictions.push({
          productId,
          productName: stats.name,
          daysUntilStockout: daysNumber,
        });
      }
    }

    predictions.sort(
      (a, b) => a.daysUntilStockout - b.daysUntilStockout
    );

    return predictions;
  }

  private async getDeadStock(
    prisma: ReturnType<typeof this['prisma']>,
    cutoff: Date
  ) {
    const soldProductIdsRaw = await prisma.invoiceItem.findMany({
      where: {
        tenantId: this.tenantId,
        invoice: {
          status: { in: ['Posted', 'Paid'] },
          issueDate: { gte: cutoff },
        },
      },
      select: {
        productId: true,
      },
      distinct: ['productId'],
    });

    const soldProductIds = new Set(
      soldProductIdsRaw.map((i) => i.productId)
    );

    const stockAgg = await prisma.stockQuant.groupBy({
      by: ['productId'],
      where: {
        tenantId: this.tenantId,
      },
      _sum: { quantity: true },
    });

    const candidates = stockAgg.filter((s) => {
      const qty = s._sum.quantity ?? new Prisma.Decimal(0);
      return qty.gt(0) && !soldProductIds.has(s.productId);
    });

    if (candidates.length === 0) {
      return [];
    }

    const products = await prisma.product.findMany({
      where: {
        tenantId: this.tenantId,
        id: { in: candidates.map((c) => c.productId) },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const productNameMap = products.reduce<Record<string, string>>(
      (acc, p) => {
        acc[p.id] = p.name;
        return acc;
      },
      {}
    );

    const result = candidates.map((c) => ({
      productId: c.productId,
      productName: productNameMap[c.productId] || 'Product',
      quantity: Number(
        (c._sum.quantity ?? new Prisma.Decimal(0)).toString()
      ),
    }));

    result.sort((a, b) => b.quantity - a.quantity);

    return result;
  }
}