import { Prisma, TaxRate } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';
import { InventoryService } from '../../inventory/core/InventoryService';
import { WhatsAppService } from '../../../shared/whatsapp/WhatsAppService';

export class InvoiceService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async listInvoices(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.InvoiceWhereInput = {
      tenantId: this.tenantId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { invoiceNo: { contains: params.search, mode: 'insensitive' } },
              {
                customer: {
                  name: { contains: params.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { issueDate: 'desc' },
        include: { customer: true },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async createInvoice(input: {
    customerId: string;
    issueDate: Date;
    dueDate?: Date;
    items: {
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      uomId: string;
      hsCode: string;
      taxRate: TaxRate;
    }[];
  }) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const subtotal = input.items.reduce(
        (acc, item) => acc.add(item.quantity.mul(item.unitPrice)),
        new Prisma.Decimal(0)
      );

      const invoiceNo = `INV-${Date.now()}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId: this.tenantId,
          customerId: input.customerId,
          invoiceNo,
          status: 'Draft',
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          totalAmount: subtotal,
          items: {
            create: input.items.map((item) => ({
              tenantId: this.tenantId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              uomId: item.uomId,
              lineTotal: item.quantity.mul(item.unitPrice),
              hsCode: item.hsCode,
              taxRate: item.taxRate,
            })),
          },
        },
        include: { items: true },
      });

      // Tax breakdown is derived from InvoiceItems for future KRA integration.
      // This method can be invoked later via buildKraPayload.
      return invoice;
    });
  }

  async postInvoice(id: string, locationId: string, userId?: string | null) {
    if (!locationId) {
      throw new Error('locationId is required to post an invoice');
    }

    const prisma = this.prisma;

    // Load invoice, items and customer first
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: this.tenantId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.status !== 'Draft') {
      throw new Error('Only draft invoices can be posted');
    }

    // Adjust stock for each invoice item before marking as posted
    const inventoryService = new InventoryService(this.tenantId);

    for (const item of invoice.items) {
      await inventoryService.adjustStock({
        productId: item.productId,
        locationId,
        batchId: null,
        uomId: item.uomId,
        quantityDelta: (item.quantity as unknown as Prisma.Decimal).mul(
          new Prisma.Decimal(-1)
        ),
      });
    }

    // If all stock adjustments succeed, mark invoice as posted
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'Posted' },
    });

    await prisma.systemLog.create({
      data: {
        tenantId: this.tenantId,
        userId: userId ?? null,
        action: 'INVOICE_POSTED',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: {
          locationId,
          totalAmount: invoice.totalAmount,
        },
      },
    });

    // Fire-and-forget WhatsApp notification; failure should not block posting
    try {
      const customer = invoice.customer;
      if (customer?.phone) {
        const whatsappService = new WhatsAppService(this.tenantId);
        await whatsappService.sendInvoice(customer.phone, {
          invoiceNo: invoice.invoiceNo,
          issueDate: invoice.issueDate,
          totalAmount: invoice.totalAmount.toString(),
          customerName: customer.name,
          items: invoice.items.map((item) => ({
            productName: item.product?.name ?? 'Item',
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString(),
          })),
        });
      }
    } catch (err) {
      // Log but do not fail posting if WhatsApp sending fails
      // eslint-disable-next-line no-console
      console.error('Failed to send invoice WhatsApp notification', err);
    }

    return updated;
  }

  /**
   * Build a tax breakdown payload suitable for eTIMS / KRA VSCU integration.
   * This is a pure read operation and does not modify state.
   */
  async buildKraPayload(invoiceId: string) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const breakdown = {
      vat16: { taxable: new Prisma.Decimal(0), tax: new Prisma.Decimal(0) },
      vat8: { taxable: new Prisma.Decimal(0), tax: new Prisma.Decimal(0) },
      exempt: { amount: new Prisma.Decimal(0) },
      zeroRated: { amount: new Prisma.Decimal(0) },
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

    for (const item of invoice.items) {
      const amount = item.lineTotal;
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
      invoice: {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        issueDate: invoice.issueDate,
        customerName: invoice.customer.name,
        customerKraPin: invoice.customer.kraPin,
        totalAmount: invoice.totalAmount,
      },
      taxBreakdown: breakdown,
      items: invoice.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        hsCode: item.hsCode,
        taxRate: item.taxRate,
      })),
    };
  }

  /**
   * Bulk-generate draft invoices for all students (customers) for a given fee product.
   * Intended for SCHOOL tenants using recurring term fees.
   */
  async bulkGenerateForAllCustomers(input: {
    productId: string;
    unitPrice: number;
    issueDate: Date;
  }) {
    const prisma = this.prisma;

    const product = await prisma.product.findFirst({
      where: {
        tenantId: this.tenantId,
        OR: [
          { id: input.productId },
          { sku: input.productId },
          { name: input.productId },
        ],
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: this.tenantId,
      },
    });

    if (customers.length === 0) {
      return { created: 0 };
    }

    const unitPriceDecimal = new Prisma.Decimal(input.unitPrice);
    const qty = new Prisma.Decimal(1);

    await prisma.$transaction(async (tx) => {
      for (const customer of customers) {
        const invoiceNo = `SCH-${Date.now()}-${Math.floor(
          Math.random() * 10000
        )
          .toString()
          .padStart(4, '0')}`;

        const lineTotal = qty.mul(unitPriceDecimal);

        await tx.invoice.create({
          data: {
            tenantId: this.tenantId,
            customerId: customer.id,
            invoiceNo,
            status: 'Draft',
            issueDate: input.issueDate,
            totalAmount: lineTotal,
            items: {
              create: [
                {
                  tenantId: this.tenantId,
                  productId: product.id,
                  quantity: qty,
                  unitPrice: unitPriceDecimal,
                  uomId: product.defaultUomId,
                  lineTotal,
                  hsCode: '999999',
                  taxRate: TaxRate.VAT_16,
                },
              ],
            },
          },
        });
      }
    });

    return { created: customers.length };
  }

  /**
   * Record an external (manual) payment such as EFT / cheque.
   * Updates invoice status based on partial vs full payment and logs a SystemLog entry flagged for verification.
   */
  async recordExternalPayment(
    invoiceId: string,
    input: {
      amount: number;
      method: string;
      reference?: string;
      paidAt: Date;
      userId?: string | null;
    }
  ) {
    const prisma = this.prisma;

    if (input.amount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const existingAgg = await prisma.transaction.aggregate({
      where: {
        tenantId: this.tenantId,
        invoiceId: invoice.id,
        type: 'Credit',
      },
      _sum: {
        amount: true,
      },
    });

    const alreadyPaid = existingAgg._sum.amount ?? new Prisma.Decimal(0);
    const paymentAmount = new Prisma.Decimal(input.amount);
    const newPaidTotal = alreadyPaid.add(paymentAmount);
    const totalAmountDecimal = invoice.totalAmount as unknown as Prisma.Decimal;

    let newStatus = invoice.status;
    if (newPaidTotal.gte(totalAmountDecimal)) {
      newStatus = 'Paid';
    } else if (newPaidTotal.gt(0)) {
      newStatus = 'Partial';
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: newStatus },
    });

    await prisma.transaction.create({
      data: {
        tenantId: this.tenantId,
        invoiceId: invoice.id,
        accountId: null,
        amount: paymentAmount,
        type: 'Credit',
        reference:
          input.reference ||
          `Manual ${input.method} payment for ${invoice.invoiceNo}`,
        createdAt: input.paidAt,
      },
    });

    await prisma.systemLog.create({
      data: {
        tenantId: this.tenantId,
        userId: input.userId ?? null,
        action: 'INVOICE_PAID_MANUAL',
        entityType: 'Invoice',
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
          note: 'Manual Entry - Verification Needed',
        },
      },
    });

    return updated;
  }

  /**
   * Load an invoice with its items and computed payment/balance summary.
   */
  async getInvoiceWithBalances(id: string) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: this.tenantId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            uom: true,
          },
        },
        transactions: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const paidDecimal = invoice.transactions
      .filter((tx) => tx.type === 'Credit')
      .reduce(
        (acc, tx) =>
          acc.add(tx.amount as unknown as Prisma.Decimal),
        new Prisma.Decimal(0)
      );

    const totalDecimal = invoice.totalAmount as unknown as Prisma.Decimal;
    const balanceDecimal = totalDecimal.sub(paidDecimal);

    return {
      invoice,
      paidAmount: Number(paidDecimal.toString()),
      balanceDue: Number(balanceDecimal.toString()),
    };
  }

  /**
   * Return payment transactions and audit logs for an invoice.
   */
  async getInvoiceHistory(id: string) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: this.tenantId },
      select: { id: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const [payments, logs] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          tenantId: this.tenantId,
          invoiceId: id,
          type: 'Credit',
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.systemLog.findMany({
        where: {
          tenantId: this.tenantId,
          entityType: 'Invoice',
          entityId: id,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return { payments, logs };
  }

  /**
   * Send a WhatsApp payment reminder for an invoice with outstanding balance.
   */
  async sendPaymentReminder(
    invoiceId: string,
    userId?: string | null
  ) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
      include: {
        customer: true,
        transactions: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const customer = invoice.customer;
    if (!customer?.phone) {
      throw new Error('Customer has no phone number for WhatsApp reminder');
    }

    const paidDecimal = invoice.transactions
      .filter((tx) => tx.type === 'Credit')
      .reduce(
        (acc, tx) =>
          acc.add(tx.amount as unknown as Prisma.Decimal),
        new Prisma.Decimal(0)
      );

    const totalDecimal = invoice.totalAmount as unknown as Prisma.Decimal;
    const balanceDecimal = totalDecimal.sub(paidDecimal);

    if (balanceDecimal.lte(new Prisma.Decimal(0))) {
      return;
    }

    const balanceNumber = Number(balanceDecimal.toString());

    const whatsapp = new WhatsAppService(this.tenantId);
    const message = `Hello ${customer.name}, reminder of outstanding balance: KES ${balanceNumber.toLocaleString()} for Invoice ${invoice.invoiceNo}.`;

    await whatsapp.sendText(customer.phone, message);

    await prisma.systemLog.create({
      data: {
        tenantId: this.tenantId,
        userId: userId ?? null,
        action: 'INVOICE_REMINDER_SENT',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: {
          balance: balanceDecimal,
          customerName: customer.name,
          customerPhone: customer.phone,
        },
      },
    });
  }
}