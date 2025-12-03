import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';

import inventoryRoutes from './modules/inventory/http/inventory.routes';
import customerRoutes from './modules/customers/http/customer.routes';
import invoiceRoutes from './modules/invoicing/http/invoice.routes';
import chamaRoutes from './modules/chama/http/chama.routes';
import systemRoutes from './modules/system/http/system.routes';
import tenantRoutes from './modules/tenant/http/tenant.routes';
import dashboardRoutes from './modules/dashboard/http/dashboard.routes';
import reportingRoutes from './modules/reporting/http/reporting.routes';
import authRoutes from './modules/auth/http/auth.routes';
import mpesaRoutes from './modules/payments/http/mpesa.routes';
import gatewayRoutes from './modules/payments/http/gateway.routes';
import stockTakeRoutes from './modules/stocktake/http/stocktake.routes';
import payrollRoutes from './modules/payroll/http/payroll.routes';
import procurementRoutes from './modules/procurement/http/procurement.routes';
import manufacturingRoutes from './modules/manufacturing/http/manufacturing.routes';
import projectRoutes from './modules/projects/http/project.routes';
import accountingRoutes from './modules/accounting/http/accounting.routes';
import { prisma as basePrisma } from './shared/prisma/client';
import { idempotencyMiddleware } from './shared/middleware/idempotency';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
  });
}

const app = express();

const corsOrigin = process.env.FRONTEND_ORIGIN || '*';

// Basic security headers. CSP can be tightened per deployment.
app.use(
  helmet({
    contentSecurityPolicy: false, // keep simple; frontend can define its own CSP
  }),
);

app.use(
  cors({
    origin: corsOrigin,
  }),
);

if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
}

app.use(express.json());
app.use(morgan('dev'));

// Idempotency handling for write operations (POST/PUT/PATCH) using Idempotency-Key header.
app.use(idempotencyMiddleware);

app.get('/health', async (_req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (basePrisma as any).$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      db: 'ok',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      uptime: process.uptime(),
      db: 'error',
      error: err?.message || String(err),
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/chama', chamaRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/payments/mpesa', mpesaRoutes);
app.use('/api/payments/gateway', gatewayRoutes);
app.use('/api/stocktakes', stockTakeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/manufacturing', manufacturingRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/accounting', accountingRoutes);

if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  },
);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Nuru API listening on port ${port}`);
});