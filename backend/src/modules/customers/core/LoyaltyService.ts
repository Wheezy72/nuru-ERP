import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class LoyaltyService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  /**
   * Award loyalty points for a fully-paid invoice.
   * Earn rate: 1% of invoice totalAmount.
   * Idempotent via SystemLog check.
   */
  async awardForInvoice(invoiceId: string) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
      include: {
        customer: true,
      },
    });

    if (!invoice || !invoice.customer) {
      return;
    }

    if (invoice.status !== 'Paid') {
      return;
    }

    const existing = await prisma.systemLog.findFirst({
      where: {
        tenantId: this.tenantId,
        entityType: 'Invoice',
        entityId: invoice.id,
        action: 'LOYALTY_POINTS_EARNED',
      },
    });

    if (existing) {
      return;
    }

    const totalDecimal = invoice.totalAmount as unknown as Prisma.Decimal;
    const earn = totalDecimal.mul(new Prisma.Decimal(0.01));

    if (earn.lte(0)) {
      return;
    }

    const currentPoints =
      (invoice.customer.loyaltyPoints as unknown as Prisma.Decimal) ||
      new Prisma.Decimal(0);
    const newPoints = currentPoints.add(earn);

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: invoice.customer!.id },
        data: {
          loyaltyPoints: newPoints,
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: null,
          action: 'LOYALTY_POINTS_EARNED',
          entityType: 'Invoice',
          entityId: invoice.id,
          metadata: {
            invoiceNo: invoice.invoiceNo,
            amount: earn,
            totalAmount: totalDecimal,
            previousPoints: currentPoints,
            newPoints,
          },
        },
      });
    });
  }

  /**
   * Redeem loyalty points as a payment against an invoice.
   * Points are treated as currency units (e.g. KES).
   */
  async redeemForInvoice(
    invoiceId: string,
    requestedPoints: number,
    userId?: string | null,
  ) {
    const prisma = this.prisma;

    if (requestedPoints <= 0) {
      throw new Error('Redemption amount must be positive');
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
      include: {
        customer: true,
      },
    });

    if (!invoice || !invoice.customer) {
      throw new Error('Invoice or customer not found');
    }

    const customer = invoice.customer;

    const customerPoints =
      (customer.loyaltyPoints as unknown as Prisma.Decimal) ||
      new Prisma.Decimal(0);
    const remainingAgg = await prisma.transaction.aggregate({
      where: {
        tenantId: this.tenantId,
        invoiceId: invoice.id,
        type: 'Credit',
      },
      _sum: {
        amount: true,
      },
    });

    const alreadyPaid =
      remainingAgg._sum.amount ?? new Prisma.Decimal(0);
    const totalAmount =
      invoice.totalAmount as unknown as Prisma.Decimal;
    const remainingBalance = totalAmount.sub(alreadyPaid);

    if (remainingBalance.lte(0)) {
      throw new Error('Invoice is already fully paid');
    }

    const requested = new Prisma.Decimal(requestedPoints);
    const maxUsable = Prisma.Decimal.min(
      customerPoints,
      remainingBalance,
    );
    const toUse = Prisma.Decimal.min(maxUsable, requested);

    if (toUse.lte(0)) {
      throw new Error('No redeemable loyalty points available');
    }

    const newPaidTotal = alreadyPaid.add(toUse);

    let newStatus = invoice.status;
    if (newPaidTotal.gte(totalAmount)) {
      newStatus = 'Paid';
    } else if (newPaidTotal.gt(0)) {
      newStatus = 'Partial';
    }

    const remainingPoints = customerPoints.sub(toUse);

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
        },
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          loyaltyPoints: remainingPoints,
        },
      });

      await tx.transaction.create({
        data: {
          tenantId: this.tenantId,
          invoiceId: invoice.id,
          accountId: null,
          amount: toUse,
          type: 'Credit',
          reference: `Loyalty points redemption for ${invoice.invoiceNo}`,
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'INVOICE_PAID_LOYALTY',
          entityType: 'Invoice',
          entityId: invoice.id,
          metadata: {
            previousStatus: invoice.status,
            newStatus,
            redeemed: toUse,
            totalAmount,
            alreadyPaid,
            newPaidTotal,
            customerId: customer.id,
          },
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'LOYALTY_POINTS_REDEEMED',
          entityType: 'Customer',
          entityId: customer.id,
          metadata: {
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            redeemed: toUse,
            previousPoints: customerPoints,
            remainingPoints,
          },
        },
      });

      return inv;
    });

    return updated;
  }
}