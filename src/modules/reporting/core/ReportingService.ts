import { Prisma, TaxRate } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

export class ReportingService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  async getSalesCsv(range: { startDate: Date; endDate: Date }) {
    const prisma = this.prisma;

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: this.tenantId,
        status: { in: ['Posted', 'Partial', 'Paid'] },
        issueDate: {
          gte: range.startDate,
          lt: range.endDate,
        },
      },
      include: {
        customer: true,
      },
      orderBy: {
        issueDate: 'asc',
      },
    });

    const header = ['InvoiceNo', 'IssueDate', 'Customer', 'Status', 'TotalAmount'];

    const rows = invoices.map((inv) => [
      inv.invoiceNo,
      inv.issueDate.toISOString(),
      inv.customer?.name ?? '',
      inv.status,
      inv.totalAmount.toString(),
    ]);

    return this.toCsv([header, ...rows]);
  }

  async getInventoryCsv() {
    const prisma = this.prisma;

    const products = await prisma.product.findMany({
      where: {
        tenantId: this.tenantId,
      },
      include: {
        defaultUom: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const header = ['Product', 'SKU', 'Category', 'Quantity', 'UoM'];

    const rows: string[][] = [];

    for (const product of products) {
      const agg = await prisma.stockQuant.aggregate({
        where: {
          tenantId: this.tenantId,
          productId: product.id,
        },
        _sum: {
          quantity: true,
        },
      });

      const qtyDecimal = agg._sum.quantity ?? new Prisma.Decimal(0);

      rows.push([
        product.name,
        product.sku,
        product.category ?? '',
        qtyDecimal.toString(),
        product.defaultUom?.name ?? '',
      ]);
    }

    return this.toCsv([header, ...rows]);
  }

  async getTaxDetails(range: { startDate: Date; endDate: Date }) {
    const prisma = this.prisma;

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: this.tenantId,
        status: { in: ['Posted', 'Paid'] },
        issueDate: {
          gte: range.startDate,
          lt: range.endDate,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        issueDate: 'asc',
      },
    });

    const result = invoices.map((inv) => {
      let base16 = new Prisma.Decimal(0);
      let base8 = new Prisma.Decimal(0);

      for (const item of inv.items) {
        const amount = item.lineTotal as unknown as Prisma.Decimal;
        const rate = item.taxRate as TaxRate;
        if (rate === 'VAT_16') {
          base16 = base16.add(amount);
        } else if (rate === 'VAT_8') {
          base8 = base8.add(amount);
        }
      }

      const taxable = base16.add(base8);
      const vat16 = base16.mul(0.16);
      const vat8 = base8.mul(0.08);

      return {
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        issueDate: inv.issueDate,
        taxableAmount: Number(taxable.toString()),
        vat16: Number(vat16.toString()),
        vat8: Number(vat8.toString()),
      };
    });

    return result;
  }

  async getTaxCsv(range: { startDate: Date; endDate: Date }) {
    const rows = await this.getTaxDetails(range);

    const header = [
      'InvoiceNo',
      'IssueDate',
      'TaxableAmount',
      'VAT16',
      'VAT8',
    ];

    const csvRows: string[][] = [
      header,
      ...rows.map((row) => [
        row.invoiceNo,
        row.issueDate.toISOString(),
        row.taxableAmount.toString(),
        row.vat16.toString(),
        row.vat8.toString(),
      ]),
    ];

    return this.toCsv(csvRows);
  }

  async getMemberStatementPdf(memberId: string, range: { startDate: Date; endDate: Date }) {
    const prisma = this.prisma;
    const PDFDocument = (await import('pdfkit')).default;

    const member = await prisma.member.findFirst({
      where: {
        tenantId: this.tenantId,
        id: memberId,
      },
      include: {
        accounts: {
          include: {
            transactions: {
              where: {
                createdAt: {
                  gte: range.startDate,
                  lt: range.endDate,
                },
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    const doc = new PDFDocument({ margin: 40 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk as Buffer));
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    doc.fontSize(18).text('Chama Member Statement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Member: ${member.name}`);
    doc.text(`Period: ${range.startDate.toDateString()} - ${range.endDate.toDateString()}`);
    doc.moveDown();

    doc.fontSize(12).text('Accounts Summary:', { underline: true });
    doc.moveDown(0.5);

    member.accounts.forEach((account) => {
      const credits = account.transactions
        .filter((tx) => tx.type === 'Credit')
        .reduce(
          (acc, tx) => acc.add(tx.amount as unknown as Prisma.Decimal),
          new Prisma.Decimal(0)
        );
      const debits = account.transactions
        .filter((tx) => tx.type === 'Debit')
        .reduce(
          (acc, tx) => acc.add(tx.amount as unknown as Prisma.Decimal),
          new Prisma.Decimal(0)
        );

      doc.fontSize(11).text(`Account: ${account.type}`);
      doc.fontSize(10).text(`  Credits (Contributions): ${credits.toString()}`);
      doc.fontSize(10).text(`  Debits (Payouts/Dividends): ${debits.toString()}`);
      doc.moveDown(0.5);
    });

    doc.end();
    const pdfBuffer = await pdfPromise;
    return pdfBuffer;
  }

  private toCsv(rows: string[][]): string {
    return rows
      .map((row) =>
        row
          .map((value) => {
            if (value == null) return '';
            const needsQuotes = /[",\n]/.test(value);
            const escaped = value.replace(/"/g, '""');
            return needsQuotes ? `"${escaped}"` : escaped;
          })
          .join(',')
      )
      .join('\n');
  }
}