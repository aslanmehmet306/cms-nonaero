# Requirements — Airport Non-Aero Revenue Management Platform

**Version:** 1.0
**Updated:** 2026-02-28
**Success Criteria:** Demo-ready product showing end-to-end billing flow with realistic ADB dummy data

---

## v1 — Demo-Ready MVP

### R1: Foundation & Infrastructure

- [x] **R1.1** Turborepo monorepo with NestJS API, React Admin, React Portal (stub), shared-types, formula-engine packages
- [x] **R1.2** Docker Compose: PostgreSQL 15 + Redis 7 + API — `docker compose up` runs everything
- [x] **R1.3** Prisma schema with 20+ models, all enums, indexes, relations — migration applied
- [x] **R1.4** JWT auth with 7 roles (super_admin, airport_admin, commercial_manager, finance, auditor, tenant_admin, tenant_user)
- [x] **R1.5** RBAC guards with separation of duties (contract creator ≠ approver)
- [x] **R1.6** Global Decimal.js pattern for all financial calculations (no native JS number for money)
- [x] **R1.7** Audit trail module logging all entity state changes
- [x] **R1.8** Health endpoints (liveness + readiness) with DB/Redis checks
- [x] **R1.9** Swagger/OpenAPI documentation for all endpoints

### R2: Master Data

- **R2.1** Airport management — single ADB airport with 3 terminals, 13 units (seed data)
- **R2.2** Area hierarchy — terminal > floor > zone > unit with self-referential tree
- [x] **R2.3** Tenant management — CRUD with status lifecycle (active/suspended/deactivated)
- [x] **R2.4** Service definition — 4 types: rent, revenue_share, service_charge, utility
- [x] **R2.5** Service versioning — draft → published → deprecated lifecycle
- [x] **R2.6** Billing policy — cut-off day, issue day, due date days, fiscal year config

### R3: Formula Engine

- **R3.1** math.js sandbox with whitelisted functions only (add, subtract, multiply, divide, max, min, round, floor, ceil)
- **R3.2** Expression validation on save (AST traversal, reject assignments/function definitions)
- **R3.3** Variable substitution from contract context (area_m2, rate_per_m2, revenue, index_rate, etc.)
- **R3.4** Timeout protection (100ms max execution)
- [x] **R3.5** Formula versioning — immutable once used in obligation calculation
- [x] **R3.6** Dry-run evaluation with sample data before formula publish

### R4: Contract Management

- **R4.1** Contract CRUD with state machine: draft → in_review → published → active → amended/suspended/terminated
- **R4.2** Contract publish triggers automatic obligation schedule generation
- **R4.3** Contract versioning — amendments create new version, previous version archived
- **R4.4** Amendment effective date = next full period start only (no mid-month)
- **R4.5** Contract-service assignment with optional formula override per service
- **R4.6** Contract-area assignment (which spaces the tenant occupies)
- **R4.7** Published → Active transition: daily cron + API-time check (signed_at + effective_from)
- **R4.8** Contract snapshot (JSONB) frozen at billing run start for deterministic billing

### R5: Obligation Management

- **R5.1** Automatic obligation schedule generation from contract services on publish
- **R5.2** 9 obligation states: scheduled → pending_input → pending_calculation → ready → invoiced → settled → skipped → on_hold → cancelled
- **R5.3** Formula evaluation using contract snapshot + declaration inputs → calculated amount
- **R5.4** line_hash (SHA256) unique constraint for duplicate detection
- **R5.5** Proration for new contracts starting mid-period (first obligation only)
- **R5.6** Obligation amount stored with calculation trace (JSONB: formula + inputs + result)

### R6: Revenue Declaration

- **R6.1** Declaration CRUD with states: draft → submitted → validated → rejected → frozen
- **R6.2** CSV/Excel upload with validation (6 rules: negative amount, deviation threshold, duplicate period, missing fields, invalid tenant, invalid period)
- **R6.3** Declaration line items with gross amount (KDV dahil brüt satış)
- **R6.4** Attachment upload for POS/Z reports (PDF, Excel, images — max 10MB)
- **R6.5** Frozen declarations are immutable (freeze token prevents modification)

### R7: MAG Settlement

- **R7.1** Monthly settlement: higher-of(revenue_share_amount, annual_MAG / 12) — no carry-forward
- **R7.2** Monthly MAG shortfall generates mag_shortfall obligation
- **R7.3** Year-end true-up: compare annual total vs annual MAG, generate true-up obligation if needed
- **R7.4** Each month independent — surplus NOT carried to next month

### R8: Billing Run

- **R8.1** Billing run orchestrator using BullMQ async queue
- **R8.2** Tenant-level granularity — start single tenant or multi-tenant billing
- **R8.3** Partial cancel — cancel specific tenants without affecting others
- **R8.4** Re-run policy: cancelled → full rerun, completed → delta only
- **R8.5** Contract snapshot creation at run start (JSONB copy)
- **R8.6** 10 billing run states: initiated → scoping → calculating → draft_ready → approved → rejected → invoicing → completed → partial → cancelled
- **R8.7** Concurrency rule: max 1 active run per airport + period
- **R8.8** Bull Board queue monitoring UI at /admin/queues
- **R8.9** SSE progress updates to admin UI during run

### R9: Invoice & Stripe Integration

- **R9.1** Invoice generation from billing run results via Stripe adapter
- **R9.2** Provider-agnostic InvoiceProvider interface (Stripe active, ERP stub)
- **R9.3** Stripe invoice: create → add line items → finalize (3-step)
- **R9.4** Stripe customer per tenant (not per contract)
- **R9.5** Idempotency key: {billing*run_id}*{charge*type}*{tenant_id}
- **R9.6** Webhook handler with event deduplication (event_id stored, processed_at tracked)
- **R9.7** Invoice grouping: per charge_type per tenant per period

### R10: Multi-Currency

- **R10.1** Contract-level currency assignment (TRY, EUR, USD)
- **R10.2** Exchange rate table with manual input (source, effective_date, from/to currency)
- **R10.3** Obligation calculated in contract currency (source of truth)
- **R10.4** Reporting conversion at period-end rate (display only, not for billing)
- **R10.5** Stripe handles multi-currency invoicing natively

### R11: Notifications

- **R11.1** Email notifications: 7 templates (Turkish) — cut-off approaching, declaration missing, invoice created, payment received, payment failed, invoice overdue, contract expiring
- **R11.2** In-app notifications via SSE (Server-Sent Events) with 30s polling fallback
- **R11.3** Notification bell with severity levels (info/warning/error)

### R12: Admin Portal

- **R12.1** Dashboard — revenue summary, aging report, recent activity, KPIs
- **R12.2** Contract management — list, create, edit, publish, amend, terminate
- **R12.3** Tenant management — list, create, edit, status changes
- **R12.4** Service definition — formula builder, preview, version history
- **R12.5** Billing operations — trigger run, view progress (SSE), approve/reject
- **R12.6** Invoice list — view details, Stripe hosted URL link, status tracking
- **R12.7** Obligation list — filter by tenant/period/status, calculation trace drill-down
- **R12.8** Reports — revenue by tenant, by service type, billing history, audit trail
- **R12.9** Settings — billing policy, user management, airport config
- **R12.10** Responsive design (desktop-first for admin)

### R13: Utility Billing

- **R13.1** Meter definition — meter type (electricity, water, gas, heating), unit, location
- **R13.2** Meter reading entry — manual input with timestamp
- **R13.3** Consumption calculation — current reading - previous reading
- **R13.4** Rate-based billing — consumption × unit_rate formula
- **R13.5** Meter reading linked to obligation for audit trail

---

## v2 — Post-Validation

- **R14** Tenant self-service portal (declaration submission, invoice view, payment history)
- **R15** GIB/e-Fatura integration (Turkey electronic invoice compliance)
- **R16** Automatic TuIK/CPI escalation API (replace manual index_rate)
- **R17** Multi-airport active operations (airport selector, cross-airport reporting)
- **R18** Allocation engine (shared area cost splitting across tenants)
- **R19** Credit note / adjustment workflow (reversal, approval chain)
- **R20** Equipment/asset tracking module
- **R21** Mobile meter reading app (offline-capable, photo capture)
- **R22** Budget vs actual reporting
- **R23** Configurable approval workflows
- **R24** Reconciliation tools (expected vs actual revenue variance)

---

## Out of Scope (Never Build)

- Payment processing engine (use Stripe)
- General-purpose CRM (basic tenant contact only)
- Document collaboration (store signed contracts only)
- Inventory management (accept revenue totals, don't track stock)
- HR/Payroll
- Aeronautical revenue management (separate domain entirely)
- Blockchain/Web3
- AI/ML features in v1
