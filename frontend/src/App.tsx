import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/AppShell';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProductsPage } from '@/pages/inventory/ProductsPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { MembersPage } from '@/pages/chama/MembersPage';
import { AuditLogPage } from '@/pages/settings/AuditLogPage';
import { LoginPage } from '@/pages/auth/LoginPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/inventory/products" element={<ProductsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/chama/members" element={<MembersPage />} />
          <Route path="/settings/audit-log" element={<AuditLogPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}