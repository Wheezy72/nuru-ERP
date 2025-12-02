import { GLAccountType, Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

type DefaultAccounts = {
  cash: { id: string };
  receivables: { id: string };
  inventory: { id: string };
  sales: { id: string };
  cogs: { id: string };
};

export class AccountingService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  private async ensureDefaultAccounts(
    prisma: PrismaClientForTenant,
  ): Promise<DefaultAccounts> {
    const definitions: {
      code: string;
      name: string;
      type: GLAccountType;
      key: keyof DefaultAccounts;
    }[] = [
      {
        code: '1000',
        name: 'Cash',
        type: GLAccountType.ASSET,
        key: 'cash',
      },
      {
        code: '1100',
        name: 'Accounts Receivable',
        type: GLAccountType.ASSET,
        key: 'receivables',
      },
      {
        code: '1200',
        name: 'Inventory',
        type: GLAccountType.ASSET,
        key: 'inventory',
      },
      {
        code: '4000',
        name: 'Sales Revenue',
        type: GLAccountType.REVENUE,
        key: 'sales',
      },
      {
        code: '5000',
        name: 'Cost of Goods Sold',
        type: GLAccountType.EXPENSE,
        key: 'cogs',
      },
    ];

    const result: Partial<DefaultAccounts> = {};

    for (const def of definitions) {
      const account = await prisma.gLAccount.upsert({
        where: {
          tenantId_code: {
            tenantId: this.tenantId,
            code: def.code,
          },
        },
        create: {
          tenantId: this.tenantId,
          code: def.code,
          name: def.name,
          type: def.type,
        },
        update: {},
        select: {
          id: true,
        },
      });

      (result as any)[def.key] = account;
    }

    return result as DefaultAccounts;
  }

  /**
   * Record a simple double-entry journal for a posted invoice:
   *   DR Accounts Receivable
   *   CR Sales Revenue
   *
   * Idempotent per invoice via GLJournalEntry lookup.
   */
  async recordInvoicePosted(invoiceId: string) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: this.tenantId,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found for GL posting');
    }

    const existing = await prisma.gLJournalEntry.findFirst({
      where: {
        tenantId: this.tenantId,
        invoiceId: invoice.id,
      },
    });

    if (existing) {
      return existing;
    }

    const totalAmount = invoice.totalAmount as unknown as Prisma.Decimal;
    if (totalAmount.lte(0)) {
      return null;
    }

    const accounts = await this.ensureDefaultAccounts(prisma);

    const entry = await prisma.gLJournalEntry.create({
      data: {
        tenantId: this.tenantId,
        date: invoice.issueDate,
        description: `Invoice ${invoice.invoiceNo} posted`,
        invoiceId: invoice.id,
        lines: {
          create: [
            {
              tenantId: this.tenantId,
              accountId: accounts.receivables.id,
              debit: totalAmount,
              credit: new Prisma.Decimal(0),
            },
            {
              tenantId: this.tenantId,
              accountId: accounts.sales.id,
              debit: new Prisma.Decimal(0),
              credit: totalAmount,
            },
          ],
        },
      },
    });

    return entry;
  }

  /**
   * Record a simple double-entry journal for a received purchase order:
   *   DR Cost of Goods Sold
   *   CR Cash
   *
   * This keeps the GL simple while still providing a basic P&L view.
   * Idempotent via GLJournalEntry lookup.
   */
  async recordPurchaseOrderReceipt(purchaseOrderId: string) {
    const prisma = this.prisma;

    const po = await prisma.purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        tenantId: this.tenantId,
      },
      include: {
        items: true,
      },
    });

    if (!po) {
      throw new Error('Purchase order not found for GL posting');
    }

    const existing = await prisma.gLJournalEntry.findFirst({
      where: {
        tenantId: this.tenantId,
        purchaseOrderId: po.id,
      },
    });

    if (existing) {
      return existing;
    }

    const total = po.items.reduce(
      (acc, item) =>
        acc.add(item.lineTotal as unknown as Prisma.Decimal),
      new Prisma.Decimal(0),
    );

    if (total.lte(0)) {
      return null;
    }

    const accounts = await this.ensureDefaultAccounts(prisma);

    const entry = await prisma.gLJournalEntry.create({
      data: {
        tenantId: this.tenantId,
        date: po.orderDate,
        description: `Purchase order ${po.id} received`,
        purchaseOrderId: po.id,
        lines: {
          create: [
            {
              tenantId: this.tenantId,
              accountId: accounts.cogs.id,
              debit: total,
              credit: new Prisma.Decimal(0),
            },
            {
              tenantId: this.tenantId,
              accountId: accounts.cash.id,
              debit: new Prisma.Decimal(0),
              credit: total,
            },
          ],
        },
      },
    });

    return entry;
  }
}