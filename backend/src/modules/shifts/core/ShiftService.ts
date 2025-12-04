import { Prisma, ShiftStatus } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class ShiftService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  /**
   * Open a new shift for the given user with an opening float.
   * Fails if there is already an OPEN shift for this user.
   */
  async openShift(params: { userId: string; openingFloat: number }) {
    const prisma = this.prisma;

    if (params.openingFloat < 0) {
      throw new Error('Opening float cannot be negative');
    }

    const existingOpen = await prisma.shift.findFirst({
      where: {
        tenantId: this.tenantId,
        userId: params.userId,
        status: ShiftStatus.OPEN,
      },
    });

    if (existingOpen) {
      throw new Error('There is already an open shift for this user');
    }

    const openingFloat = new Prisma.Decimal(params.openingFloat);

    const shift = await prisma.shift.create({
      data: {
        tenantId: this.tenantId,
        userId: params.userId,
        openingFloat,
        status: ShiftStatus.OPEN,
      },
    });

    return shift;
  }

  /**
   * Close the current OPEN shift for a user with a blind cash count (closingFloat).
   * Computes an expected closing cash based on all Credit transactions in the window
   * and logs a SHIFT_VARIANCE entry in SystemLog if there is a difference.
   */
  async closeShift(params: { userId: string; closingFloat: number }) {
    const prisma = this.prisma;

    if (params.closingFloat < 0) {
      throw new Error('Closing float cannot be negative');
    }

    const shift = await prisma.shift.findFirst({
      where: {
        tenantId: this.tenantId,
        userId: params.userId,
        status: ShiftStatus.OPEN,
      },
      orderBy: {
        openedAt: 'desc',
      },
    });

    if (!shift) {
      throw new Error('No open shift found for this user');
    }

    const closingFloat = new Prisma.Decimal(params.closingFloat);

    const updated = await prisma.$transaction(async (tx) => {
      // For v1, we approximate expected cash as:
      // openingFloat + sum of all Credit transactions for this tenant
      // between openedAt and now. This is coarse but surfaces variances.
      const now = new Date();

      const txAgg = await tx.transaction.aggregate({
        where: {
          tenantId: this.tenantId,
          type: 'Credit',
          paymentMethod: 'CASH',
          createdAt: {
            gte: shift.openedAt,
            lte: now,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const sumCredits = txAgg._sum.amount ?? new Prisma.Decimal(0);
      const openingFloatDecimal =
        shift.openingFloat ?? new Prisma.Decimal(0);
      const expectedClosing = openingFloatDecimal.add(sumCredits);

      const variance = closingFloat.sub(expectedClosing);

      const updatedShift = await tx.shift.update({
        where: { id: shift.id },
        data: {
          status: ShiftStatus.CLOSED,
          closedAt: now,
          closingFloat,
          expectedClosingCash: expectedClosing,
          variance,
        },
      });

      if (!variance.eq(0)) {
        await tx.systemLog.create({
          data: {
            tenantId: this.tenantId,
            userId: params.userId,
            action: 'SHIFT_VARIANCE',
            entityType: 'Shift',
            entityId: shift.id,
            metadata: {
              openingFloat: openingFloatDecimal,
              closingFloat,
              expectedClosing,
              variance,
              openedAt: shift.openedAt,
              closedAt: now,
            },
          },
        });
      }

      return updatedShift;
    });

    return updated;
  }

  async getCurrentShift(userId: string) {
    const prisma = this.prisma;

    const shift = await prisma.shift.findFirst({
      where: {
        tenantId: this.tenantId,
        userId,
        status: ShiftStatus.OPEN,
      },
      orderBy: {
        openedAt: 'desc',
      },
    });

    return shift;
  }
}