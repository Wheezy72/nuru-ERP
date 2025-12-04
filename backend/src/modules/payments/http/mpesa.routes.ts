import { Router } from 'express';
import { MpesaService } from '../../../shared/mpesa/MpesaService';
import { MpesaReconciliationService } from '../../../shared/mpesa/MpesaReconciliationService';
import { requireAuth, requireRole } from '../../../shared/middleware/requireRole';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

const router = Router();

// Initiate STK Push (authenticated)
router.post('/stkpush', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { tenantId?: string } | undefined;
    if (!user?.tenantId) {
      return res.status(400).json({ message: 'Tenant context is missing' });
    }

    const { phoneNumber, amount, invoiceId, accountReference, description } =
      req.body as {
        phoneNumber?: string;
        amount?: number;
        invoiceId?: string;
        accountReference?: string;
        description?: string;
      };

    if (!phoneNumber || !amount || !invoiceId) {
      return res.status(400).json({
        message: 'phoneNumber, amount and invoiceId are required',
      });
    }

    const mpesa = new MpesaService(user.tenantId);
    const result = await mpesa.initiateStkPush({
      phoneNumber,
      amount,
      invoiceId,
      accountReference,
      description,
    });

    res.json(result);
  } catch (err: any) {
    next(err);
  }
});

// M-Pesa callback (unauthenticated, called by Safaricom)
router.post('/callback', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const invoiceId = req.query.invoiceId as string | undefined;

    if (!tenantId || !invoiceId) {
      // eslint-disable-next-line no-console
      console.error(
        'Missing tenantId or invoiceId on M-Pesa callback. Check MPESA_CALLBACK_URL configuration.',
      );
      return res.status(400).json({ message: 'Invalid callback context' });
    }

    const body = req.body as any;
    const resultCode =
      body?.Body?.stkCallback?.ResultCode ??
      body?.body?.stkCallback?.ResultCode ??
      null;

    const prisma = createTenantPrismaClient(tenantId);

    if (resultCode !== 0) {
      // Log failed attempt for audit trail
      try {
        await prisma.systemLog.create({
          data: {
            tenantId,
            userId: null,
            action: 'INVOICE_PAID_MPESA_FAILED',
            entityType: 'Invoice',
            entityId: invoiceId,
            metadata: {
              resultCode,
              raw: body,
            },
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to log INVOICE_PAID_MPESA_FAILED', err);
      }

      // Non-successful payment; acknowledge without changing invoice
      return res.json({ message: 'Callback received, payment not successful' });
    }

    // Extract amount and receipt from callback metadata
    const items =
      body?.Body?.stkCallback?.CallbackMetadata?.Item ??
      body?.body?.stkCallback?.CallbackMetadata?.Item ??
      [];
    let amount = 0;
    let receipt: string | undefined;

    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.Name === 'Amount') {
          amount = Number(item.Value || 0);
        }
        if (item.Name === 'MpesaReceiptNumber') {
          receipt = String(item.Value || '');
        }
      }
    }

    const mpesa = new MpesaService(tenantId);
    await mpesa.markInvoicePaid(invoiceId, amount, receipt);

    res.json({ message: 'Callback processed' });
  } catch (err) {
    next(err);
  }
});

// Bulk reconciliation from M-Pesa CSV or structured rows (authenticated, admin)
router.post(
  '/reconcile',
  requireAuth,
  requireRole(['ADMIN']),
  async (req, res, next) => {
    try {
      const user = (req as any).user as { tenantId?: string } | undefined;
      if (!user?.tenantId) {
        return res.status(400).json({ message: 'Tenant context is missing' });
      }

      const { csv, rows } = req.body as {
        csv?: string;
        rows?: {
          transactionId: string;
          amount: number;
          accountReference?: string;
          msisdn?: string;
          timestamp?: string;
        }[];
      };

      let parsedRows: {
        transactionId: string;
        amount: number;
        accountReference?: string;
        msisdn?: string;
        timestamp?: string;
      }[] = [];

      if (Array.isArray(rows) && rows.length > 0) {
        parsedRows = rows;
      } else if (typeof csv === 'string' && csv.trim().length > 0) {
        parsedRows = MpesaReconciliationService.parseCsv(csv);
      } else {
        return res.status(400).json({
          message: 'Provide either csv (string) or rows (array) in request body',
        });
      }

      const service = new MpesaReconciliationService(user.tenantId);
      const result = await service.reconcileRows(parsedRows);

      res.json({ items: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;