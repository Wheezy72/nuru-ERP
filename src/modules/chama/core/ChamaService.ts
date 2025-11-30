import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class ChamaService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async listMembers(params: { page?: number; pageSize?: number; search?: string }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MemberWhereInput = {
      tenantId: this.tenantId,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.member.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async createMember(input: { name: string; phone?: string; email?: string }) {
    const prisma = this.prisma;

    return prisma.member.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
      },
    });
  }

  async openAccount(input: {
    memberId: string;
    type: 'ShareCapital' | 'Deposits' | 'MerryGoRound';
  }) {
    const prisma = this.prisma;

    return prisma.account.create({
      data: {
        tenantId: this.tenantId,
        memberId: input.memberId,
        type: input.type as any,
        balance: new Prisma.Decimal(0),
      },
    });
  }

  async adjustAccountBalance(input: {
    accountId: string;
    amount: Prisma.Decimal;
    type: 'Credit' | 'Debit';
    reference?: string;
  }) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { id: input.accountId, tenantId: this.tenantId },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      const newBalance =
        input.type === 'Credit'
          ? account.balance.add(input.amount)
          : account.balance.sub(input.amount);

      const updated = await tx.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });

      await tx.transaction.create({
        data: {
          tenantId: this.tenantId,
          accountId: account.id,
          amount: input.amount,
          type: input.type,
          reference: input.reference,
        },
      });

      return updated;
    });
  }

  async createLoan(
    input: {
      borrowerId: string;
      principal: Prisma.Decimal;
      interestRate: Prisma.Decimal;
      issuedAt: Date;
      dueDate?: Date;
      guarantors?: { memberId: string; guaranteeAmount: Prisma.Decimal }[];
    },
    userId?: string | null
  ) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          tenantId: this.tenantId,
          borrowerId: input.borrowerId,
          principal: input.principal,
          interestRate: input.interestRate,
          issuedAt: input.issuedAt,
          dueDate: input.dueDate,
          status: 'Active',
          guarantors: input.guarantors
            ? {
                create: input.guarantors.map((g) => ({
                  tenantId: this.tenantId,
                  memberId: g.memberId,
                  guaranteeAmount: g.guaranteeAmount,
                })),
              }
            : undefined,
        },
        include: { guarantors: true },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'LOAN_ISSUED',
          entityType: 'Loan',
          entityId: loan.id,
          metadata: {
            borrowerId: input.borrowerId,
            principal: input.principal,
            interestRate: input.interestRate,
          },
        },
      });

      return loan;
    });
  }

  async listLoans(params: { page?: number; pageSize?: number; status?: string }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.LoanWhereInput = {
      tenantId: this.tenantId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { issuedAt: 'desc' },
        include: {
          borrower: true,
          guarantors: { include: { member: true } },
        },
      }),
      prisma.loan.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async createSession(input: { name: string; meetingDate: Date }) {
    const prisma = this.prisma;

    return prisma.session.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        meetingDate: input.meetingDate,
        totalCollected: new Prisma.Decimal(0),
        cashAtHand: new Prisma.Decimal(0),
      },
    });
  }

  async listSessions(params: { page?: number; pageSize?: number }) {
    const prisma = this.prisma;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SessionWhereInput = {
      tenantId: this.tenantId,
    };

    const [items, total] = await Promise.all([
      prisma.session.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { meetingDate: 'desc' },
      }),
      prisma.session.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }
}