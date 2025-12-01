import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/AppShell';
import { LandingPage } from '@/pages/marketing/LandingPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProductsPage } from '@/pages/inventory/ProductsPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { InvoiceDetailPage } from '@/pages/invoices/InvoiceDetailPage';
import { MembersPage } from '@/pages/chama/MembersPage';
import { AuditLogPage } from '@/pages/settings/AuditLogPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { PosPage } from '@/pages/pos/PosPage';
import { InventoryLookupPage } from '@/pages/inventory/InventoryLookupPage';
import { TaxDetailsPage } from '@/pages/reporting/TaxDetailsPage';
import { PayCasualsPage } from '@/pages/hr/PayCasualsPage';
import { SetupPage } from '@/pages/settings/SetupPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/inventory/lookup" element={<InventoryLookupPage />} />
          <Route path="/inventory/products" element={<ProductsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/payroll/casuals" element={<PayCasualsPage />} />
          <Route path="/chama/members" element={<MembersPage />} />
          <Route path="/reporting/tax-details" element={<TaxDetailsPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/settings/audit-log" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}