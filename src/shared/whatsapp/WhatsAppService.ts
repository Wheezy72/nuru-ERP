import axios from 'axios';

type InvoiceWhatsAppItem = {
  productName: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

type InvoiceWhatsAppPayload = {
  invoiceNo: string;
  issueDate: Date;
  totalAmount: string;
  customerName: string | null;
  items: InvoiceWhatsAppItem[];
};

export class WhatsAppService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private ensureEnv(key: string) {
    const value = process.env[key];
    if (!value) {
      // eslint-disable-next-line no-console
      console.error(`${key} not configured for WhatsApp integration`);
      throw new Error(`${key} not configured`);
    }
    return value;
  }

  async sendInvoice(toPhone: string, invoice: InvoiceWhatsAppPayload) {
    if (!toPhone) {
      return;
    }

    const token = this.ensureEnv('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.ensureEnv('WHATSAPP_PHONE_NUMBER_ID');

    const issueDateStr = invoice.issueDate.toLocaleDateString();
    const linesPreview = invoice.items
      .slice(0, 3)
      .map(
        (item) =>
          `- ${item.productName} x ${item.quantity} @ ${item.unitPrice} = ${item.lineTotal}`
      )
      .join('\n');

    const moreLines =
      invoice.items.length > 3
        ? `\n+ ${invoice.items.length - 3} more item(s)...`
        : '';

    const body = [
      `Hi ${invoice.customerName || 'Customer'},`,
      '',
      `Your invoice ${invoice.invoiceNo} dated ${issueDateStr} is ready.`,
      `Total: ${invoice.totalAmount}`,
      '',
      'Summary:',
      linesPreview,
      moreLines,
      '',
      'Thank you.',
      '',
      `- Nuru (tenant ${this.tenantId})`,
    ]
      .filter(Boolean)
      .join('\n');

    await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: {
          body,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}