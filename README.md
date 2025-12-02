# Nuru ERP

Multi-tenant ERP for African businesses, with inventory, invoicing, chama/table-banking, projects, simple manufacturing and a Kenyan tax/compliance backbone.

<p align="center">
  <img src="https://img.shields.io/badge/Stack-PERN-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/API-Node.js%2018+-339933?logo=node.js&logoColor=white&style=flat-square" />
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white&style=flat-square" />
  <img src="https://img.shields.io/badge/DB-PostgreSQL-336791?logo=postgresql&logoColor=white&style=flat-square" />
  <img src="https://img.shields.io/badge/Multi--tenant-RLS%20secured-111827?style=flat-square" />
</p>

---

## Contents

- [What Nuru Is](#what-nuru-is)
- [Feature Highlights](#feature-highlights)
- [Architecture](#architecture)
- [Quickstart (Local Dev)](#quickstart-local-dev)
- [Environment Variables (Quick Reference)](#environment-variables-quick-reference)
- [Seed Data & Demo Tenants](#seed-data--demo-tenants)
- [Production Checklist](#production-checklist)

---

## What Nuru Is

Nuru is an opinionated ERP built around how real Kenyan and African SMEs work:

- Multi-tenant from day one, with strict PostgreSQL Row Level Security.
- Core ERP domains:
  - Sales, invoicing, POS, debtors.
  - Inventory & procurement.
  - General ledger and basic fixed assets.
  - Chama/table-banking and microfinance.
  - Simple manufacturing (BOM + production orders).
  - Projects / job costing.
- Deeply local:
  - M-Pesa STK Push, Pesapal card/bank.
  - KRA-friendly VAT breakdown and CSV exports.
  - WhatsApp notifications for invoices and reminders.

It’s meant to be powerful but still understandable for a hardware shop, chama, school, or small manufacturer.

---

## Feature Highlights

### Core Finance & Accounting

- General Ledger:
  - Per-tenant chart of accounts (Assets, Liabilities, Equity, Revenue, Expenses).
  - Double-entry journals:
    - Invoice posted → DR Accounts Receivable / CR Sales.
    - Invoice paid (M-Pesa, card, manual) → DR Cash / CR Accounts Receivable.
    - Purchase order received → DR Cost of Goods Sold / CR Cash.
  - Trial balance aggregation per account (debit, credit, net).

- Accounts Receivable:
  - Invoices (Draft, Posted, Partial, Paid) with line items and tax codes.
  - Partial payments, payment history, balance computation.
  - Debtors list and WhatsApp reminders.

- Accounts Payable (basic but real):
  - SupplierInvoice + SupplierInvoiceItem models.
  - Record supplier invoices (bills) and supplier payments.
  - AP aging buckets: 0–30, 31–60, 61–90, 90+ days.

- Fixed Assets:
  - Asset registry:
    - purchaseDate, purchaseCost, lifespanYears, salvageValue, accumulatedDepreciation.
  - Depreciation runs:
    - DepreciationRun table keyed by period (YYYY-MM).
    - Straight-line depreciation runner:
      - DR Depreciation Expense / CR Accumulated Depreciation.
    - Assets & Depreciation screen in the UI.

### Sales, POS, CRM

- POS for day-to-day sales.
- Customers (or “Students” for school tenants) with KRA PIN, phone, email.
- Invoices:
  - Itemised, with TaxRate (VAT_16, VAT_8, EXEMPT, ZERO).
- Loyalty:
  - Earn points when paying invoices.
  - Redeem points against future invoices.

### Inventory & Procurement

- Inventory:
  - Products with:
    - UoM hierarchy (base + derived units).
    - Min stock quantity, categories, active flags.
  - Stock per location and batch, with expiries for Agrovet scenarios.
  - Stocktakes and variances.

- Procurement:
  - Suppliers.
  - PurchaseOrders and PurchaseOrderItems.
  - Receiving a PO:
    - Increments stock.
    - Posts GL entry (DR COGS / CR Cash).

### Manufacturing & Projects

- Manufacturing (for simple assembly):
  - BillOfMaterial (BOM): “4 legs + 1 top = 1 table”.
  - ProductionOrder:
    - PLANNED → IN_PROGRESS → COMPLETED.
    - Integrates with inventory.

- Projects / job costing:
  - Project model with status (OPEN, COMPLETED, CANCELLED).
  - Project-coded invoices and POs.
  - Project summary (revenue, cost from POs, profit).

### Chama / Microfinance & HR

- Chama:
  - Members, accounts, contributions, loans, guarantors.
  - ChamaConstitution (interest, fines, max loan ratio).
  - Member balances and group-level views.

- HR / Payroll (light):
  - Employees (CASUAL, PERMANENT) with daily rate.
  - “Pay Casuals” workflow to capture daily wages.

### Integrations & UX

- Payments:
  - M-Pesa STK Push (Daraja).
  - Pesapal v3 (card/bank).
  - Manual external payments (cheque, EFT).

- Messaging:
  - WhatsApp Cloud API:
    - Invoice summaries.
    - Payment reminders.

- UI:
  - React + Vite + Tailwind.
  - Role-aware sidebar:
    - Admin / Manager / Cashier.
  - Simple vs Full modes based on tenant features.
  - PWA-capable (installable app; offline-aware routing for basics).

---

## Architecture

- Backend:
  - Node.js, Express, TypeScript.
  - Prisma ORM on PostgreSQL.
  - Multi-tenant Prisma client wrapper:
    - Sets `app.current_tenant_id` per request for RLS.
  - Domain modules:
    - `auth`, `inventory`, `invoicing`, `accounting`, `procurement`, `manufacturing`,
      `projects`, `chama`, `payroll`, `reporting`, `dashboard`, `system`, `tenant`.
  - Health & observability:
    - `/health` endpoint (DB connectivity).
    - Optional Sentry integration (`SENTRY_DSN`).
    - Health-check script (`backend/scripts/health-check.ts`).
    - Backup script (`backend/scripts/backup-db.sh`).

- Frontend:
  - React + Vite + TypeScript.
  - Tailwind CSS.
  - TanStack Query for data fetching/caching.
  - Role-aware navigation and feature-aware sidebar.
  - API client pointing to `VITE_API_URL` (defaults to `http://localhost:4000/api`).

---

## Quickstart (Local Dev)

### 1. Prerequisites

- Node.js 18+ (20 recommended).
- PostgreSQL (e.g. 14+).
- Git (if cloning).
- Optional:
  - Redis (for caching).
  - Sentry account (for error tracking).

### 2. Clone the repo

```bash
git clone https://github.com/your-org/nuru.git
cd nuru
```

(or extract the ZIP if you have it that way)

### 3. Create the database

Connect to Postgres and create a DB (example):

```sql
CREATE DATABASE nuru_dev;
```

Build a `DATABASE_URL` string, e.g.:

```text
postgresql://username:password@localhost:5432/nuru_dev
```

### 4. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/nuru_dev
JWT_SECRET=change_me_to_a_long_random_string

# Optional (for integrations)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_CALLBACK_URL=https://your-public-host/api/payments/mpesa/callback
FRONTEND_ORIGIN=http://localhost:5173
SENTRY_DSN= # optional
```

Run migrations:

```bash
npx prisma migrate dev
```

(Optional) Seed demo data:

```bash
npm run seed
```

Start the backend:

```bash
npm run dev
# listens on http://localhost:4000
```

### 5. Frontend setup

```bash
cd ../frontend
npm install
```

Create `frontend/.env.local` (optional; the default works for localhost):

```env
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Start the frontend:

```bash
npm run dev
# usually on http://localhost:5173
```

### 6. Log in

If you ran the seed:

- Backend created:
  - Tenants such as:
    - Nuru Hardware (SME)
    - Wamama Pamoja (Chama)
    - Safari Haulage & Plant Hire
    - St. Mary’s Academy
    - GreenLeaf Agrovet
    - Nairobi Furniture Works
    - City Builders Ltd
  - Users:
    - `admin@nuru.app` (global admin on Nuru Hardware)
    - `admin+<tenantId>@nuru.app`
    - `manager+<tenantId>@nuru.app`
    - `cashier+<tenantId>@nuru.app`
  - All with password: `password123`.

To find tenant IDs:

```sql
SELECT id, name, code FROM "Tenant";
```

Then:

- Open http://localhost:5173/login.
- Use:
  - Email: `admin@nuru.app`
  - Password: `password123`
  - Tenant ID: the `id` of `Nuru Hardware (SME)`.

---

## Environment Variables (Quick Reference)

Backend (backend/.env):

- Required:
  - `DATABASE_URL` – Postgres connection string.
  - `JWT_SECRET` – long random secret for JWT signing.
  - `FRONTEND_ORIGIN` – CORS origin (e.g. `http://localhost:5173`).

- Optional but recommended:
  - `GOOGLE_CLIENT_ID` – for Google login.
  - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` – WhatsApp Cloud API.
  - `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`,
    `MPESA_PASSKEY`, `MPESA_BASE_URL`, `MPESA_CALLBACK_URL` – M-Pesa STK.
  - `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_BASE_URL`,
    `PESAPAL_NOTIFICATION_ID`, `PESAPAL_CURRENCY` – Pesapal card/bank.
  - `SENTRY_DSN` – Sentry project DSN for error monitoring.

Frontend (frontend/.env.local):

- `VITE_API_URL` – defaults to `http://localhost:4000/api` if not set.
- `VITE_GOOGLE_CLIENT_ID` – must match backend’s `GOOGLE_CLIENT_ID` for Google login.

For full details on M-Pesa, WhatsApp, and PWA configuration, see `MANUAL.md` / `Nuru.md` if present.

---

## Seed Data & Demo Tenants

The seed script (`backend/prisma/seed.ts`) creates:

- Nuru Hardware (SME):
  - Retail hardware/FMCG, 12 months of invoices, customers, stock, debtors.
- Wamama Pamoja (Chama):
  - 20 members, 6 months of contributions and loans.
- Safari Haulage & Plant Hire:
  - Fleet/plant hire services, invoices, payments, chama link.
- St. Mary’s Academy:
  - School fees across terms, students as customers.
- GreenLeaf Agrovet:
  - Agrovet stock with batches and expiries.
- Nairobi Furniture Works:
  - Manufacturing (BOM & production orders) for tables.
- City Builders Ltd:
  - Construction projects with project-coded POs and invoices.

These give you realistic data to explore dashboards, tax reports, GL, projects, chama, and more.

---

## Production Checklist

When you’re ready to use Nuru beyond a local demo, consider:

- Database:
  - Managed Postgres with automated backups.
  - Apply migrations via `prisma migrate deploy`.
- Backups:
  - Use `backend/scripts/backup-db.sh` (or your own) on a schedule.
  - Test restore at least once.
- Monitoring & logs:
  - Enable Sentry (`SENTRY_DSN`) for error tracking.
  - Ship logs to a central place (ELK, CloudWatch, etc.).
- Security:
  - Use HTTPS everywhere.
  - Use strong, unique secrets for JWT, DB, M-Pesa, WhatsApp, Google, Pesapal.
- Access control:
  - Configure role visibility and Simple vs Full mode per tenant (via tenant features).
  - Review Audit Log (`/settings/audit-log`) regularly.

Nuru is designed to be understandable and flexible. If something feels heavy or missing for your use case, adjust the modules and UI rather than trying to turn it into a copy of a much larger ERP. The codebase is structured to make that kind of change manageable.