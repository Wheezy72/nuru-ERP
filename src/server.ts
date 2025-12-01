import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

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
import stockTakeRoutes from './modules/stocktake/http/stocktake.routes';

const app = express();

const corsOrigin = process.env.FRONTEND_ORIGIN || '*';

app.use(
  cors({
    origin: corsOrigin,
  })
);
app.use(express.json());
app.use(morgan('dev'));

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
app.use('/api/stocktakes', stockTakeRoutes);

app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Nuru API listening on port ${port}`);
});