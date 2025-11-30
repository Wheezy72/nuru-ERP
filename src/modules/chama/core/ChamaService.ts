import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';
import { WhatsAppService } from '../../../shared/whatsapp/WhatsAppService';

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
      issuedAt: Date;
      dueDate?: Date;
      guarantors?: { memberId: string; guaranteeAmount: Prisma.Decimal }[];
    },
    userId?: string | null
  ) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const constitution = await tx.chamaConstitution.findFirst({
        where: { tenantId: this.tenantId },
      });

      if (!constitution) {
        throw new Error('Chama constitution is not configured for this tenant');
      }

      // Enforce maxLoanRatio: principal must not exceed ratio * member contributions.
      const contributionAccounts = await tx.account.findMany({
        where: {
          tenantId: this.tenantId,
          memberId: input.borrowerId,
          type: { in: ['ShareCapital', 'Deposits'] as any },
        },
      });

      const totalContributions = contributionAccounts.reduce(
        (acc, account) => acc.add(account.balance),
        new Prisma.Decimal(0)
      );

      const maxAllowed = totalContributions.mul(constitution.maxLoanRatio);
      if (input.principal.gt(maxAllowed)) {
        throw new Error(
          'Requested principal exceeds maximum allowed by Chama constitution'
        );
      }

      const loan = await tx.loan.create({
        data: {
          tenantId: this.tenantId,
          borrowerId: input.borrowerId,
          principal: input.principal,
          interestRate: constitution.interestRate,
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
            interestRate: constitution.interestRate,
            maxLoanRatio: constitution.maxLoanRatio,
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

  async getConstitution() {
    const prisma = this.prisma;
    return prisma.chamaConstitution.findFirst({
      where: { tenantId: this.tenantId },
    });
  }

  async upsertConstitution(
    input: {
      interestRate: Prisma.Decimal;
      lateFineAmount: Prisma.Decimal;
      maxLoanRatio: Prisma.Decimal;
    },
    userId?: string | null
  ) {
    const prisma = this.prisma;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.chamaConstitution.findFirst({
        where: { tenantId: this.tenantId },
      });

      const updated = existing
        ? await tx.chamaConstitution.update({
            where: { id: existing.id },
            data: {
              interestRate: input.interestRate,
              lateFineAmount: input.lateFineAmount,
              maxLoanRatio: input.maxLoanRatio,
            },
          })
        : await tx.chamaConstitution.create({
            data: {
              tenantId: this.tenantId,
              interestRate: input.interestRate,
              lateFineAmount: input.lateFineAmount,
              maxLoanRatio: input.maxLoanRatio,
            },
          });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'CHAMA_CONSTITUTION_CHANGED',
          entityType: 'ChamaConstitution',
          entityId: updated.id,
          metadata: {
            previous: existing
              ? {
                  interestRate: existing.interestRate,
                  lateFineAmount: existing.lateFineAmount,
                  maxLoanRatio: existing.maxLoanRatio,
                }
              : null,
            current: {
              interestRate: updated.interestRate,
              lateFineAmount: updated.lateFineAmount,
              maxLoanRatio: updated.maxLoanRatio,
            },
          },
        },
      });

      // Notify all members with phone numbers via WhatsApp (best-effort).
      try {
        const members = await tx.member.findMany({
          where: { tenantId: this.tenantId, phone: { not: null } },
        });

        const whatsapp = new WhatsAppService(this.tenantId);
        const payload = {
          interestRate: updated.interestRate.toString(),
          lateFineAmount: updated.lateFineAmount.toString(),
          maxLoanRatio: updated.maxLoanRatio.toString(),
        };

        for (const m of members) {
          if (m.phone) {
            // Fire-and-forget per member; failures are logged but do not block.
            // eslint-disable-next-line no-await-in-loop
            await whatsapp.sendConstitutionUpdate(m.phone, payload);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to send WhatsApp notifications for constitution update', err);
      }

      return updated;
    });
  }
}