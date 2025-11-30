import axios from 'axios';
import { Prisma } from '@prisma/client';
import { createTenantPrismaClient } from '../prisma/client';

type StkPushParams = {
  amount: number;
  phoneNumber: string;
  invoiceId: string;
  accountReference?: string;
  description?: string;
};

export class MpesaService {
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
      console.error(`${key} not configured for M-Pesa integration`);
      throw new Error(`${key} not configured`);
    }
    return value;
  }

  private async getAccessToken() {
    const consumerKey = this.ensureEnv('MPESA_CONSUMER_KEY');
    const consumerSecret = this.ensureEnv('MPESA_CONSUMER_SECRET');
    const baseUrl = this.ensureEnv('MPESA_BASE_URL');

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      'base64'
    );

    const response = await axios.get(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const { access_token } = response.data as { access_token: string };
    return access_token;
  }

  async initiateStkPush(params: StkPushParams) {
    const { amount, phoneNumber, invoiceId } = params;

    const baseUrl = this.ensureEnv('MPESA_BASE_URL');
    const shortCode = this.ensureEnv('MPESA_SHORTCODE');
    const passKey = this.ensureEnv('MPESA_PASSKEY');
    const callbackBase = this.ensureEnv('MPESA_CALLBACK_URL');

    const timestamp = this.buildTimestamp();
    const password = Buffer.from(`${shortCode}${passKey}${timestamp}`).toString(
      'base64'
    );

    const accessToken = await this.getAccessToken();

    const callbackUrl = `${callbackBase}?tenantId=${encodeURIComponent(
      this.tenantId
    )}&invoiceId=${encodeURIComponent(invoiceId)}`;

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: params.accountReference || invoiceId,
      TransactionDesc: params.description || `Invoice ${invoiceId}`,
    };

    const response = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  }

  async markInvoicePaid(invoiceId: string) {
    const prisma = this.prisma;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: this.tenantId },
    });

    if (!invoice) {
      // eslint-disable-next-line no-console
      console.error(
        `Invoice ${invoiceId} not found for tenant ${this.tenantId} during M-Pesa callback`
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
        action: 'INVOICE_PAID_MPESA',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: {
          previousStatus: invoice.status,
          newStatus: 'Paid',
        },
      },
    });

    return updated;
  }

  private buildTimestamp(): string {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const MM = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const HH = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }
}