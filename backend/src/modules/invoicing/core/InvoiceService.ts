import { Prisma, TaxRate } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';
import { InventoryService } from '../../inventory/core/InventoryService';
import { WhatsAppService } from '../../../shared/whatsapp/WhatsAppService';
import { LoyaltyService } from '../../customers/core/LoyaltyService';
import { AccountingService } from '../../accounting/core/AccountingService';
import { computeTaxBreakdown } from './taxMath';
import { computeLineTotal, money, roundCurrency } from '../../../shared/finance/money';

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
        include: { customer: true, taxQueueEntries: true },
      }),
      prisma.invoice.count({ where }),
    ]);

    const itemsWithTaxStatus = items.map((inv) => {
      const entry = inv.taxQueueEntries?.[0];
      const taxStatus = entry?.status ?? null;
      return {
        ...inv,
        taxStatus,
      };
    });

    return {
      items: itemsWithTaxStatus,
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
    isTraining?: boolean;
    couponCode?: string;
    items: {
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice?: Prisma.Decimal | null;
      uomId: string;
      hsCode: string;
      taxRate: TaxRate;
    }[];
  }) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      // Resolve unit prices via price lists / default price when not provided.
      const resolvedItems = [];
      for (const rawItem of input.items) {
        const quantity = money(rawItem.quantity);
        let unitPriceDecimal: Prisma.Decimal;

        if (
          rawItem.unitPrice !== undefined &&
          rawItem.unitPrice !== null &&
          (rawItem.unitPrice as unknown as Prisma.Decimal).gt(0)
        ) {
          unitPriceDecimal = rawItem.unitPrice as unknown as Prisma.Decimal;
        } else {
          // Pricing rules:
          // 1) If customer has a price list, use that list's price for this product.
          // 2) Else if there is a tenant default price list, try that.
          // 3) Else fall back to product.defaultPrice.
          const customer = await tx.customer.findFirst({
            where: { id: input.customerId, tenantId: this.tenantId },
          });

          let priceListId: string | null =
            (customer?.priceListId as string | null) ?? null;

          if (!priceListId) {
            const defaultList = await tx.priceList.findFirst({
              where: { tenantId: this.tenantId, isDefault: true },
            });
            priceListId = defaultList?.id ?? null;
          }

          let price: Prisma.Decimal | null = null;

          if (priceListId) {
            const item = await tx.priceListItem.findFirst({
              where: {
                tenantId: this.tenantId,
                priceListId,
                productId: rawItem.productId,
              },
            });
            if (item) {
              price = item.unitPrice as unknown as Prisma.Decimal;
            }
          }

          if (!price) {
            const product = await tx.product.findFirst({
              where: { id: rawItem.productId, tenantId: this.tenantId },
            });
            if (!product) {
              throw new Error('Product not found for pricing');
            }
            price = product.defaultPrice as unknown as Prisma.Decimal;
          }

          unitPriceDecimal = price;
        }

        const lineTotal = computeLineTotal(quantity, unitPriceDecimal);
        resolvedItems.push({
          ...rawItem,
          quantity,
          unitPrice: unitPriceDecimal,
          lineTotal,
        });
      }

      const subtotal = resolvedItems.reduce(
        (acc, item) => acc.add(item.lineTotal),
        money(0),
      );

      let discount = money(0);
      let appliedCoupon: { id: string; code: string } | null = null;

      if (input.couponCode) {
        const code = input.couponCode.trim().toUpperCase();
        const now = new Date();

        const coupon = await tx.coupon.findFirst({
          where: {
            tenantId: this.tenantId,
            code,
            active: true,
          },
        });

        if (!coupon) {
          throw new Error('Invalid or inactive coupon code');
        }

        if (coupon.validFrom && now < coupon.validFrom) {
          throw new Error('Coupon is not yet valid');
        }
        if (coupon.validTo && now > coupon.validTo) {
          throw new Error('Coupon has expired');
        }
        if (coupon.maxUses !== null && coupon.maxUses !== undefined) {
          if (coupon.usedCount >= coupon.maxUses) {
            throw new Error('Coupon usage limit reached');
          }
        }
        if (coupon.minSubtotal) {
          const minSub = coupon.minSubtotal as unknown as Prisma.Decimal;
          if (subtotal.lt(minSub)) {
            throw new Error(
              `Coupon requires a minimum subtotal of ${minSub.toString()}`,
            );
          }
        }

        let couponDiscount = money(0);

        if (coupon.percentageOff) {
          const pct = coupon.percentageOff as unknown as Prisma.Decimal;
          if (pct.gt(0)) {
            couponDiscount = couponDiscount.add(subtotal.mul(pct));
          }
        }

        if (coupon.amountOff) {
          const amt = coupon.amountOff as unknown as Prisma.Decimal;
          if (amt.gt(0)) {
            couponDiscount = couponDiscount.add(amt);
          }
        }

        if (couponDiscount.gt(subtotal)) {
          couponDiscount = subtotal;
        }

        discount = couponDiscount;
        appliedCoupon = { id: coupon.id, code: coupon.code };
      }

      const totalBeforeRound = subtotal.sub(discount);
      const zero = money(0);
      const nonNegative = totalBeforeRound.lt(zero) ? zero : totalBeforeRound;
      const roundedTotal = roundCurrency(nonNegative);

      const invoiceNo = `INV-${Date.now()}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId: this.tenantId,
          customerId: input.customerId,
          invoiceNo,
          status: 'Draft',
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          totalAmount: roundedTotal,
          isTraining: input.isTraining ?? false,
          items: {
            create: resolvedItems.map((item) => ({
              tenantId: this.tenantId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              uomId: item.uomId,
              lineTotal: item.lineTotal,
              hsCode: item.hsCode,
              taxRate: item.taxRate,
            })),
          },
        },
        include: { items: true },
      });

      if (appliedCoupon && discount.gt(zero)) {
        await tx.couponRedemption.create({
          data: {
            tenantId: this.tenantId,
            couponId: appliedCoupon.id,
            invoiceId: invoice.id,
            discount,
          },
        });

        await tx.coupon.update({
          where: { id: appliedCoupon.id },
          data: {
            usedCount: {
              increment: 1,
            },
          },
        });

        await tx.systemLog.create({
          data: {
            tenantId: this.tenantId,
            userId: null,
            action: 'COUPON_APPLIED',
            entityType: 'Invoice',
            entityId: invoice.id,
            metadata: {
              couponCode: appliedCoupon.code,
              discount,
              subtotal,
              total: roundedTotal,
            },
          },
        });
      }

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

    // Training invoices: mark as posted but do not touch stock or GL.
    if (invoice.isTraining) {
      const updatedTraining = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'Posted' },
      });

      await prisma.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'INVOICE_POSTED_TRAINING',
          entityType: 'Invoice',
          entityId: invoice.id,
          metadata: {
            locationId,
            totalAmount: invoice.totalAmount,
          },
        },
      });

      // Optional: send a clearly marked training receipt via WhatsApp.
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
            isTraining: true,
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to send training invoice WhatsApp notification', err);
      }

      return updatedTraining;
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

    // Record GL entry for the posted invoice (best-effort; do not block posting)
    try {
      const accounting = new AccountingService(this.tenantId);
      await accounting.recordInvoicePosted(invoice.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to record GL entry for invoice', invoice.id, err);
    }

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

    const taxBreakdown = computeTaxBreakdown(
      invoice.items.map((item) => ({
        lineTotal: item.lineTotal as unknown as Prisma.Decimal,
        taxRate: item.taxRate as TaxRate,
      }))
    );

    return {
      invoice: {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        issueDate: invoice.issueDate,
        customerName: invoice.customer.name,
        customerKraPin: invoice.customer.kraPin,
        totalAmount: invoice.totalAmount,
      },
      taxBreakdown,
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

    const unitPriceDecimal = money(input.unitPrice);
    const qty = money(1);

    await prisma.$transaction(async (tx) => {
      for (const customer of customers) {
        const invoiceNo = `SCH-${Date.now()}-${Math.floor(
          Math.random() * 10000,
        )
          .toString()
          .padStart(4, '0')}`;

        const lineTotal = computeLineTotal(qty, unitPriceDecimal);
        const totalAmount = roundCurrency(lineTotal);

        await tx.invoice.create({
          data: {
            tenantId: this.tenantId,
            customerId: customer.id,
            invoiceNo,
            status: 'Draft',
            issueDate: input.issueDate,
            totalAmount,
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
    },
  ) {
    const prisma = this.prisma;

    if (input.amount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
      include: {
        customer: true,
      },
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
    const balanceDecimal = totalAmountDecimal.sub(newPaidTotal);

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
        paymentMethod: 'MANUAL',
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

    // Award loyalty points once an invoice reaches Paid status.
    if (newStatus === 'Paid') {
      try {
        const loyalty = new LoyaltyService(this.tenantId);
        await loyalty.awardForInvoice(invoice.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          'Failed to award loyalty points for invoice',
          invoice.id,
          err,
        );
      }
    }

    // Fire-and-forget WhatsApp payment receipt for manual entries.
    try {
      const customer = invoice.customer;
      if (customer?.phone) {
        const whatsapp = new WhatsAppService(this.tenantId);
        await whatsapp.sendPaymentReceipt(customer.phone, {
          invoiceNo: invoice.invoiceNo,
          amountPaid: paymentAmount.toString(),
          totalAmount: totalAmountDecimal.toString(),
          balance: balanceDecimal.toString(),
          method: 'MANUAL',
          customerName: customer.name,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to send manual payment receipt via WhatsApp', err);
    }

    return updated;
  }

  /**
   * Redeem loyalty points against an invoice using the LoyaltyService.
   * This is a thin wrapper used by the HTTP route.
   */
  async redeemLoyalty(invoiceId: string, points: number, userId?: string | null) {
    const loyalty = new LoyaltyService(this.tenantId);
    return loyalty.redeemForInvoice(invoiceId, points, userId);
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
        couponRedemptions: {
          include: {
            coupon: true,
          },
        },
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
        new Prisma.Decimal(0),
      );

    const totalDecimal = invoice.totalAmount as unknown as Prisma.Decimal;
    const balanceDecimal = totalDecimal.sub(paidDecimal);

    const discountDecimal =
      invoice.couponRedemptions.length > 0
        ? (invoice.couponRedemptions[0].discount as unknown as Prisma.Decimal)
        : new Prisma.Decimal(0);

    return {
      invoice,
      paidAmount: Number(paidDecimal.toString()),
      balanceDue: Number(balanceDecimal.toString()),
      coupon: invoice.couponRedemptions[0]
        ? {
            code: invoice.couponRedemptions[0].coupon.code,
            discount: Number(discountDecimal.toString()),
          }
        : null,
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