import { Prisma, EmployeeStatus } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type PayrollEntryInput = {
  employeeId: string;
  daysWorked: number;
  channel?: 'CASH' | 'MPESA';
};

export class PayrollService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async listActiveEmployees() {
    const prisma = this.prisma;

    const employees = await prisma.employee.findMany({
      where: {
        tenantId: this.tenantId,
        status: EmployeeStatus.ACTIVE,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return employees;
  }

  async createRun(entries: PayrollEntryInput[]) {
    const prisma = this.prisma;

    if (!entries || entries.length === 0) {
      throw new Error('No payroll entries provided');
    }

    const employeeIds = [...new Set(entries.map((e) => e.employeeId))];
    const employees = await prisma.employee.findMany({
      where: {
        tenantId: this.tenantId,
        id: { in: employeeIds },
        status: EmployeeStatus.ACTIVE,
      },
    });

    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    let totalAmount = new Prisma.Decimal(0);
    const now = new Date();

    for (const entry of entries) {
      const employee = employeeMap.get(entry.employeeId);
      if (!employee) {
        continue;
      }

      const days = entry.daysWorked > 0 ? entry.daysWorked : 0;
      if (days <= 0) {
        continue;
      }

      const rate = employee.dailyRate as unknown as Prisma.Decimal;
      const amount = rate.mul(days);
      totalAmount = totalAmount.add(amount);

      const referenceParts = [
        'Payroll',
        employee.name,
        `(${days} day(s) @ ${rate.toString()})`,
      ];
      if (entry.channel === 'MPESA') {
        referenceParts.push('[M-Pesa payout]');
      } else {
        referenceParts.push('[Cash]');
      }

      await prisma.transaction.create({
        data: {
          tenantId: this.tenantId,
          amount,
          type: 'Debit',
          reference: referenceParts.join(' '),
          createdAt: now,
        },
      });
    }

    return {
      totalAmount: Number(totalAmount.toString()),
      count: entries.length,
    };
  }
}