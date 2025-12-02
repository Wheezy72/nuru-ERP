import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type PrismaClientForTenant = ReturnType<typeof createTenantPrismaClient>;

export class ApService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma(): PrismaClientForTenant {
    return createTenantPrismaClient(this.tenantId);
  }

  async listSupplierInvoices(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    supplierId?: string;
  }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SupplierInvoiceWhereInput = {
      tenantId: this.tenantId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { invoiceDate: 'desc' },
        include: {
          supplier: true,
        },
      }),
      prisma.supplierInvoice.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async createSupplierInvoice(input: {
    supplierId: string;
    invoiceNo?: string;
    invoiceDate: Date;
    dueDate?: Date | null;
    items: {
      productId?: string | null;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      uomId?: string | null;
      taxRate?: string | null;
    }[];
  }) {
    const prisma = this.prisma;

    if (!input.items || input.items.length === 0) {
      throw new Error('Supplier invoice must have at least one item');
    }

    return prisma.$transaction(async (tx) => {
      const subtotal = input.items.reduce(
        (acc, item) => acc.add(item.quantity.mul(item.unitCost)),
        new Prisma.Decimal(0),
      );

      const invoiceNo =
        input.invoiceNo ||
        `SUP-${input.invoiceDate.getFullYear()}${String(
          input.invoiceDate.getMonth() + 1,
        ).padStart(2, '0')}-${Date.now()}`;

      const invoice = await tx.supplierInvoice.create({
        data: {
          tenantId: this.tenantId,
          supplierId: input.supplierId,
          invoiceNo,
          status: 'Posted',
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          totalAmount: subtotal,
          items: {
            create: input.items.map((item) => ({
              tenantId: this.tenantId,
              productId: item.productId ?? null,
              quantity: item.quantity,
              unitCost: item.unitCost,
              uomId: item.uomId ?? null,
              lineTotal: item.quantity.mul(item.unitCost),
              taxRate: (item.taxRate as any) ?? null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return invoice;
    });
  }

  async recordSupplierPayment(
    supplierInvoiceId: string,
    input: {
      amount: number;
      method: string;
      reference?: string;
      paidAt: Date;
      userId?: string | null;
    },
  ) {
    const prisma = this.prisma;

    if (input.amount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id: supplierInvoiceId, tenantId: this.tenantId },
    });

    if (!invoice) {
      throw new Error('Supplier invoice not found');
    }

    const existingAgg = await prisma.transaction.aggregate({
      where: {
        tenantId: this.tenantId,
        supplierInvoiceId: invoice.id,
        type: 'Debit',
      },
      _sum: {
        amount: true,
      },
    });

    const alreadyPaid = existingAgg._sum.amount ?? new Prisma.Decimal(0);
    const paymentAmount = new Prisma.Decimal(input.amount);
    const newPaidTotal = alreadyPaid.add(paymentAmount);
    const totalAmountDecimal =
      invoice.totalAmount as unknown as Prisma.Decimal;

    let newStatus = invoice.status;
    if (newPaidTotal.gte(totalAmountDecimal)) {
      newStatus = 'Paid';
    } else if (newPaidTotal.gt(0)) {
      newStatus = 'Partial';
    }

    const updated = await prisma.supplierInvoice.update({
      where: { id: invoice.id },
      data: { status: newStatus },
    });

    await prisma.transaction.create({
      data: {
        tenantId: this.tenantId,
        supplierInvoiceId: invoice.id,
        accountId: null,
        invoiceId: null,
        amount: paymentAmount,
        type: 'Debit',
        reference:
          input.reference ||
          `Supplier payment (${input.method}) for ${invoice.invoiceNo}`,
        createdAt: input.paidAt,
      },
    });

    await prisma.systemLog.create({
      data: {
        tenantId: this.tenantId,
        userId: input.userId ?? null,
        action: 'SUPPLIER_PAYMENT_RECORDED',
        entityType: 'SupplierInvoice',
        entityId: invoice.id,
        metadata: {
          previousStatus: invoice.status,
          newStatus,
          method: input.method,
          reference: input.reference,
          amount: paymentAmount,
          paidAt: input.paidAt,
          totalAmount: totalAmountDecimal,
          alreadyPaid,
          newPaidTotal,
        },
      },
    });

    return updated;
  }

  async getAgingSummary(asOf?: Date) {
    const prisma = this.prisma;
    const today = asOf ?? new Date();

    const invoices = await prisma.supplierInvoice.findMany({
      where: {
        tenantId: this.tenantId,
        status: { in: ['Posted', 'Partial'] },
      },
      include: {
        supplier: true,
        transactions: true,
      },
    });

    type AgingBucketKey = '0-30' | '31-60' | '61-90' | '90+';

    const buckets: Record<AgingBucketKey, Prisma.Decimal> = {
      '0-30': new Prisma.Decimal(0),
      '31-60': new Prisma.Decimal(0),
      '61-90': new Prisma.Decimal(0),
      '90+': new Prisma.Decimal(0),
    };

    const details: {
      supplierName: string;
      invoiceId: string;
      invoiceNo: string;
      dueDate: Date | null;
      outstanding: number;
      bucket: AgingBucketKey;
      daysPastDue: number;
    }[] = [];

    for (const inv of invoices) {
      const total = inv.totalAmount as unknown as Prisma.Decimal;
      const paid = inv.transactions
        .filter((tx) => tx.type === 'Debit')
        .reduce(
          (acc, tx) => acc.add(tx.amount as unknown as Prisma.Decimal),
          new Prisma.Decimal(0),
        );
      const outstandingDecimal = total.sub(paid);
      if (outstandingDecimal.lte(0)) {
        continue;
      }

      const refDate = inv.dueDate ?? inv.invoiceDate;
      const diffMs = today.getTime() - refDate.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let bucket: AgingBucketKey;
      if (days <= 30) bucket = '0-30';
      else if (days <= 60) bucket = '31-60';
      else if (days <= 90) bucket = '61-90';
      else bucket = '90+';

      buckets[bucket] = buckets[bucket].add(outstandingDecimal);

      details.push({
        supplierName: inv.supplier.name,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        dueDate: inv.dueDate ?? null,
        outstanding: Number(outstandingDecimal.toString()),
        bucket,
        daysPastDue: days,
      });
    }

    return {
      asOf: today,
      buckets: {
        '0-30': Number(buckets['0-30'].toString()),
        '31-60': Number(buckets['31-60'].toString()),
        '61-90': Number(buckets['61-90'].toString()),
        '90+': Number(buckets['90+'].toString()),
      },
      invoices: details,
    };
  }
}