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
  isTraining?: boolean;
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

  async sendText(toPhone: string, body: string) {
    if (!toPhone) {
      return;
    }

    const token = this.ensureEnv('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.ensureEnv('WHATSAPP_PHONE_NUMBER_ID');

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

  async sendPasswordResetCode(toPhone: string, code: string) {
    const body = [
      'Nuru password reset',
      '',
      `Your Nuru reset code is ${code}.`,
      '',
      'If you did not request this, you can ignore this message.',
    ]
      .filter(Boolean)
      .join('\n');

    await this.sendText(toPhone, body);
  }

  async sendInvoice(toPhone: string, invoice: InvoiceWhatsAppPayload) {
    const issueDateStr = invoice.issueDate.toLocaleDateString();
    const linesPreview = invoice.items
      .slice(0, 3)
      .map(
        (item) =>
          `- ${item.productName} x ${item.quantity} @ ${item.unitPrice} = ${item.lineTotal}`,
      )
      .join('\n');

    const moreLines =
      invoice.items.length > 3
        ? `\n+ ${invoice.items.length - 3} more item(s)...`
        : '';

    const header = invoice.isTraining
      ? ['TRAINING MODE – DEMO RECEIPT (NO REAL SALE)', '']
      : [];

    const body = [
      ...header,
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

    await this.sendText(toPhone, body);
  }

  async sendConstitutionUpdate(toPhone: string, payload: {
    interestRate: string;
    lateFineAmount: string;
    maxLoanRatio: string;
  }) {
    const body = [
      'Chama constitution updated:',
      '',
      `- Interest rate: ${payload.interestRate}`,
      `- Late fine: ${payload.lateFineAmount}`,
      `- Max loan ratio: ${payload.maxLoanRatio}`,
      '',
      'These rules now apply to new loans.',
      '',
      `- Nuru (tenant ${this.tenantId})`,
    ]
      .filter(Boolean)
      .join('\n');

    await this.sendText(toPhone, body);
  }
}