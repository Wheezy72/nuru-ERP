# Nuru Developer Guide (High-Level)

This is a concise map of the Nuru codebase and runtime, aimed at helping you debug and extend the system quickly. You can print this file to PDF from your editor if you need a document.

---

## 1. Top-Level Layout

- `Nuru.md` – Product brief: what Nuru is, target users, philosophy.
- `MANUAL.md` – Operational manual and architecture notes.
- `backend/` – Node.js + TypeScript API, Prisma, integrations (M‑Pesa, WhatsApp, card gateway).
- `frontend/` – React + TypeScript SPA, TailwindCSS, React Query.

---

## 2. Backend Overview

### 2.1 Entry point

- `backend/src/server.ts`
  - Sets up Express app, CORS, Helmet, logging, Sentry (optional).
  - Registers all route modules under `/api/*`.
  - Uses `idempotencyMiddleware` to enforce idempotent POST/PUT/PATCH via `Idempotency-Key` header.
  - Health check: `GET /health` (DB connectivity + uptime).

### 2.2 Shared infrastructure (`backend/src/shared`)

- `prisma/client.ts`
  - `createTenantPrismaClient(tenantId)` wraps Prisma client and sets PostgreSQL GUC for row‑level security.
- `middleware/requireRole.ts`
  - `requireAuth` – attaches `req.user` (JWT-based).
  - `requireRole([...])` – guards routes by user role.
- `middleware/idempotency.ts`
  - Stores idempotent responses in `IdempotencyKey` table.
- `whatsapp/WhatsAppService.ts`
  - `sendText` – low-level WhatsApp Cloud API call.
  - `sendPasswordResetCode` – OTP template.
  - `sendInvoice` – invoice summary + optional “TRAINING MODE” header.
  - `sendConstitutionUpdate` – chama constitution update template.
- `mpesa/MpesaService.ts`
  - `initiateStkPush` – Daraja STK push (Paybill/Till).
  - `markInvoicePaid` – idempotent update of invoice + transaction + GL + loyalty (skips training invoices).
- `mpesa/MpesaReconciliationService.ts`
  - Processes bulk M‑Pesa rows (CSV or structured) and:
    - Fuzzily matches to invoices (by invoiceNo / account reference).
    - Calls `MpesaService.markInvoicePaid`.
    - Logs unmatched rows (`MPESA_UNMATCHED_PAYMENT`).
- `payments/GatewayService.ts`
  - Pesapal v3 integration: card/bank checkout and webhook handling (GL + loyalty).
- `finance` (if present)
  - Shared helpers for tax math and rounding.
- `import/csv.ts`
  - Simple CSV parser (`parseCsv`) and helper to map rows into M‑Pesa reconciliation rows.

---

## 3. Backend Modules

Each module generally has `core/` (business logic) and `http/` (routes).

### 3.1 Inventory – `backend/src/modules/inventory`

- Tracks products, UoMs, stock quants, and batches.
- Supports FEFO via `ProductBatch` + `StockQuant`.
- Key pieces:
  - `inventory.routes.ts` – list/create/update products, locations, stock lookup, stock adjustments.
  - Uses `StockQuant` and UoM ratios to prevent negative stock.

### 3.2 Invoicing – `backend/src/modules/invoicing`

Core:

- `InvoiceService.ts`
  - `createInvoice` – builds draft invoices, supports:
    - Tax codes (`TaxRate`).
    - Coupons (`couponCode` handled in a previous pass).
    - Training invoices (`isTraining` flag propagated from header).
  - `postInvoice` – moves `Draft` → `Posted`:
    - Non-training:
      - Decrements stock via `InventoryService.adjustStock`.
      - Writes `INVOICE_POSTED` in `SystemLog`.
      - Sends WhatsApp invoice summary.
      - Triggers GL via `AccountingService.recordInvoicePosted`.
    - Training:
      - Marks as `Posted` but **skips** stock and GL.
      - Writes `INVOICE_POSTED_TRAINING`.
      - Sends WhatsApp receipt clearly as “TRAINING MODE”.
  - `recordExternalPayment` (manual payments) – creates `INVOICE_PAID_MANUAL` logs.

HTTP:

- `invoice.routes.ts`
  - CRUD and posting endpoints.
  - Reads `x-training-mode` header to set `isTraining` during invoice creation.

### 3.3 Payments – `backend/src/modules/payments`

- `http/mpesa.routes.ts`
  - `/stkpush` – authenticated STK initiation.
  - `/callback` – Safaricom webhook (delegates to `MpesaService.markInvoicePaid`).
  - `/reconcile` – ADMIN:
    - Accepts `{ csv, rows }`.
    - Uses `MpesaReconciliationService` to bulk reconcile M‑Pesa statement.
- `http/gateway.routes.ts`
  - Card/bank initiation + webhook for Pesapal.

### 3.4 Dashboard – `backend/src/modules/dashboard`

Core:

- `DashboardService.ts`
  - `getSummary(range)` – returns:
    - `metrics` – total sales, cash at hand.
    - `cashFlow` – income vs expenses by day.
    - `chamaTrust` – pot size vs loans.
    - `stockAlerts` – below-min stock.
    - `insights` – simple “smart” insight list.
    - `taxLiability` – VAT buckets (16%, 8%, exempt, zero-rated).
    - `debtors` – invoice-level balances due.
    - `risk` – advanced risk signals:
      - `nuruScore` (0–100): higher = cleaner.
      - Counters over last 30 days:
        - `manualPayments` (`INVOICE_PAID_MANUAL` logs).
        - `stockVariances` (`STOCKTAKE_VARIANCE` logs).
        - `voidLikeDiscounts` (`COUPON_APPLIED` logs).
        - `trainingInvoices` (invoices with `isTraining = true`).
  - Most sales/tax/debtor queries explicitly **exclude training invoices**.

### 3.5 Reporting – `backend/src/modules/reporting`

- CSV exports (sales, inventory).
- `getTaxDetails` – detail view backing Regulator / eTIMS card.

### 3.6 System – `backend/src/modules/system`

- `SystemLogService.ts` + `system.routes.ts`:
  - Paginated audit log (`/api/system/logs`) for ADMIN.
  - Driven by `SystemLog` table with indices `(tenantId)` and `(tenantId, action)`.

### 3.7 Other modules

- `chama` – members, accounts, loans, constitution.
- `payroll` – employees and casual payment flows.
- `procurement` – purchase orders, supplier invoices; GL postings.
- `manufacturing` – BOMs, production orders; GL for manufacturing.
- `projects` – project-coded invoices and POs for job costing.
- `accounting` – GL account setup, invoice/PO postings, depreciation.

---

## 4. Importer & Reconciliation

### 4.1 Data import – `backend/src/modules/import`

Core:

- `ImportService.ts`
  - `importCustomers({ rows, dryRun })`
    - Map `name`, `phone`, `email`, `kraPin` (case-insensitive headers).
    - Upsert by email/phone.
  - `importProducts({ rows, dryRun })`
    - Map `name`, `sku`, `category`, `defaultUom`, `defaultPrice`, `minStockQuantity`.
    - Resolves UoM by name; upserts by SKU or name.

HTTP:

- `http/import.routes.ts`
  - `POST /api/import/customers`
  - `POST /api/import/products`
  - Accept `{ csv, rows, dryRun }`.
  - Uses shared CSV parser to support simple spreadsheet exports.

### 4.2 M‑Pesa reconciliation

- `MpesaReconciliationService.ts`
  - `parseCsv` lives in `shared/import/csv.ts`.
  - `reconcileRows`:
    - Skips duplicates (existing `Transaction` with same receipt).
    - Matches invoice by `accountReference` and/or `transactionId`.
    - Calls `MpesaService.markInvoicePaid` (which respects training invoices).
    - Logs unmatched rows.

---

## 5. Seed Data

File: `backend/prisma/seed.ts`

What it does:

- Wipes core tables in dependency order.
- Creates multiple demo tenants:
  - `Nuru Hardware (SME)` – main retail seed.
  - `Wamama Pamoja (Chama)`.
  - `Safari Haulage & Plant Hire` (fleet).
  - `St. Mary’s Academy` (school).
  - `GreenLeaf Agrovet & Vet`.
  - `Nairobi Furniture Works` (manufacturing).
  - `City Builders Ltd` (construction/projects).
- For each:
  - Users: `admin+{tenantId}`, `manager+{tenantId}`, `cashier+{tenantId}` + `admin@nuru.app`.
  - Chart of accounts via `AccountingService.ensureDefaultAccounts()`.

Key points for analytics:

- `seedInventory` + `seedInvoices` for Nuru Hardware:
  - 12 months of invoices, randomized payment statuses.
  - Dead-stock candidate (first product) rarely sold in last 90 days.
- `seedRiskAndCouponFixtures`:
  - Adds:
    - Active coupon `FUNDIS10` with redemptions + `COUPON_APPLIED` logs.
    - Several `INVOICE_PAID_MANUAL` system logs + corresponding transactions.
    - A small blind stocktake with `STOCKTAKE_VARIANCE` log.
    - A few training invoices (`isTraining = true`).
  - Ensures Nuru Score and risk card have visible signals out of the box.
- Fleet, School, Agrovet, Manufacturing, Construction seeders:
  - Provide realistic inventory, invoices (including project-coded), and GL entries so dashboards and reports have meaningful graphs.

---

## 6. Frontend Overview

### 6.1 Entry and routing

- `frontend/src/main.tsx`
  - React entry point, React Query provider, CSS.
- `frontend/src/App.tsx`
  - Routes:
    - `/` – Marketing landing page.
    - `/login` – Auth.
    - AppShell-wrapped:
      - `/dashboard` – Overview dashboard.
      - `/pos` – POS workspace.
      - `/inventory/lookup`, `/inventory/products`.
      - `/customers`, `/invoices`, `/invoices/:id`.
      - `/procurement/purchase-orders`, `/manufacturing`, `/projects`, `/accounting/assets`.
      - `/payroll/casuals`, `/chama/members`.
      - `/reporting/tax-details`.
      - Settings: `/setup`, `/settings/audit-log`, `/settings/coupons`, `/settings/import`.

### 6.2 App shell and navigation

- `AppShell.tsx`
  - Layout: sidebar + header + content outlet.
  - Theme toggle:
    - `nuru_theme` in localStorage (`default` vs `outdoor`).
    - Sets `data-theme` on `<html>` to drive `index.css`.
  - Training Mode toggle:
    - `nuru_training` in localStorage.
    - Sets `data-training` on `<html>` → amber background in `index.css`.
    - Also used by `apiClient` to send `x-training-mode` header.
- `components/Sidebar.tsx`
  - Groups routes under:
    - Overview, Sales, Inventory, CRM, Maker, Planner, HR, Banking, Settings.
  - Hides modules based on role and tenant feature flags (`useTenantFeatures`).
  - For school tenants:
    - Products → Fees.
    - Customers → Students.

### 6.3 API client and query layer

- `lib/apiClient.ts`
  - Axios instance with:
    - `Authorization: Bearer <token>`.
    - `x-tenant-id`, `x-user-role`, `x-user-id`.
    - `x-training-mode` added when `nuru_training === '1'`.
- `lib/queryClient.tsx`
  - React Query client.

### 6.4 Key pages

- `pages/dashboard/DashboardPage.tsx`
  - Fetches `/dashboard/summary`.
  - Cards:
    - Total Sales, Cash at Hand.
    - Cash Flow chart.
    - AI Insights (simple heuristics).
    - Regulator / eTIMS Tax Liability.
    - Chama Trust.
    - Debtors.
    - Stock Alerts.
    - Nuru Score:
      - Shows score and counts of manual payments, stock variances, coupon usage.

- `pages/pos/PosPage.tsx`
  - Minimal POS:
    - Scan or type product (search via `/inventory/products`).
    - Build in-memory cart.
    - Checkout → creates invoice via `/invoices`.
    - Honors Training Mode header for practice invoices.

- `pages/settings/AuditLogPage.tsx`
  - Admin view of `SystemLog` (who did what, when).

- `pages/settings/CouponsPage.tsx`
  - Manage coupons used by discount engine.

- `pages/settings/ImportPage.tsx`
  - CSV importer for:
    - Customers (or students).
    - Products (or fees).
  - Supports dry-run validation vs actual import.

---

## 7. Comments and Extension Points

The codebase deliberately keeps comments focused on non-obvious logic:

- Seed script:
  - Inline comments around analytics fixtures so it’s clear why certain logs exist.
- Dashboard:
  - Risk logic (`getRiskSignals`) is localized; the `risk` block is safe to extend with more factors.
- WhatsAppService:
  - Each template is grouped by purpose; adding a new “important event” notification is usually:
    - Add a method here.
    - Call it from the relevant module (e.g., invoice paid, chama loan issued).
- MpesaReconciliationService & ImportService:
  - Core matching and import rules are centralized in these classes; future tweaks (e.g., new CSV layouts) should go there.

When extending:

1. **Add models** in `prisma/schema.prisma`, run `prisma migrate dev`, `prisma generate`.
2. **Add core logic** under `backend/src/modules/<domain>/core`.
3. **Expose routes** under `backend/src/modules/<domain>/http`.
4. **Wire UI** under `frontend/src/pages/...` and navigation in `Sidebar.tsx`.
5. Keep sensitive actions logged via `SystemLog`.

This guide plus `MANUAL.md` and `Nuru.md` should be enough context to reason about new features and debug flows without digging blindly through the tree.