# Nuru ERP – V1.0

Nuru is a multi-tenant ERP for African enterprises, built on a PERN stack with strict tenant isolation, inventory and invoicing, chama (table-banking) features, and a Neo-Naturalist UI.

This README focuses on what you need to configure to run Nuru in a production-like environment.

## 1. Stack Overview

- Backend: Node.js, Express, Prisma, PostgreSQL
- Frontend: React, Vite, Tailwind, TanStack Query
- Auth: JWT (email/password + optional Google OAuth)
- Data Isolation: tenantId on all tables, designed for PostgreSQL Row Level Security (RLS)
- Extras: PWA support via vite-plugin-pwa, WhatsApp notifications, M-Pesa STK Push integration (Daraja sandbox/production)

## 2. Environment Variables

### 2.1 Backend (.env)

Required for basic operation:

- `DATABASE_URL`
  - PostgreSQL connection string.
  - Example: `postgresql://user:password@localhost:5432/nuru`

- `JWT_SECRET`
  - Strong secret key used to sign JWTs.
  - Example: `JWT_SECRET=change_me_to_a_long_random_string`

Google OAuth (backend verification):

- `GOOGLE_CLIENT_ID`
  - OAuth 2.0 Client ID from Google Cloud (Web application).
  - Used by the backend to verify ID tokens sent from the frontend.
  - If missing, Google login requests will fail with:
    - `Google Client ID not configured`

WhatsApp Business (Cloud API) integration:

- `WHATSAPP_ACCESS_TOKEN`
  - Access token for the WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`
  - The phone number ID associated with your WhatsApp Business account.
- When an invoice is posted, Nuru will attempt to send an invoice summary via WhatsApp to the customer’s phone number.
- If any of these values are missing, WhatsApp notifications will fail with a clear error such as:
  - `WHATSAPP_ACCESS_TOKEN not configured`

M-Pesa (Daraja) integration:

- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_BASE_URL`
- `MPESA_CALLBACK_URL`

Example for sandbox:

```env
MPESA_CONSUMER_KEY=your_sandbox_consumer_key
MPESA_CONSUMER_SECRET=your_sandbox_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_sandbox_passkey
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_CALLBACK_URL=https://your-public-host/api/payments/mpesa/callback
```

Notes:

- `MPESA_BASE_URL`:
  - Use the sandbox URL for development and the production URL for live traffic.
- `MPESA_CALLBACK_URL`:
  - Public URL that Safaricom calls for STK Push callbacks.
  - Nuru will append `?tenantId=...&invoiceId=...` automatically when initiating STK pushes.
- If any of these keys are missing, M-Pesa STK Push calls will throw with a clear error such as:
  - `MPESA_CONSUMER_KEY not configured`

### 2.2 Frontend (.env / .env.local)

Vite expects env variables prefixed with `VITE_`. Some examples:

- `VITE_API_URL`
  - Base URL for the backend API (without trailing slash).
  - Example: `VITE_API_URL=http://localhost:4000/api`

- `VITE_GOOGLE_CLIENT_ID`
  - Same Client ID as `GOOGLE_CLIENT_ID` on the backend.
  - Used by the frontend to initialize Google Identity Services.
  - If missing, the login page will show:
    - `Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in your env.`

## 3. Authentication & Roles

- Users authenticate with:
  - Email + password (tenant-scoped), or
  - Google OAuth (ID token from Google, verified server-side).
- Backend issues JWTs that include:
  - `sub` (user ID)
  - `tenantId`
  - `role` (`ADMIN`, `MANAGER`, or `CASHIER`)
  - `email`
- RBAC:
  - `ADMIN`:
    - Full access including Banking (Chama) and Audit Logs.
  - `MANAGER`:
    - Dashboard, Inventory, CRM, POS, Reporting (no Chama/Audit).
  - `CASHIER`:
    - POS and Inventory Lookup only.

## 4. M-Pesa STK Push Flow

Nuru’s M-Pesa integration uses the Daraja API:

- `POST /api/payments/mpesa/stkpush` (authenticated)
  - Body:
    - `phoneNumber` (MSISDN in 2547XXXXXXXX format)
    - `amount` (number)
    - `invoiceId` (string)
    - `accountReference` (optional, defaults to invoiceId)
    - `description` (optional, defaults to `Invoice {invoiceId}`)
  - Requires:
    - `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`,
      `MPESA_PASSKEY`, `MPESA_BASE_URL`, `MPESA_CALLBACK_URL`.

- Callback:
  - Route: `POST /api/payments/mpesa/callback`
  - Safaricom calls this with STK push results.
  - Nuru expects `tenantId` and `invoiceId` as query parameters
    (automatically added to `MPESA_CALLBACK_URL` when initiating STK push).
  - On `ResultCode: 0` (success):
    - Nuru marks the invoice as `Paid` for that tenant.
    - Writes a SystemLog entry `INVOICE_PAID_MPESA`.

If any M-Pesa env variables are missing, STK push initiation will fail with a clear error and no mock behavior is used.

## 5. PWA / Offline Support

Vite is configured with `vite-plugin-pwa`:

- Manifest:
  - `name`: `Nuru`
  - `short_name`: `Nuru`
  - `theme_color`: `#F9F9F8`
  - `background_color`: `#F9F9F8`
  - `display`: `standalone`
  - Icons:
    - `/icons/icon-192.png`
    - `/icons/icon-512.png`
    - `/icons/icon-512-maskable.png` (maskable)

You must provide these icon files under `frontend/public/icons` (or equivalent) for full PWA compliance.

- Caching strategy:
  - Static assets are cached by Workbox.
  - API calls to paths starting with `/api/` use a **Network First** strategy:
    - Try network, fall back to cache when offline.

To enable installable PWA:

- Ensure the app is served over HTTPS (required by browsers for service workers, except on localhost).
- Run `vite build` and serve the built assets.

## 6. Running Locally

1. Set backend env:

```bash
# .env in project root or backend env
DATABASE_URL=postgresql://user:password@localhost:5432/nuru
JWT_SECRET=your_long_random_secret

GOOGLE_CLIENT_ID=your_google_oauth_client_id

WHATSAPP_ACCESS_TOKEN=your_whatsapp_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id

MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_CALLBACK_URL=https://your-public-host/api/payments/mpesa/callback

# Optional: lock CORS to a specific frontend origin
FRONTEND_ORIGIN=http://localhost:5173
```

2. Set frontend env:

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

3. Install dependencies and run:

- Backend:
  - `cd backend`
  - `npm install` (or `pnpm install`)
  - Run Prisma migrations: `npx prisma migrate dev`.
  - Seed the database with demo data:
    - `npx ts-node prisma/seed.ts`
  - Start server: `npm run dev` or `npm start`.

- Frontend:
  - `cd frontend`
  - `npm install`
  - `npm run dev` (for development) or `npm run build` then `npm run preview` (for production preview).

## 7. First Run Guide

### 7.1 Default credentials

The seed script creates a default admin user for immediate login:

- Email: `admin@nuru.app`
- Password: `password123`
- Tenant: the \"Nuru Hardware (SME)\" tenant

It also creates per-tenant users with the same password:

- `admin+<tenantId>@nuru.app`
- `manager+<tenantId>@nuru.app`
- `cashier+<tenantId>@nuru.app`

All of these use the password `password123`.

Because tenant IDs are UUIDs, you need the tenantId to log in. You can fetch this from the database:

```sql
select id, name, code from "Tenant";
```

Use the id for the tenant you want when logging in.

### 7.2 Using the seeded tenants

The seed script creates three tenants:

1. `Nuru Hardware (SME)` – retail
   - Code: `NURU-HW`
   - Has:
     - 50+ hardware/FMCG products with realistic stock.
     - 500+ invoices over the last 3 months.
     - 50 customers with Kenyan names and KRA PINs.
   - Good for demonstrating:
     - Inventory and stock alerts.
     - Sales and cash flow charts.
     - AI Insights (churn risk, stockout, dead stock).
     - Regulator View (VAT liability) based on seeded tax rates.

2. `Wamama Pamoja (Chama)` – savings group
   - Code: `WAMAMA-PAMOJA`
   - Has:
     - 20 members.
     - 6 months of contributions across ShareCapital, Deposits, MerryGoRound.
     - 5 active loans.
   - Good for demonstrating:
     - Chama dashboard (pot size vs loans issued).
     - Member statements (PDF via Reporting).

3. `Safari Haulage & Plant Hire` – fleet/service business
   - Code: `SAFARI-FLEET`
   - Models a transport and plant hire business.
   - Inventory (service assets):
     - `Isuzu FRR (6-Ton) – Lorry Hire` @ ~KES 15,000/day.
     - `Caterpillar Backhoe – Plant Hire` @ ~KES 35,000/day.
     - `Toyota Fielder (Uber) – Taxi` @ ~KES 2,500/day.
     - Units of Measure: `Day` and `Trip`.
     - Stock is seeded with a very high quantity to represent capacity (\"time\" as inventory).
   - Customers:
     - `Mota Construction Ltd` (hires trucks).
     - `John Kamau (Driver)` (remits daily taxi money).
   - Transactions:
     - ~20 invoices over the last ~60 days (e.g., multi-day lorry hires).
     - Some invoices marked `Paid` with associated `Transaction` entries labelled as M-Pesa remittances.
   - Chama:
     - Linked to a Chama constitution and seeded with members/accounts via the same chama seeding logic.
   - Good for demonstrating:
     - How Nuru handles a service/fleet vertical (time-based billing).
     - Cash flow from hire services.
     - VAT liability on service invoices.

### 7.3 Logging in for the first time

1. Start backend and frontend as above.
2. Navigate to `http://localhost:5173/login`.
3. Use:

   - Email: `admin@nuru.app`
   - Password: `password123`

4. Tenant ID:
   - Copy the `id` for the `Nuru Hardware (SME)` tenant from your database and paste it into the Tenant ID field on the login form.

Once logged in, you can:

- Go to `/dashboard`:
  - See AI Insights, Regulator View (VAT), Cash Flow, Chama Trust, and Stock Alerts.
  - Open the \"Customize\" control to show/hide dashboard cards.
- Click the \"Regulator View – eTIMS Tax Liability\" card:
  - Navigates to `/reporting/tax-details`.
  - Shows a detailed table of invoices contributing to VAT for the current period.
  - Use \"Download KRA CSV\" to export a CSV built from the same tax logic as the dashboard.

To explore the fleet tenant:

1. Look up the `id` for the `Safari Haulage & Plant Hire` tenant.
2. Log in using:
   - Email: `admin+<safariTenantId>@nuru.app`
   - Password: `password123`
   - Tenant ID: `<safariTenantId>`
3. Explore:
   - Invoices and cash flow specific to fleet/service income.
   - Chama features linked to the fleet-owned group.

## 8. Production Notes

- Always use strong, unique values for:
  - `JWT_SECRET`
  - Database credentials
  - M-Pesa keys
  - WhatsApp and Google OAuth credentials

- Use HTTPS in production and keep environment variables out of source control.

- Review the audit logs (`/settings/audit-log`) after enabling all integrations to verify that sensitive operations are properly recorded.