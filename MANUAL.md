# Nuru Master Manual

Operating System for the African Enterprise

---

## 1. Vision

Nuru is a multi-tenant, RLS-secure back-office for African SMEs, schools, SACCOs, and fleet operators. It is designed around:

- Compliance by construction:
  - Row-Level Security (RLS) in PostgreSQL for tenant isolation.
  - SystemLog for every sensitive action (posting invoices, loan changes, manual payments).
- Trust:
  - Every invoice posting, payment, and configuration change is attributable to a user + tenant.
  - WhatsApp notifications make the system visible to the real-world actors.
- Kadogo economics:
  - Inventory, invoices, and even casual labour are treated as “units” that can be broken down, tracked, and priced in small increments.
  - The system is tuned for weak networks, mobile-first usage, and hybrid cash/digital flows.

Verticals supported:

- Retail / FMCG (Nuru Hardware)
- Chama / SACCO (Wamama Pamoja)
- Fleet & Plant Hire (Safari Haulage)
- Schools (St. Mary’s Academy)

---

## 2. Architecture Overview

- Backend:
  - Node.js + TypeScript
  - Express HTTP server (`src/server.ts`)
  - Prisma ORM with PostgreSQL and Row Level Security (`prisma/` + `src/shared/prisma/client.ts`)
- Frontend:
  - React + TypeScript
  - Vite + TailwindCSS
  - React Query for data fetching
- Integration surfaces:
  - M-Pesa STK Push (Daraja) for mobile money payments
  - WhatsApp Cloud API for messaging
  - Pesapal v3 for card/bank payments
  - Email (optional) via the mail module

Key backend modules:

- `src/modules/inventory` – Products, stock quants, stocktakes.
- `src/modules/invoicing` – Invoices, posting, KRA-ready tax breakdown.
- `src/modules/payments` – M-Pesa (Daraja) and generic card/bank gateway.
- `src/modules/chama` – Members, accounts, loans, and chama constitution.
- `src/modules/payroll` – Casual/employee payments for fleet and other tenants.
- `src/modules/dashboard` – Summary metrics, cashflow, tax liability, and “smart insights”.
- `src/modules/auth` – JWT login (email/password + Google), WhatsApp-based password reset.

---

## 3. Setup Guide

### 3.1 Prerequisites

- Node.js (LTS)
- Yarn or npm
- PostgreSQL 14+
- A public HTTPS endpoint if you intend to receive webhooks (Ngrok, localtunnel, or a proper domain).

### 3.2 Environment Variables

Create `.env` in the backend root (same level as `src/` and `prisma/`):

Required core:

- `DATABASE_URL` – PostgreSQL connection string.
- `JWT_SECRET` – Secret used for signing JWTs.
- `FRONTEND_ORIGIN` – e.g. `http://localhost:5173` or the deployed frontend URL.

M-Pesa (Daraja):

- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_BASE_URL`
  - Sandbox: `https://sandbox.safaricom.co.ke`
  - Live: `https://api.safaricom.co.ke`
- `MPESA_CALLBACK_URL`
  - E.g. `https://your-public-host/api/payments/mpesa/callback`.

WhatsApp (Meta Cloud API):

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
  - See WhatsApp Cloud API documentation; these map to your Business phone and app token.

Pesapal v3 (Card/Bank):

- `PESAPAL_CONSUMER_KEY`
- `PESAPAL_CONSUMER_SECRET`
- `PESAPAL_BASE_URL`
  - Sandbox: `https://cybqa.pesapal.com/pesapalv3`
  - Live: `https://pay.pesapal.com/pesapalv3`
- `PESAPAL_NOTIFICATION_ID` (optional but recommended)
  - IPN ID obtained after registering your IPN URL with Pesapal.
- `PESAPAL_CURRENCY` (optional, default: `KES`)

Other useful:

- `PORT` – Backend port (default 4000).

### 3.3 Backend Setup

Install dependencies:

```bash
cd backend
yarn install
# or
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate deploy
```

Seed demo data:

```bash
npx ts-node prisma/seed.ts
```

Start the server:

```bash
yarn dev
# or
npm run dev
```

The API should be available at `http://localhost:4000/api`.

### 3.4 Frontend Setup

```bash
cd frontend
yarn install
# or
npm install
```

Create `.env` inside `frontend/`:

```bash
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Run the dev server:

```bash
yarn dev
# or
npm run dev
```

Visit `http://localhost:5173`.

---

## 4. Payments Integrations

### 4.1 M-Pesa (Daraja) – Mobile Money

Backend flow (summary):

- Endpoint: `POST /api/payments/mpesa/stkpush` (authenticated)
- Body:

  - `phoneNumber`: `2547XXXXXXXX`
  - `amount`: numeric
  - `invoiceId`: invoice UUID
  - `accountReference` (optional)
  - `description` (optional)

- Backend:

  - Uses `MpesaService.initiateStkPush`.
  - Builds password and timestamp from `MPESA_SHORTCODE` + `MPESA_PASSKEY`.
  - Sets callback URL as `MPESA_CALLBACK_URL?tenantId=...&invoiceId=...`.

- Callback:

  - Endpoint: `POST /api/payments/mpesa/callback`
  - If ResultCode == 0, the invoice is marked as `Paid` and a `SystemLog` entry is written:

    - `action: INVOICE_PAID_MPESA`

Frontend:

- On Invoices page, “Pay with M-Pesa” button:

  - Defaults to the customer’s phone if known.
  - Falls back to a prompt asking for M-Pesa phone number.

Notes:

- You must configure `MPESA_CALLBACK_URL` on your Safaricom app with the public backend URL.
- Ensure all M-Pesa environment variables are present (see above).

### 4.2 Pesapal v3 – Card / Bank Payments

Backend:

- Service: `src/shared/payments/GatewayService.ts`
- Method: `initiateCardPayment(invoiceId, amount?, email?)`

  - Looks up invoice and customer.
  - Authenticates with Pesapal:

    - `POST {PESAPAL_BASE_URL}/api/Auth/RequestToken`
    - Body: `{ consumer_key, consumer_secret }`

  - Submits order request:

    - `POST {PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`
    - Body includes:

      - `id`: invoice ID
      - `currency`: from `PESAPAL_CURRENCY` or `KES`
      - `amount`: invoice amount (or override)
      - `description`: `Invoice ${invoiceNo}`
      - `callback_url`: front-end invoices page
      - `notification_id`: `PESAPAL_NOTIFICATION_ID` (if provided)
      - `billing_address`: email, phone, name

  - Returns a `redirectUrl` from Pesapal.

- Initiation endpoint:

  - `POST /api/payments/gateway/initiate` (authenticated)
  - Body: `{ invoiceId, amount?, email? }`
  - Returns: `{ redirectUrl }`

- Webhook / IPN endpoint:

  - `POST /api/payments/gateway/callback`
  - Expects:
    - `tenantId` and `invoiceId` (via query or body fields like `merchant_reference`).
    - `status` / `payment_status` / `payment_status_description`.
    - `transaction_id` / `order_tracking_id` / `reference`.
  - On success:
    - Invokes `GatewayService.markInvoicePaid(invoiceId, gatewayRef)`.
    - Marks invoice as `Paid`.
    - Writes `SystemLog` with:

      - `action: INVOICE_PAID_CARD`
      - Metadata includes `gatewayRef`.

Frontend:

- On Invoices page, “Pay with Card” button:

  - Calls `/api/payments/gateway/initiate`.
  - Redirects browser to the `redirectUrl`.
  - Styled with a slate/blue theme to visually distinguish it from the green M-Pesa button.

Gateway configuration:

- In Pesapal’s portal:
  - Configure the IPN (notification) URL to point to your ` /api/payments/gateway/callback`.
  - Use the same base URL as your backend.

### 4.3 WhatsApp – Notifications & Password Reset

WhatsAppService:

- `src/shared/whatsapp/WhatsAppService.ts`
- Uses `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` to send:

  - Invoice summaries to customers when invoices are posted.
  - Constitution updates for Chama.
  - Password reset codes for users.

Auth:

- `POST /api/auth/forgot-password`:

  - Body: `{ identifier }` (email or phone).
  - Generates a 6-digit code, stores in `PasswordResetToken`, sends via WhatsApp.

- `POST /api/auth/reset-password`:

  - Body: `{ identifier, token, newPassword }`.
  - Validates token and updates password.

---

## 5. User Guide

### 5.1 Blind Stock Take (Retail)

Concept:

- Staff physically count items at locations without seeing system quantities.
- Differences are reconciled later; every adjustment is logged.

Steps:

1. Log in as Admin or Manager for the retail tenant (e.g. Nuru Hardware).
2. Navigate to:
   - Inventory → Products: review product list.
   - Inventory → Lookup: quick stock checks.

3. Prepare locations:

   - Ensure `Location` records exist (Main Shop, etc.).
   - Ensure products have `minStockQuantity` set so stock alerts work.

4. Run a stocktake:

   - Use the stocktake module endpoints (`/api/stocktakes`) to create a new stocktake session.
   - Field staff count quantities in the physical location and submit counts via the UI (or API).
   - Nuru compares `StockQuant` vs. counted amounts and suggests adjustments.

5. Post results:

   - Once counts are reconciled, posting the stocktake updates `StockQuant`.
   - A `SystemLog` entry records:

     - Who posted.
     - Before/after quantities.

Best practices:

- Always run stocktakes outside peak hours.
- Use `minStockQuantity` to drive replenishment decisions — the dashboard stock alerts will show low-stock items.

### 5.2 Fleet Invoicing (Safari Haulage)

Context:

- Fleet tenant is seeded as `Safari Haulage & Plant Hire`.
- Products represent services (lorry hire, plant hire, taxis) with time-based units (Day, Trip).

Steps:

1. Log in as Admin/Manager for Safari Haulage.

2. Create service inventory:

   - Units of measure: `Day`, `Trip`.
   - Products:
     - “Isuzu FRR (6-Ton) – Lorry Hire”
     - “Caterpillar Backhoe – Plant Hire”
     - “Toyota Fielder (Uber) – Taxi”

3. Create invoices:

   - For each hire:

     - Pick customer (e.g. Mota Construction Ltd).
     - Select service product (lorry/plant/taxi).
     - Enter quantity in days.
     - Set unit price (daily rate).

   - Save as Draft.

4. Post invoices:

   - From the Invoices page, post Draft invoices (requires `default_location_id`).
   - This:
     - Adjusts “capacity stock” (treated as a large stock pool for demo).
     - Logs `INVOICE_POSTED` in `SystemLog`.

5. Record payments:

   - Mobile money:

     - Use “Pay with M-Pesa” on the invoice.
     - Customer receives STK push.
     - When callback arrives, invoice is marked as `Paid` and `INVOICE_PAID_MPESA` is logged.

   - Card/bank:

     - Use “Pay with Card” to redirect customer to Pesapal.
     - Once IPN callback is processed, invoice is marked as `Paid` and `INVOICE_PAID_CARD` is logged.

   - Manual bank transfers:

     - Use “Record External” on the invoice.
     - Enter amount, method (EFT/Cheque), reference, date.
     - Invoice is marked `Paid` and `INVOICE_PAID_MANUAL` is logged with `note: Manual Entry - Verification Needed`.

6. Dashboard:

   - Fleet invoices and payments contribute to:

     - Daily cashflow chart (now aligned to East Africa Time).
     - Tax liability (VAT computations).

### 5.3 Chama Loans (Wamama Pamoja)

Context:

- Wamama Pamoja tenant is configured with:

  - Members.
  - Accounts (ShareCapital, Deposits, MerryGoRound).
  - ChamaConstitution (interest rate, late fines, max loan ratio).
  - Transactions for contributions and some seeded loans.

Concepts:

- Member: person in the chama.
- Account: money buckets per member (shares, deposits, merry-go-round).
- Loan: principal issued to a member with interest and status (Active, Pending, etc.).

Steps:

1. Log in as Admin for Wamama Pamoja.

2. Review members:

   - Navigate to Chama → Members.
   - Each member has:
     - Name, phone, email.
     - Backing accounts.

3. Configure constitution:

   - Backed by `ChamaConstitution`:

     - `interestRate` (per period).
     - `lateFineAmount`.
     - `maxLoanRatio` (e.g. 2x deposits).

   - Updates can trigger WhatsApp notifications to members via `WhatsAppService.sendConstitutionUpdate`.

4. Issue a loan:

   - Create a `Loan` record for a member.
   - Set principal, interest rate, and issuedAt.
   - Optionally attach guarantors.

5. Record repayments:

   - Use Transactions to record repayments into member accounts.
   - Loans can transition from `Active` to `Settled` based on balance.

6. Monitor trust & risk:

   - Dashboard’s “Chama Trust” card:

     - Pot size: sum of account balances.
     - Loans issued: sum of active/pending principals.

   - Smart insights surface:

     - Churn risk (members not contributing/borrowing).
     - Dead stock (for retail tenants).
     - Stockout predictions.

---

## 6. Maintenance & Operations

### 6.1 Running Migrations

When the schema changes:

1. Update `prisma/schema.prisma`.
2. Create a migration:

   ```bash
   npx prisma migrate dev --name descriptive_migration_name
   ```

3. Deploy to other environments:

   ```bash
   npx prisma migrate deploy
   ```

4. Regenerate Prisma client:

   ```bash
   npx prisma generate
   ```

### 6.2 Seeding Demo Tenants

To reset and reseed the demo data:

```bash
npx ts-node prisma/seed.ts
```

This:

- Clears core tables (SystemLog, Transactions, Invoices, Stock, Accounts, Loans, Members, Tenants, etc.).
- Creates four tenants:

  - Nuru Hardware (retail)
  - Wamama Pamoja (Chama)
  - Safari Haulage & Plant Hire (fleet)
  - St. Mary’s Academy (school)

- Seeds:

  - Inventory and customers for Nuru Hardware.
  - Invoices and transactions.
  - Chama members, accounts, and loans.
  - Fleet services, customers, invoices, and transactions.
  - School fee products and students.

### 6.3 Health Check Script

A consolidated script lives at `scripts/health-check.ts`.

What it does:

- Verifies presence of critical env vars:

  - `DATABASE_URL`, `JWT_SECRET`, `MPESA_CONSUMER_KEY`, `PESAPAL_CONSUMER_KEY`.

- Pings the database:

  - Runs `SELECT 1` via Prisma.

- Scans code for `TODO` comments.

Usage:

```bash
npx ts-node scripts/health-check.ts
```

Exit codes:

- `0`: OK (env + DB connectivity).
- `1`: Missing env vars or DB unreachable.

### 6.4 Updating the App

1. Pull latest code.
2. Run:

   ```bash
   # Backend
   cd backend
   npm install
   npx prisma migrate deploy
   npx prisma generate

   # Frontend
   cd ../frontend
   npm install
   ```

3. Restart services (PM2, Docker, systemd, or your chosen process manager).

---

## 7. UX & Design Notes

- Buttons:

  - Primary actions (like posting invoices or core actions) use the global `bg-primary` (green) palette.
  - M-Pesa:

    - “Pay with M-Pesa” button uses a green theme (`bg-emerald-600`) to match the mobile money brand.

  - Card/Bank (Pesapal):

    - “Pay with Card” uses a slate-blue theme (`bg-slate-600`) to visually distinguish it from green M-Pesa and signal a different rails.

- Layout:

  - `AppShell` provides a consistent sidebar + top content layout.
  - `Sidebar` groups routes:

    - Overview, Sales, Inventory, CRM, HR, Banking, Settings.

  - Tenant type-aware labels:

    - For SCHOOL tenants:
      - Products → Fees
      - Customers → Students

- Tables:

  - `DataTable` component provides selection, column visibility toggles, pagination, and bulk actions.

- Accessibility:

  - Buttons and inputs use Tailwind + focus-visible rings.

---

## 8. Security & Compliance

- Multi-tenant isolation:

  - All Prisma queries go through `createTenantPrismaClient(tenantId)`, which sets `app.current_tenant_id` GUC on every transaction.
  - PostgreSQL RLS policies enforce `tenantId = app.current_tenant_id()` for all tenant-scoped tables.

- Authentication:

  - JWT-based, with email/password and optional Google login.
  - Tokens store `sub`, `tenantId`, `role`, `email`.

- Auditing:

  - `SystemLog` records:

    - Who performed an action.
    - What entity was affected (Invoice, Loan, etc.).
    - Metadata payloads for later investigation.

- Manual overrides:

  - Manual payments and admin actions explicitly log `Manual Entry - Verification Needed`.

---

## 9. Glossary

- Tenant: A business entity (shop, chama, fleet company, school).
- Member: A participant in a chama.
- Customer: Buyer in retail or student in school context.
- Invoice: A bill issued to a customer/student.
- StockQuant: Quantity of a product at a location and unit-of-measure.
- Chama: Savings group or SACCO.
- STK Push: M-Pesa prompt on customer phone.
- IPN: Instant Payment Notification (Pesapal/gateway webhook).

---

Nuru is built to be extended. You can add new verticals (e.g., healthcare, housing co-ops) by:

- Adding a new tenant type in seed data and Tenant features.
- Binding vertical-specific logic into existing primitives (Inventory, Invoices, Transactions, SystemLog).
- Integrating sector-specific rails (insurance, NHIF, etc.) via the shared payment and messaging layers.