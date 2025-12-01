import axios from 'axios';
import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../prisma/client';

export class GatewayService {
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
      // eslint-disable-next-line no-console
      console.error(`${key} not configured for card/bank gateway integration`);
      throw new Error(`${key} not configured`);
    }
    return value;
  }

  private async getPesapalAccessToken(baseUrl: string) {
    const consumerKey = this.ensureEnv('PESAPAL_CONSUMER_KEY');
    const consumerSecret = this.ensureEnv('PESAPAL_CONSUMER_SECRET');

    const response = await axios.post(
      `${baseUrl}/api/Auth/RequestToken`,
      {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const { token } = response.data as { token: string };
    return token;
  }

  /**
   * Initiate a card/bank payment using Pesapal v3.
   * Returns a redirect URL where the customer can complete payment.
   */
  async initiateCardPayment(invoiceId: string, amount?: number, email?: string) {
    const prisma = this.prisma;
    const baseUrl = this.ensureEnv('PESAPAL_BASE_URL');
    const notificationId = process.env.PESAPAL_NOTIFICATION_ID || '';

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const currency = process.env.PESAPAL_CURRENCY || 'KES';
    const redirectBase = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
    const callbackUrl = `${redirectBase}/invoices`;

    const billingEmail =
      email || invoice.customer.email || 'customer@example.com';

    const token = await this.getPesapalAccessToken(baseUrl);

    const payload = {
      id: invoice.id,
      currency,
      amount:
        typeof amount === 'number'
          ? amount
          : Number(invoice.totalAmount.toString()),
      description: `Invoice ${invoice.invoiceNo}`,
      callback_url: callbackUrl,
      notification_id: notificationId || undefined,
      billing_address: {
        email_address: billingEmail,
        phone_number: invoice.customer.phone || '',
        country_code: 'KE',
        first_name: invoice.customer.name || 'Customer',
        last_name: '',
      },
    };

    const response = await axios.post(
      `${baseUrl}/api/Transactions/SubmitOrderRequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data as { redirect_url?: string };
    if (!data.redirect_url) {
      throw new Error('Gateway did not return a redirect URL');
    }

    return {
      redirectUrl: data.redirect_url,
    };
  }

  /**
   * Mark an invoice as paid via card/bank, logging the gateway reference.
   * Intended to be called from the payment gateway webhook.
   */
  async markInvoicePaid(invoiceId: string, gatewayRef: string) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
    });

    if (!invoice) {
      // eslint-disable-next-line no-console
      console.error(
        `Invoice ${invoiceId} not found for tenant ${this.tenantId} during gateway callback`
      );
      return;
    }

    if (invoice.status === 'Paid') {
      return;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'Paid' },
    });

    await prisma.systemLog.create({
      data: {
        tenantId: this.tenantId,
        userId: null,
        action: 'INVOICE_PAID_CARD',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: {
          previousStatus: invoice.status,
          newStatus: 'Paid',
          gatewayRef,
        },
      },
    });

    return updated;
  }
}