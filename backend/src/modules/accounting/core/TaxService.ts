import axios from 'axios';
import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

/**
 * TaxService encapsulates integration with a tax authority (e.g. KRA eTIMS).
 * It is designed around a simple queue: when invoices are posted, they are added
 * to TaxQueueEntry as PENDING, and this service is used to push and update status.
 */
export class TaxService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  private ensureEnv(key: string) {
    const value = process.env[key];
    if (!value) {
      throw new Error(`${key} not configured for tax integration`);
    }
    return value;
  }

  /**
   * Enqueue an invoice for tax signing. If it already exists in the queue, do nothing.
   */
  async enqueueInvoice(invoiceId: string) {
    const prisma = this.prisma;

    const existing = await prisma.taxQueueEntry.findFirst({
      where: {
        tenantId: this.tenantId,
        invoiceId,
      },
    });

    if (existing) {
      return existing;
    }

    const entry = await prisma.taxQueueEntry.create({
      data: {
        tenantId: this.tenantId,
        invoiceId,
        status: 'PENDING',
      },
    });

    return entry;
  }

  /**
   * Process a single TaxQueueEntry: fetch invoice payload, send to tax API,
   * and update queue status accordingly. Intended to be called from a worker or
   * an admin-only HTTP route.
   */
  async processEntry(id: string) {
    const prisma = this.prisma;

    const entry = await prisma.taxQueueEntry.findFirst({
      where: {
        id,
        tenantId: this.tenantId,
      },
      include: {
        invoice: {
          include: {
            customer: true,
            items: true,
          },
        },
      },
    });

    if (!entry) {
      throw new Error('Tax queue entry not found');
    }

    if (entry.status === 'SENT') {
      return entry;
    }

    const invoice = entry.invoice;
    if (!invoice) {
      throw new Error('Invoice not found for tax queue entry');
    }

    const baseUrl = this.ensureEnv('TAX_API_BASE_URL');
    const apiKey = this.ensureEnv('TAX_API_KEY');

    // Minimal payload; adapt field names to match the actual authority API.
    const payload = {
      invoiceNo: invoice.invoiceNo,
      issueDate: invoice.issueDate.toISOString(),
      customerName: invoice.customer.name,
      customerPin: invoice.customer.kraPin,
      totalAmount: (invoice.totalAmount as unknown as Prisma.Decimal).toString(),
      items: invoice.items.map((item) => ({
        productId: item.productId,
        lineTotal: (item.lineTotal as unknown as Prisma.Decimal).toString(),
        taxRate: item.taxRate,
        hsCode: item.hsCode,
      })),
    };

    let controlCode: string | undefined;
    let qrCodeSignature: string | undefined;

    try {
      const res = await axios.post(
        `${baseUrl}/invoices/sign`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = res.data as {
        controlCode?: string;
        qrCodeSignature?: string;
      };

      controlCode = data.controlCode;
      qrCodeSignature = data.qrCodeSignature;

      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            // we do not yet persist these fields; wire them in once Invoice has extra columns
            // controlCode,
            // qrCodeSignature,
          },
        });

        await tx.taxQueueEntry.update({
          where: { id: entry.id },
          data: {
            status: 'SENT',
            lastError: null,
            attempts: { increment: 1 },
          },
        });
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Tax API error';

      await prisma.taxQueueEntry.update({
        where: { id: entry.id },
        data: {
          status: 'FAILED',
          lastError: message,
          attempts: { increment: 1 },
        },
      });

      throw new Error(`Failed to send invoice to tax API: ${message}`);
    }

    return {
      entryId: entry.id,
      controlCode,
      qrCodeSignature,
    };
  }

  /**
   * Process all PENDING or FAILED entries up to a maximum batch size.
   * Failed entries will be retried.
   */
  async processPending(max = 20) {
    const prisma = this.prisma;

    const entries = await prisma.taxQueueEntry.findMany({
      where: {
        tenantId: this.tenantId,
        status: { in: ['PENDING', 'FAILED'] },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: max,
    });

    const results: {
      id: string;
      status: string;
      error?: string;
    }[] = [];

    for (const entry of entries) {
      try {
        await this.processEntry(entry.id);
        results.push({ id: entry.id, status: 'SENT' });
      } catch (err: any) {
        results.push({
          id: entry.id,
          status: 'FAILED',
          error: err?.message || String(err),
        });
      }
    }

    return results;
  }
}