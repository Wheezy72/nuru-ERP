import { Router } from 'express';
import { GatewayService } from '../../../shared/payments/GatewayService';
import { requireAuth } from '../../../shared/middleware/requireRole';

const router = Router();

// Initiate card/bank payment (authenticated)
router.post('/initiate', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { tenantId?: string } | undefined;
    if (!user?.tenantId) {
      return res.status(400).json({ message: 'Tenant context is missing' });
    }

    const { invoiceId, amount, email } = req.body as {
      invoiceId?: string;
      amount?: number;
      email?: string;
    };

    if (!invoiceId) {
      return res.status(400).json({ message: 'invoiceId is required' });
    }

    const gateway = new GatewayService(user.tenantId);
    const result = await gateway.initiateCardPayment(invoiceId, amount, email);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Gateway callback / IPN (unauthenticated)
// Designed to be called by Pesapal (or another gateway) once payment is completed.
router.post('/callback', async (req, res, next) => {
  try {
    const tenantId = (req.query.tenantId as string | undefined) || undefined;
    const invoiceId =
      (req.query.invoiceId as string | undefined) ||
      (req.body?.merchant_reference as string | undefined) ||
      (req.body?.invoice_id as string | undefined);

    if (!tenantId || !invoiceId) {
      // eslint-disable-next-line no-console
      console.error(
        'Missing tenantId or invoiceId on gateway callback. Check PESAPAL_NOTIFICATION_ID / IPN configuration.'
      );
      return res.status(400).json({ message: 'Invalid callback context' });
    }

    const status =
      (req.body?.status as string | undefined) ||
      (req.body?.payment_status as string | undefined) ||
      (req.body?.payment_status_description as string | undefined) ||
      '';
    const statusLower = status.toString().toLowerCase();

    const isSuccess =
      statusLower.includes('success') ||
      statusLower.includes('completed') ||
      statusLower === 'paid' ||
      statusLower === 'completed';

    if (!isSuccess) {
      return res.json({ message: 'Callback received, payment not successful' });
    }

    const gatewayRef =
      (req.body?.transaction_id as string | undefined) ||
      (req.body?.order_tracking_id as string | undefined) ||
      (req.body?.reference as string | undefined) ||
      'unknown';

    const gateway = new GatewayService(tenantId);
    await gateway.markInvoicePaid(invoiceId, gatewayRef);

    res.json({ message: 'Callback processed' });
  } catch (err) {
    next(err);
  }
});

export default router;