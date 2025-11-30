# Nuru – Product & Context Brief (V1.0)

This document describes what Nuru is, who it is for, and how it is intended to be used in the Kenyan / African context. It is written so that another AI (or human researcher) can use it as a briefing document to perform deep, market-specific research.

---

## 1. What Nuru Is

### 1.1 One-line description

Nuru is a multi-tenant ERP and financial operations “operating system” designed for African enterprises. It combines inventory, sales (POS), customer management, invoicing, chama-style savings and loans, and analytics into one platform, with deep support for mobile money (M‑Pesa) and WhatsApp-based communication.

### 1.2 Philosophy

Nuru is built around three core ideas:

- Street logic:
  - The system mirrors the way real businesses operate in Kenya and wider Africa: cash-heavy, mobile-first, and often informal.
  - It focuses on what owners actually care about: cash, stock, debts, and trust inside their teams and groups.

- Neo‑Naturalism (UX):
  - The interface is precise and analytical, but visually warm and organic.
  - Design uses soft colors (warm beige, sage green) and gentle depth so that the app feels like a physical tool, not a sterile dashboard.

- Trust engine:
  - Every sensitive action is logged (who did what, when, on which record).
  - Chama and small businesses can see exactly who posted an invoice, issued a loan, or moved money.

---

## 2. Target Market and User Personas

Nuru is intentionally built for Africa-first use cases, with Kenya as the initial focus.

### 2.1 Primary segments (initial focus)

1. Micro and small retailers  
   Examples:
   - Kiosks and dukas.
   - Small supermarkets and minimarts.
   - Agro-dealers and hardware shops.
   - Pharmacies and clinics with simple stock/invoice needs.

   Needs:
   - Track inventory and stock-outs.
   - Record sales (POS or invoicing).
   - Reconcile M‑Pesa / cash receipts.
   - Know “what’s selling” and “what’s in the till”.

2. Business chamas and savings groups  
   Examples:
   - Self-help groups.
   - Investment clubs.
   - Rotating savings groups (Merry-Go-Round).

   Needs:
   - Track contributions (share capital, deposits).
   - Track loans to members and repayments.
   - Run informal “bank” meetings, record sessions (table banking).
   - Maintain trust and transparency across members.

3. Small service businesses  
   Examples:
   - Agencies, freelancers, consultants.
   - Small workshops (garages, tailoring, salons).

   Needs:
   - Invoice customers.
   - Track payments (cash, M‑Pesa).
   - Manage a simple customer database.
   - See basic analytics (sales by period, customer list, debtor list).

### 2.2 Secondary / future segments

- SME wholesalers and distributors (with more complex inventory and credit).
- SACCOs and microfinance institutions (with regulatory constraints).
- Multi-branch retail chains (requiring stronger location and role control).
- Domain-specific verticals (healthcare, education, agriculture).

---

## 3. Core Problems Nuru Addresses

Nuru is built around a specific set of problems common in Kenyan / African contexts:

1. Fragmented tools and “paper + WhatsApp” operations:
   - Businesses track stock in one app, cash in another, and loans in WhatsApp threads or notebooks.
   - This makes reconciliation and scaling difficult.

2. Cash and M‑Pesa flows are not tightly integrated:
   - Most transactions happen in M‑Pesa and cash, yet accounting/ERP tools assume card/bank payments.
   - Reconciliation is fragile and manual.

3. Unreliable power and connectivity:
   - Shops and chamas may operate with:
     - Periodic blackouts.
     - Intermittent 3G/4G connectivity.
   - Systems must tolerate offline periods and resync gracefully.

4. Low trust inside small organizations:
   - Owners and chama members need to see:
     - Who posted a transaction.
     - Who changed a balance or an invoice.
   - They need audit trails but in a human-readable, non-corporate way.

5. Multi‑tenant but with agency-style deployments:
   - A single Nuru deployment can host many tenants (businesses or groups).
   - Each tenant wants isolation without managing their own infrastructure.

---

## 4. Nuru’s Core Capabilities

This section describes what Nuru does, module by module.

### 4.1 Inventory & Stock Management

Purpose: Answer “what do we have, where, and in what unit?”

Key capabilities:

- Products:
  - Create and manage products with:
    - Name, SKU, description, category.
    - Default unit of measure (UoM).
    - Minimum stock quantities per product (for alerts).
  - Ensure SKU uniqueness per tenant.

- Units of Measure (UoM):
  - Support nested units:
    - Example:
      - Piece → Pack → Carton.
      - Ratios define conversions (e.g., 1 carton = 12 packs, 1 pack = 6 pieces).
  - Core feature: break bulk from larger to smaller UoMs correctly.

- StockQuants:
  - Represent how much stock exists at each location (and batch), per product and UoM.
  - For each (product, location, batch, UoM), track a quantity.
  - Prevent quantities from going negative.

- Locations:
  - Represent physical or virtual locations:
    - Main shop, store, branch, warehouse, or even “truck”.

- Operations:
  - Adjust stock:
    - For receiving goods, shrinkage, corrections.
  - Break bulk:
    - Convert from a parent UoM to a child UoM:
      - Example: reduce 1 carton and increase 24 pieces.
    - Maintain quantity invariants across conversions.

- Alerts:
  - For each product, define a minimum stock threshold.
  - Dashboard displays items below minimum stock (per tenant).

### 4.2 Point of Sale (POS) & Sales

Purpose: Support quick, “cashier-friendly” selling.

Current V1 behavior:

- POS workspace:
  - Simple interface to:
    - Scan or type SKU.
    - Add items to a ticket (skeleton implemented; main flows to be expanded).
  - Designed to be minimal and keyboard-friendly, for cashiers.

- Sales via invoices:
  - More structured flows (e.g., B2B) use invoices:
    - Create Draft invoices with line items.
    - Post invoices to mark them as official and decrease stock.

Integration with payments (M‑Pesa):

- M‑Pesa STK Push:
  - Backend endpoint to initiate STK push for an invoice.
  - Callback handler:
    - On success, marks invoice as Paid and logs an audit event.
  - Ties POS/invoicing to actual cash-in from M‑Pesa.

### 4.3 CRM & Customers

Purpose: Know who you’re dealing with and how.

Capabilities:

- Customer management:
  - Store name, phone, email, and other basic info.
  - Search and filter by name/phone/email.

- Linking to invoices:
  - Each invoice belongs to a customer.
  - Useful for statement-like reports and debt tracking.

Future direction:

- Add “customer statements” and aging reports for deeper CRM/accounting.
- Optionally integrate with messaging (WhatsApp) for reminders and notifications.

### 4.4 Invoicing

Purpose: Move beyond cash till slips to formal invoices and receipts.

Capabilities:

- Draft and Post states:
  - Draft:
    - Editable, not yet affecting stock.
  - Posted:
    - Finalized, triggers stock decrements, and considered part of “booked” sales.

- Logic when posting an invoice:
  1. Validate the invoice exists and belongs to the tenant.
  2. Ensure it is in Draft state.
  3. For each line item:
     - Decrement inventory (in the correct UoM and location).
  4. Change invoice status to Posted.
  5. Write a SystemLog entry (INVOICE_POSTED).
  6. Send an invoice summary via WhatsApp (if the customer has a phone number and WhatsApp is configured).

- WhatsApp notifications:
  - When an invoice is posted:
    - Nuru constructs a text summary and sends it to the customer on WhatsApp via the WhatsApp Cloud API.

- Payment status:
  - Status can be:
    - Draft, Posted, Paid (others possible in future).
  - M‑Pesa integration can automatically transition from Posted → Paid.

- Exports:
  - Sales CSV:
    - By date range, for external analysis or manual accounting.
  - This allows bridging into external tools (Excel, other ERPs, etc.).

### 4.5 Chama & Group Banking

Purpose: Model informal savings and lending inside groups.

Key entities:

- Member:
  - Each member belongs to a tenant (a chama, group, or SACCO).

- Account:
  - Types:
    - ShareCapital, Deposits, MerryGoRound.
  - Each account belongs to a member.
  - Balance is tracked and updated via transactions.

- Transaction:
  - Represents credits/debits on accounts (e.g., contributions, payouts).

- Loan:
  - Issued to a member (borrower).
  - Has principal, interest rate, issued date, and due date.
  - Linked to optional guarantors (LoanGuarantor).
  - Status: Active, Pending, etc.

- Session:
  - Represents a table-banking meeting:
    - Date, name, total collected, cash at hand.
  - Acts as a “snapshot” context for that event.

Core flows:

- Contributions:
  - Crediting a member’s account.
  - May be linked to a session.

- Loans:
  - Creating a loan:
    - Optionally assign guarantors and guarantee amounts.
  - Future: integrate loan repayments and earnings on capital.

- Trust metrics:
  - Pot size:
    - Sum of all account balances.
  - Loans issued:
    - Sum of principal of active/pending loans.

- Audit:
  - Each loan issuance logs LOAN_ISSUED in SystemLog.

### 4.6 Analytics & Reporting

Purpose: Give operators a “flight deck” view of their business.

Dashboard:

- Cards:
  - Total sales in selected period.
  - Cash at hand (sum of account balances).
- Charts:
  - Cash flow:
    - Income vs expenses over time.
  - Chama trust:
    - Pot size vs loans issued (pie).
- Stock alerts:
  - Low-stock items.

Reporting:

- Sales CSV exports by date.
- Inventory snapshot CSV.
- Chama member statements as PDFs.

These are intended to be used manually and also as feeds into more advanced analytics or financial tooling.

---

## 5. Cross-Cutting Features

### 5.1 Multi-tenant & Tenant Features

- Each tenant is a separate business or group.
- All data is scoped by tenantId.
- Per-tenant feature flags:
  - e.g., enableChama to turn banking features on/off.

### 5.2 Roles and Access Control

Nuru uses roles to limit what each user sees and can do:

- ADMIN:
  - Full visibility (Dashboard, Inventory, CRM, Chama, Settings).
  - Can view Audit Log.

- MANAGER:
  - Dashboard, Inventory, CRM, POS, Reporting.
  - No Chama admin features or global settings.

- CASHIER:
  - Minimal view:
    - POS.
    - Inventory Lookup.
  - No Dashboard, CRM, Chama, or Audit Log.

The UI hides items the user is not allowed to see, and backend APIs enforce the same permissions.

### 5.3 Notifications (WhatsApp)

- Invoice posting triggers a WhatsApp message to the customer (if configured and phone exists).
- WhatsApp Cloud API is used (no SMS or email dependency).

### 5.4 M‑Pesa Integration

- Nuru integrates with M‑Pesa Daraja API for STK Push:

  - Initiate payment:
    - /api/payments/mpesa/stkpush.
    - Sends an STK push to the customer’s phone for a given invoice.

  - Callback:
    - /api/payments/mpesa/callback receives response.
    - On success (ResultCode 0):
      - Marks invoice as Paid.
      - Logs INVOICE_PAID_MPESA in SystemLog.

- Future development can extend this to deeper reconciliation with M‑Pesa C2B/B2C APIs.

### 5.5 Audit Log (SystemLog)

- For each sensitive action (initially:
  - INVOICE_POSTED.
  - LOAN_ISSUED.
  - INVOICE_PAID_MPESA.
- A log record is written with:
  - Tenant ID.
  - User ID (if applicable).
  - Action.
  - Entity type and ID.
  - Metadata.
  - Timestamp.

- Admins can see a paginated view of these logs to understand who did what.

---

## 6. Operating Environment Assumptions

Nuru is built with the African context in mind, especially Kenya.

### 6.1 Devices

- Low-to-mid-range Android phones, often shared.
- Low-end laptops or desktops in small shops.
- Limited RAM and older browsers need to be handled gracefully.

### 6.2 Network & Power

- Network:
  - 3G/4G with patches of poor coverage.
  - Occasional offline periods.

- Power:
  - Intermittent load‑shedding or local outages.
  - Shops may use battery-powered devices and mobile hotspots.

Nuru’s PWA configuration and general architecture aim to tolerate short offline episodes, with a network-first caching strategy for API calls and local caching of static assets.

### 6.3 Language and Currency

- Default interface language: English.
- Target areas for localization:
  - Swahili (Kenya, Tanzania).
  - Possibly other African languages in the future.

- Currencies:
  - Primary: KES (Kenyan Shilling).
  - System design must support multiple currencies (UGX, TZS, etc.) for future rollout, even if V1 is KES-focused.

### 6.4 Regulatory and Compliance Context (Assumptions)

- For chamas and small businesses:
  - Not all groups are formally registered; some are informal, others are registered as societies or companies.
- For M‑Pesa:
  - Requires Safaricom approvals and adherence to their terms.
- For accounting and tax:
  - Kenya Revenue Authority (KRA) iTax / e-invoicing regime may require integrations for formal businesses.

The system is meant to be flexible enough to adapt to regulatory requirements without sacrificing usability for informal groups.

---

## 7. Future Directions and Research Hooks

Nuru V1.0 is the foundation. Further development will depend heavily on deep research about Kenyan / African markets.

Below are some areas and questions specifically meant to guide AI-driven research.

### 7.1 Vertical and Segment-Specific Needs

For each segment (retail, chama, clinics, agro‑dealers, etc.):

- What are the common workflows and pain points?
  - Inventory management.
  - Credit sales and debtor management.
  - Supplier relationships and payables.
  - Cash and M‑Pesa reconciliation.

- What existing tools do they use?
  - Paper, Excel, local POS solutions, SACCO/Chama apps, etc.

- Where do existing solutions fail?
  - Poor offline support.
  - Complexity.
  - Lack of local integrations (M‑Pesa, tax authorities).
  - Cost and onboarding difficulties.

### 7.2 Chama, SACCO, and Microfinance Context

- What are typical chama structures and rules in Kenya (and East Africa)?
  - Contributions, meetings, fines, payouts, and risk-sharing.
- How do they currently track:
  - Contributions (share capital and deposits).
  - Loans and repayments.
  - Dividends or profit sharing.
- Regulatory environment:
  - What registration and reporting requirements exist for:
    - Informal groups?
    - SACCOs?
  - What rules govern interest rates, loan terms, and member protections?

### 7.3 Payments and Reconciliation

- M‑Pesa:
  - How do SMEs typically integrate M‑Pesa into their operations?
    - For example: STK, till numbers, paybill numbers, bank integration.
  - What are common issues:
    - Reconciliation, chargebacks, reversed transactions, fees?
- Bank and card:
  - Which other payment rails matter (cards, bank transfers, PayPal, etc.)?
- Research question:
  - What best practices exist for automatically reconciling M‑Pesa statements with invoices and account balances?

### 7.4 Regulation, Tax, and Compliance

- Kenya:
  - Requirements for invoicing and receipt issuance.
  - eTIMS / e-invoicing trends at KRA.
  - How small businesses currently comply (or fail to comply).

- Wider Africa:
  - For target countries (Uganda, Tanzania, Rwanda, Nigeria, Ghana etc.), what are:
    - Key tax regulations.
    - Requirements for digital receipts.
    - Anti-money-laundering and KYC constraints for lending and deposits.

### 7.5 Credit, Risk, and Scoring

- How do small businesses and chamas currently:
  - Evaluate creditworthiness?
  - Decide loan limits and interest rates?
  - Manage default risk?

- Potential future Nuru features:
  - Basic credit scoring using:
    - Transaction history.
    - Contribution patterns.
    - Loan repayment behavior.
  - Portfolio analytics:
    - NPL (non-performing loans) percentages.
    - Aging buckets.

Research questions:

- What data is commonly available (e.g., CRB reports, mobile money history)?
- What regulatory issues arise when scoring and lending as a non-bank?

### 7.6 Cultural and UX Considerations

- How do typical users in Kenyan small businesses or chamas prefer to:
  - Receive notifications (WhatsApp, SMS, email, in-app)?
  - Organize information (tables vs visual cards, language, date formats)?

- UX risks:
  - Overloading small teams with complex flows.
  - Assuming desktop habits where mobile is dominant.

### 7.7 Business Model and Distribution

- How are ERP / POS / chama tools usually sold:
  - Direct SaaS?
  - Through agents and resellers?
  - Bundled with other services (e.g., bank or telco partnerships)?

- Constraints:
  - Price sensitivity and willingness to pay.
  - Agent networks and trust in software vendors.

---

## 8. Summary

Nuru V1.0 is a multi-tenant, Africa-first ERP that combines:

- Inventory and POS.
- CRM and invoicing.
- Chama savings and loans.
- WhatsApp notifications and M‑Pesa integration.
- A principled audit log for internal trust.
- A warm, human-centered UI.

For researchers and AI systems, this document should be treated as:

- A source of truth on what Nuru does today and what it aims to become.
- A context for exploring:
  - Kenyan and African business environments.
  - Payment ecosystems (especially M‑Pesa).
  - Regulatory and cultural realities informing the next phases of Nuru’s design.