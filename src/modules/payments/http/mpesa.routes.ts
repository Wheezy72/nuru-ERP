import { Router } from 'express';
import { MpesaService } from '../../../shared/mpesa/MpesaService';
import { requireAuth } from '../../../shared/middleware/requireRole';

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
        'Missing tenantId or invoiceId on M-Pesa callback. Check MPESA_CALLBACK_URL configuration.'
      );
      return res.status(400).json({ message: 'Invalid callback context' });
    }

    const body = req.body as any;
    const resultCode =
      body?.Body?.stkCallback?.ResultCode ??
      body?.body?.stkCallback?.ResultCode ??
      null;

    if (resultCode !== 0) {
      // Non-successful payment; acknowledge without changing invoice
      return res.json({ message: 'Callback received, payment not successful' });
    }

    const mpesa = new MpesaService(tenantId);
    await mpesa.markInvoicePaid(invoiceId);

    res.json({ message: 'Callback processed' });
  } catch (err) {
    next(err);
  }
});

export default router;