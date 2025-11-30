import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';
import { InventoryService } from '../../inventory/core/InventoryService';

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
            })),
          },
        },
        include: { items: true },
      });

      return invoice;
    });
  }

  async postInvoice(id: string, locationId: string, userId?: string | null) {
    if (!locationId) {
      throw new Error('locationId is required to post an invoice');
    }

    const prisma = this.prisma;

    // Load invoice and items first
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: this.tenantId },
      include: { items: true },
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

    return updated;
  }
}