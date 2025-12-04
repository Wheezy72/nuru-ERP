import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../prisma/client';
import { MpesaService } from './MpesaService';

export type MpesaReconcileRow = {
  transactionId: string;
  amount: number;
  accountReference?: string;
  msisdn?: string;
  timestamp?: string;
};

export class MpesaReconciliationService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  static parseCsv(csv: string): MpesaReconcileRow[] {
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return [];
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const idx = (candidates: string[]) =>
      header.findIndex((h) =>
        candidates.some((c) => h.includes(c.toLowerCase())),
      );

    const txIdx = idx([
      'transid',
      'transaction id',
      'mpesa receipt',
      'mpesareceiptnumber',
      'm-pesa receipt',
    ]);
    const amountIdx = idx(['amount', 'transamount', 'paid in']);
    const acctIdx = idx([
      'account reference',
      'bill reference',
      'accountref',
      'accref',
    ]);
    const msisdnIdx = idx(['msisdn', 'phone', 'payer']);
    const tsIdx = idx(['date', 'transdate', 'timestamp', 'transaction date']);

    const rows: MpesaReconcileRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (txIdx < 0 || amountIdx < 0) {
        continue;
      }
      const tx = cols[txIdx] || '';
      const amtRaw = cols[amountIdx] || '';
      const amount = Number(
        amtRaw.replace(/[^\d.-]/g, ''),
      );

      if (!tx || !Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      const row: MpesaReconcileRow = {
        transactionId: tx,
        amount,
      };

      if (acctIdx >= 0 && cols[acctIdx]) {
        row.accountReference = cols[acctIdx];
      }
      if (msisdnIdx >= 0 && cols[msisdnIdx]) {
        row.msisdn = cols[msisdnIdx];
      }
      if (tsIdx >= 0 && cols[tsIdx]) {
        row.timestamp = cols[tsIdx];
      }

      rows.push(row);
    }

    return rows;
  }

  async reconcileRows(rows: MpesaReconcileRow[]) {
    const prisma = this.prisma;
    const mpesa = new MpesaService(this.tenantId);

    const results: {
      row: MpesaReconcileRow;
      status: 'matched' | 'skipped' | 'unmatched';
      reason?: string;
      invoiceId?: string;
    }[] = [];

    for (const row of rows) {
      if (!row.transactionId || !Number.isFinite(row.amount) || row.amount <= 0) {
        results.push({
          row,
          status: 'skipped',
          reason: 'invalid-row',
        });
        continue;
      }

      const existingTx = await prisma.transaction.findFirst({
        where: {
          tenantId: this.tenantId,
          reference: row.transactionId,
          type: 'Credit',
        },
      });

      if (existingTx) {
        results.push({
          row,
          status: 'skipped',
          reason: 'already-recorded',
          invoiceId: existingTx.invoiceId || undefined,
        });
        continue;
      }

      let invoice = null;

      if (row.accountReference) {
        invoice = await prisma.invoice.findFirst({
          where: {
            tenantId: this.tenantId,
            invoiceNo: row.accountReference,
          },
        });
      }

      if (!invoice) {
        invoice = await prisma.invoice.findFirst({
          where: {
            tenantId: this.tenantId,
            OR: [
              { invoiceNo: row.transactionId },
              row.accountReference
                ? {
                    invoiceNo: {
                      contains: row.accountReference,
                      mode: 'insensitive',
                    },
                  }
                : undefined,
            ].filter(Boolean) as any,
          },
        });
      }

      if (!invoice) {
        await prisma.systemLog.create({
          data: {
            tenantId: this.tenantId,
            userId: null,
            action: 'MPESA_UNMATCHED_PAYMENT',
            entityType: 'Invoice',
            entityId: row.accountReference || row.transactionId,
            metadata: row,
          },
        });

        results.push({
          row,
          status: 'unmatched',
          reason: 'invoice-not-found',
        });
        continue;
      }

      const updated = await mpesa.markInvoicePaid(
        invoice.id,
        row.amount,
        row.transactionId,
      );

      if (!updated) {
        results.push({
          row,
          status: 'skipped',
          reason: 'markInvoicePaid-returned-null',
          invoiceId: invoice.id,
        });
        continue;
      }

      results.push({
        row,
        status: 'matched',
        invoiceId: updated.id,
      });
    }

    return results;
  }
}