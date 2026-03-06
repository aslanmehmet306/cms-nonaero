# 📅 REVISED TIMELINE — SOLO DEVELOPER (40 Weeks)
## Non-Aeronautical Revenue Management Platform

**Version:** v1.0
**Last Updated:** 2026-02-28
**Developer:** Solo full-stack (NestJS + React + TypeScript)
**Total Duration:** 40 weeks (~10 ay)
**Working Hours:** 40h/week, 1600h total
**Approach:** Backend-first, then Admin UI, then Tenant Portal

---

## 1. TIMELINE OVERVIEW

```
W01-04  ████ Foundation & Infrastructure
W05-07  ███  Service Definition + Formula Engine
W08-12  █████ Contract Engine + Obligation Generation
W13-15  ███  MAG Settlement Engine
W16-20  █████ Billing Run + Stripe Integration
W21-22  ██   Billing Policy + Notifications Backend
W23-25  ███  Admin Portal — Core Pages (Dashboard, Contracts, Services)
W26-28  ███  Admin Portal — Billing & Invoices
W29-31  ███  Tenant Portal — Declaration + Invoice View
W32-33  ██   Reporting + Audit Trail UI
W34-35  ██   Notification UI (In-App + Email Templates)
W36-37  ██   Polish, Edge Cases, Error Handling
W38-40  ███  Integration Testing + UAT + Bug Fixes
```

---

## 2. DETAILED MILESTONE PLAN

### PHASE A: Backend Core (W01-W22, 22 weeks)

#### W01-W02: Project Scaffold & Infrastructure
**Deliverables:**
- Turborepo monorepo initialized (apps/api, apps/admin, apps/portal, packages/shared-types, packages/formula-engine)
- Docker Compose: PostgreSQL 15, Redis 7, API
- Prisma schema initial migration
- NestJS project structure (modular monolith, 15 modules scaffolded)
- ESLint + Prettier + Husky setup
- GitHub repo + GitHub Actions (lint + test)
- .env configuration + README

**Exit Criteria:** `docker compose up` → API + DB + Redis running, health endpoint responds

---

#### W03-W04: Auth + Seed Data + Base CRUD
**Deliverables:**
- JWT auth module (admin + tenant separate domains)
- RBAC guards + decorators (7 roles)
- Password hashing (bcrypt)
- Airport, Area, Tenant CRUD modules
- Prisma seed script (ADB airport, 3 terminals, 13 units, 5 tenants, admin users)
- Stripe Customer sync (tenant create → Stripe customer)

**Exit Criteria:** Login → JWT → create tenant → Stripe customer created

---

#### W05-W07: Service Definition + Formula Engine
**Deliverables:**
- Service Definition CRUD + versioning + publish/deprecate lifecycle
- Formula CRUD + versioning + publish/archive lifecycle
- `packages/formula-engine`: math.js wrapper with sandbox
  - Expression parsing + validation
  - Variable injection
  - Dry-run evaluation with trace
  - Security: whitelist functions, timeout, depth limit
- Formula evaluate endpoint (dry-run)
- Unit tests: formula engine (20+ test cases)

**Exit Criteria:** Create formula → dry-run → correct result with trace

---

#### W08-W12: Contract Engine + Obligation Generation (CRITICAL MODULE)
**Deliverables:**
- Contract CRUD + full lifecycle state machine (7 states)
- Contract area + service assignment
- SoD enforcement (creator ≠ approver)
- **Contract publish → obligation schedule auto-generation**
  - Period generation with proration
  - Rent obligations (amount calculated, status: scheduled)
  - Revenue share obligations (status: pending_input)
  - MAG true-up obligation (status: pending_calculation)
  - Due date calculation from billing policy
  - line_hash duplicate detection
- Amendment flow (cancel future obligations, new version draft)
- Termination flow (cancel remaining obligations)
- Obligation CRUD + state transitions
- Published → Active cron job
- Unit tests: obligation generation (15+ test cases with proration scenarios)
- Integration tests: full contract lifecycle

**Exit Criteria:** Create contract → publish → obligation schedule visible → amend → future obligations cancelled + new draft created

---

#### W13-W15: MAG Settlement Engine
**Deliverables:**
- Monthly higher-of calculation (no carry-forward)
- Settlement ledger entries
- MAG shortfall obligation generation
- Year-end true-up calculation
- Settlement API endpoints
- MAG status query (YTD accrual per contract)
- Unit tests: 10+ MAG scenarios (shortfall, surplus, prorated)

**Exit Criteria:** Monthly: rev share > MAG/12 → revenue billed. Rev share < MAG/12 → shortfall obligation. Year-end: true-up correct.

---

#### W16-W20: Billing Run + Stripe Integration (CRITICAL MODULE)
**Deliverables:**
- BullMQ setup (4 queues: billing-run, stripe-invoice, webhook-processing, notification)
- Billing run orchestrator (full lifecycle: initiated → completed)
- Contract snapshot at run start
- Eligible obligation collection (with filters)
- Draft preview API
- Approval flow (SoD)
- Stripe invoice creation (per charge type per tenant)
- Stripe webhook handler (signature verification, idempotent processing)
- Invoice log mirroring
- Settlement ledger update on payment
- Tenant-level partial cancel
- Re-run policy (full/delta)
- Idempotency: platform-level (line_hash) + Stripe-level (idempotency key)
- Integration tests: full billing run → Stripe invoice → webhook → settlement

**Exit Criteria:** Run billing → preview → approve → Stripe invoices created → webhook payment → settled

---

#### W21-W22: Billing Policy + Notifications Backend + Declarations
**Deliverables:**
- Billing policy CRUD + versioning + approval
- Declaration CRUD (manual + Excel upload parsing)
- Declaration validation rules (6 rules: negative, deviation, duplicate, etc.)
- Declaration attachment upload (local storage + Docker volume)
- Cut-off enforcement cron job (freeze, skip, alert)
- Declaration → obligation calculation trigger
- Notification module (email via SendGrid/SES + in-app DB records)
- Notification queue (BullMQ)
- SSE endpoint for real-time notification count
- Email templates (7 templates, basic HTML)

**Exit Criteria:** Submit declaration → validate → freeze at cut-off → obligation calculated → notification sent

---

### PHASE B: Admin Portal UI (W23-W28, 6 weeks)

#### W23-W25: Admin Core Pages
**Deliverables:**
- Admin portal scaffold (React 18 + Shadcn/ui + Tailwind + TanStack Query)
- Auth pages (login, password reset placeholder)
- Layout (sidebar, top bar, notification bell)
- Dashboard (A01): stats cards, missing declarations, recent runs, MAG alerts
- Contract list (A02): table with filters, sorting, pagination
- Contract create/edit (A03): tabbed form (general, areas, services, MAG, obligations)
- Contract detail (A03): view mode with obligation schedule
- Service list + create/edit (A04-A05)
- Formula list + create/edit with dry-run panel (A06-A07)
- Tenant list + detail (A08-A09)

**Exit Criteria:** Full contract lifecycle manageable through UI (create → publish → view obligations)

---

#### W26-W28: Admin Billing & Invoice Pages
**Deliverables:**
- Billing run list (A10)
- Billing run create with 2-step wizard (A11): config → preview → approve
- Billing run detail (A12): status, invoices, errors
- Obligation list with filters (A13)
- Invoice list (A14)
- Invoice detail with audit trail (A15)
- Billing policy management (A19)
- User management (A20)

**Exit Criteria:** Full billing cycle manageable through UI (create run → preview → approve → invoices listed)

---

### PHASE C: Tenant Portal UI (W29-W31, 3 weeks)

#### W29-W31: Tenant Portal
**Deliverables:**
- Tenant portal scaffold (separate React app, mobile-friendly)
- Tenant auth (separate JWT domain)
- Tenant dashboard (T01): due invoices, declaration status
- Declaration list (T02)
- Declaration create/edit with validation warnings (T03)
- Declaration attachment upload (T03)
- Excel upload flow (T05)
- Invoice list + detail (T06-T07): Stripe hosted URL
- Payment history (T08)
- My contract view (T09)
- Notification center (T10)

**Exit Criteria:** Tenant can submit declaration, view invoices, see payment history on mobile

---

### PHASE D: Reports, Polish & Testing (W32-W40, 9 weeks)

#### W32-W33: Reporting + Audit Trail UI
**Deliverables:**
- Revenue dashboard (A16): summary cards, charts (recharts)
- MAG status report (A17): per-contract table
- Audit trail viewer (A18): search + expandable trace
- Notification center UI — admin (A21)

---

#### W34-W35: Notifications + Email + Polish
**Deliverables:**
- 7 email templates (HTML, responsive)
- Email sending integration (SendGrid/SES production setup)
- In-app notification UI polish (SSE real-time)
- Error handling improvements (global error boundary, toast notifications)
- Loading states (skeletons, spinners)
- Empty states

---

#### W36-W37: Edge Cases + Error Handling + Performance
**Deliverables:**
- Edge case testing (mid-month start, partial year MAG, concurrent billing runs)
- Error handling: Stripe failures, webhook retries, formula errors
- Performance optimization: database queries, pagination, bulk operations
- Security audit: JWT expiry, SoD enforcement, input sanitization
- API documentation (OpenAPI/Swagger)

---

#### W38-W40: Integration Testing + UAT
**Deliverables:**
- End-to-end flow tests (Playwright)
- Full billing cycle with 5 dummy tenants (1 month cycle)
- Go/No-Go checklist verification (21 items)
- Bug fixes
- Deployment documentation
- UAT sign-off

**Exit Criteria:** All 21 Go/No-Go items checked ✅

---

## 3. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| Stripe API learning curve | Medium | 2 weeks delay | Start with test mode early (W16), use Stripe CLI for webhook testing |
| Formula engine edge cases | Low | 1 week delay | Comprehensive unit tests in W05-07 |
| BullMQ queue complexity | Medium | 1 week delay | Start simple (1 worker), scale later |
| UI polish taking too long | High | 3 weeks delay | Stick to Shadcn defaults, no custom design |
| Proration algorithm bugs | Medium | 1 week delay | Test-driven: write test cases before implementation |
| Solo burnout | High | Variable | Strict 40h/week, no weekend work, milestone celebrations |

---

## 4. KEY DEPENDENCIES (EXTERNAL)

| Dependency | When Needed | Lead Time |
|------------|-------------|-----------|
| Stripe account (test mode) | W16 | 1 day (instant) |
| Stripe account (live mode) | W38 | 1-2 weeks (KYC) |
| SendGrid / AWS SES account | W21 | 1-3 days |
| Domain name (airport-revenue.com) | W23 | 1 day |
| Cloud hosting (production) | W38 | 1-3 days |

---

## 5. WEEKLY VELOCITY TRACKING

Track actual vs planned each week:

| Week | Planned | Actual | Delta | Notes |
|------|---------|--------|-------|-------|
| W01 | Foundation scaffold | | | |
| W02 | Docker + Prisma | | | |
| ... | | | | |

---

## 6. SUCCESS METRICS

| Milestone | Target Date | Verification |
|-----------|-------------|-------------|
| API health endpoint live | W02 end | curl → 200 |
| First formula dry-run works | W07 end | API test |
| First obligation schedule generated | W12 end | DB check |
| First Stripe invoice created | W20 end | Stripe dashboard |
| Admin portal: contract manageable | W25 end | Manual test |
| Tenant portal: declaration submittable | W31 end | Manual test |
| Full billing cycle (5 tenants, 1 month) | W40 end | UAT checklist |
