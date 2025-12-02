import { GLAccountType, Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

type DefaultAccounts = {
  cash: { id: string };
  receivables: { id: string };
  inventory: { id: string };
  sales: { id: string };
  cogs: { id: string };
  depreciationExpense: { id: string };
  accumulatedDepreciation: { id: string };
};

export class AccountingService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  /**
   * Ensure a minimal chart of accounts per tenant.
   * This is also invoked from seed.ts to create a standard Kenyan-style CoA.
   */
  async ensureDefaultAccounts(
    prismaOverride?: PrismaClientForTenant,
  ): Promise<DefaultAccounts> {
    const prisma = prismaOverride ?? this.prisma;

    const definitions: {
      code: string;
      name: string;
      type: GLAccountType;
      key: keyof DefaultAccounts;
    }[] = [
      {
        code: '1000',
        name: 'Cash at Bank',
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
        code: '1500',
        name: 'Accumulated Depreciation',
        type: GLAccountType.ASSET,
        key: 'accumulatedDepreciation',
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
      {
        code: '6100',
        name: 'Depreciation Expense',
        type: GLAccountType.EXPENSE,
        key: 'depreciationExpense',
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
        description: { contains: 'posted', mode: 'insensitive' },
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
   * Record a cash receipt against receivables when an invoice is fully paid:
   *   DR Cash at Bank
   *   CR Accounts Receivable
   *
   * Called when invoice status transitions to Paid.
   */
  async recordInvoicePaid(invoiceId: string) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
    });

    if (!invoice) {
      throw new Error('Invoice not found for GL cash receipt');
    }

    const totalAmount = invoice.totalAmount as unknown as Prisma.Decimal;
    if (totalAmount.lte(0)) {
      return null;
    }

    // Idempotency: if a cash receipt journal exists for this invoice, do nothing.
    const existing = await prisma.gLJournalEntry.findFirst({
      where: {
        tenantId: this.tenantId,
        invoiceId: invoice.id,
        description: { contains: 'paid', mode: 'insensitive' },
      },
    });

    if (existing) {
      return existing;
    }

    const accounts = await this.ensureDefaultAccounts(prisma);

    const entry = await prisma.gLJournalEntry.create({
      data: {
        tenantId: this.tenantId,
        date: invoice.updatedAt || invoice.issueDate,
        description: `Invoice ${invoice.invoiceNo} paid`,
        invoiceId: invoice.id,
        lines: {
          create: [
            {
              tenantId: this.tenantId,
              accountId: accounts.cash.id,
              debit: totalAmount,
              credit: new Prisma.Decimal(0),
            },
            {
              tenantId: this.tenantId,
              accountId: accounts.receivables.id,
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

  /**
   * Compute a trial balance for the tenant over all periods.
   * Groups by GL account and returns net balances (debit-positive).
   */
  async getTrialBalance() {
    const prisma = this.prisma;

    const accounts = await prisma.gLAccount.findMany({
      where: { tenantId: this.tenantId },
      include: {
        lines: true,
      },
      orderBy: { code: 'asc' },
    });

    return accounts.map((account) => {
      const totalDebit = account.lines.reduce(
        (acc, line) =>
          acc.add(line.debit as unknown as Prisma.Decimal),
        new Prisma.Decimal(0),
      );
      const totalCredit = account.lines.reduce(
        (acc, line) =>
          acc.add(line.credit as unknown as Prisma.Decimal),
        new Prisma.Decimal(0),
      );
      const net = totalDebit.sub(totalCredit);

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit: Number(totalDebit.toString()),
        credit: Number(totalCredit.toString()),
        net: Number(net.toString()),
      };
    });
  }
}