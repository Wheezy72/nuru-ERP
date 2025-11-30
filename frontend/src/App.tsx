import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/AppShell';
import { ProductsPage } from '@/pages/inventory/ProductsPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { MembersPage } from '@/pages/chama/MembersPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/inventory/products" replace />} />
          <Route path="/inventory/products" element={<ProductsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/chama/members" element={<MembersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}