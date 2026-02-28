# Roadmap: Airport Non-Aero Revenue Management Platform

## Overview

This roadmap delivers a demo-ready SaaS platform for airport commercial revenue management, from contract creation through automated billing to invoice generation. Built as a modular monolith for solo developer execution, the journey follows a critical dependency path: Foundation (infrastructure + auth) → Master Data (tenant/area/service management) → Contract Domain (lifecycle + formula engine) → Obligation Domain (scheduling + MAG settlement) → Billing Orchestration (async runs) → Invoice Integration (Stripe + notifications) → Admin Portal (React UI). Each phase delivers testable capabilities that unblock the next, culminating in a working end-to-end demo with realistic ADB (Izmir) dummy data.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Infrastructure** - Monorepo setup, Docker, database schema, auth, audit trail
- [ ] **Phase 2: Master Data & Formula Engine** - Airport/area/tenant/service management with formula sandbox
- [ ] **Phase 3: Contract Domain** - Contract lifecycle, versioning, service assignment, obligation trigger
- [ ] **Phase 4: Obligation & Declaration** - Obligation scheduling, revenue/utility inputs, MAG settlement
- [ ] **Phase 5: Billing & Invoice** - BullMQ orchestration, Stripe integration, webhooks, notifications
- [ ] **Phase 6: Multi-Currency & Reporting** - Exchange rates, reporting dashboard, audit trail UI
- [ ] **Phase 7: Admin Portal** - React frontend for contract management, billing operations, invoice tracking

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: Establish the foundational technical infrastructure with Docker-based local development, secure authentication, and financial calculation precision patterns that all subsequent phases depend on.

**Depends on**: Nothing (first phase)

**Requirements**: R1.1, R1.2, R1.3, R1.4, R1.5, R1.6, R1.7, R1.8, R1.9

**Success Criteria** (what must be TRUE):
  1. Developer can run `docker compose up` and all services (PostgreSQL, Redis, API) start successfully
  2. Database schema with 20+ models is created via Prisma migration with all relations, indexes, and enums
  3. Developer can authenticate via JWT and receive different permissions based on assigned role (7 roles implemented)
  4. All monetary calculations use Decimal.js (no native JavaScript number type for financial data)
  5. Audit trail logs every entity state change with timestamp, user, and before/after snapshots
  6. Health endpoints return green status when DB and Redis are reachable, red when unavailable
  7. Swagger UI at /api/docs displays all endpoints with request/response schemas

**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Turborepo monorepo scaffold + Docker Compose + complete Prisma schema with 20+ models + ADB seed data
- [ ] 01-02-PLAN.md — JWT auth with refresh rotation + RBAC guards (7 roles, separation of duties) + Decimal.js precision utility + PrismaService
- [ ] 01-03-PLAN.md — React Admin shell (Vite) + Portal stub + Prettier/ESLint code quality tooling
- [ ] 01-04-PLAN.md — Audit trail module (interceptor + before/after snapshots) + Health endpoints (DB/Redis) + Swagger/OpenAPI documentation

### Phase 2: Master Data & Formula Engine
**Goal**: Deliver the master data foundation (airports, areas, tenants, services) and a secure, sandboxed formula engine that enables flexible pricing expressions without code injection risk.

**Depends on**: Phase 1

**Requirements**: R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R3.1, R3.2, R3.3, R3.4, R3.5, R3.6

**Success Criteria** (what must be TRUE):
  1. Demo data includes ADB airport with 3 terminals, 13 units in a hierarchical tree (terminal > floor > zone > unit)
  2. User can create tenants with active/suspended/deactivated status lifecycle and assign currency (TRY/EUR/USD)
  3. User can define services (rent, revenue_share, service_charge, utility) with draft → published → deprecated versioning
  4. User can write formula expressions using whitelisted functions (add, multiply, max, min, round, floor, ceil) and contract variables (area_m2, revenue, index_rate)
  5. Formula engine rejects malicious expressions (assignments, function definitions, process access) within 100ms timeout
  6. User can dry-run formulas with sample data and see calculated result before publishing
  7. Billing policy configuration exists with cut-off day, issue day, due date offset, and fiscal year settings

**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

**Research Flags**:
- Formula sandbox security: Validate math.js whitelist configuration against 2026 CVEs; add unit tests for malicious expression rejection

### Phase 3: Contract Domain
**Goal**: Implement complete contract lifecycle management with state machine transitions, versioning for amendments, and automatic obligation schedule generation upon contract publish.

**Depends on**: Phase 2

**Requirements**: R4.1, R4.2, R4.3, R4.4, R4.5, R4.6, R4.7, R4.8

**Success Criteria** (what must be TRUE):
  1. User can create contracts in draft state, assign tenant, areas, services, and transition through state machine (draft → in_review → published → active → amended/suspended/terminated)
  2. Publishing a contract automatically generates obligation schedule for all assigned services (triggered by ContractPublished event)
  3. User can amend active contracts with effective date = next full period start only (no mid-month changes)
  4. Amendments create new contract version and archive previous version with full history
  5. User can override service formulas at contract level (contract-specific pricing)
  6. Daily cron job transitions published contracts to active when signed_at + effective_from date is reached
  7. Contract snapshot (JSONB) is frozen at billing run start, ensuring deterministic billing regardless of later edits

**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Obligation & Declaration
**Goal**: Deliver obligation scheduling with revenue declaration ingestion, utility meter reading, formula evaluation, proration, and MAG settlement logic (monthly higher-of + year-end true-up).

**Depends on**: Phase 3

**Requirements**: R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R6.1, R6.2, R6.3, R6.4, R6.5, R7.1, R7.2, R7.3, R7.4, R13.1, R13.2, R13.3, R13.4, R13.5

**Success Criteria** (what must be TRUE):
  1. Obligations transition through 9 states (scheduled → pending_input → pending_calculation → ready → invoiced → settled → skipped → on_hold → cancelled) with state validation
  2. User can upload revenue declarations via CSV/Excel with 6 validation rules (negative amount, deviation threshold, duplicate period, missing fields, invalid tenant, invalid period)
  3. User can submit meter readings manually, and system calculates consumption (current - previous) and applies rate-based formula
  4. Formula evaluation produces calculated amount with full trace (JSONB: formula + inputs + result) stored in obligation record
  5. MAG settlement generates mag_shortfall obligation when monthly revenue share < (annual_MAG / 12), with no carry-forward between months
  6. Year-end true-up compares annual total vs annual MAG and generates true-up obligation if shortfall exists
  7. Proration applies to first obligation when contract starts mid-period (daily proration based on period length)
  8. line_hash (SHA256) unique constraint prevents duplicate obligations for same tenant/period/charge_type

**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

**Research Flags**:
- MAG proration edge cases: Validate year-end true-up logic with dummy data spanning partial years

### Phase 5: Billing & Invoice
**Goal**: Implement async billing orchestration with BullMQ, Stripe invoice generation using provider-agnostic adapter pattern, webhook handling for payment status, and email notifications.

**Depends on**: Phase 4

**Requirements**: R8.1, R8.2, R8.3, R8.4, R8.5, R8.6, R8.7, R8.8, R8.9, R9.1, R9.2, R9.3, R9.4, R9.5, R9.6, R9.7, R11.1, R11.2, R11.3

**Success Criteria** (what must be TRUE):
  1. User can trigger billing run for single tenant or multiple tenants, and run executes asynchronously via BullMQ queue
  2. Billing run transitions through 10 states (initiated → scoping → calculating → draft_ready → approved → rejected → invoicing → completed → partial → cancelled)
  3. User can cancel specific tenants from in-progress run without affecting other tenants (partial cancel)
  4. Re-running cancelled billing run performs full rerun; re-running completed run processes delta only (new/changed obligations)
  5. Concurrency rule enforced: max 1 active billing run per airport + period combination
  6. Stripe invoices are created with line items grouped by charge_type per tenant per period, using idempotency key pattern
  7. Stripe webhooks update invoice payment status (paid, failed, overdue) with event deduplication (event_id stored, processed_at tracked)
  8. Email notifications sent for 7 templates (Turkish): cut-off approaching, declaration missing, invoice created, payment received, payment failed, invoice overdue, contract expiring
  9. Bull Board queue monitoring UI accessible at /admin/queues showing job status, failures, retries
  10. SSE (Server-Sent Events) provides real-time progress updates to admin UI during billing run execution

**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

**Research Flags**:
- Stripe webhook event ordering: Validate handling of out-of-order events with integration tests

### Phase 6: Multi-Currency & Reporting
**Goal**: Enable multi-currency support with manual exchange rate management, reporting dashboard with revenue summaries, aging reports, and audit trail drill-down.

**Depends on**: Phase 5

**Requirements**: R10.1, R10.2, R10.3, R10.4, R10.5, R12.1, R12.7, R12.8

**Success Criteria** (what must be TRUE):
  1. User can assign contract currency (TRY, EUR, USD) and all obligations calculate in that contract currency as source of truth
  2. User can manually input exchange rates with effective date, source, from/to currency
  3. Obligation amounts convert to reporting currency using snapshot exchange rate at period-end (display only, not for billing)
  4. Dashboard displays revenue summary by tenant, by service type, aging report, and KPIs (total revenue, outstanding invoices, collection rate)
  5. User can filter obligation list by tenant/period/status and drill down into calculation trace (formula + inputs + result)
  6. Reports available for revenue by tenant, revenue by service type, billing history, and audit trail with full entity change logs
  7. Stripe handles multi-currency invoicing natively with currency specified per invoice

**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Admin Portal
**Goal**: Deliver React 18 admin frontend with Shadcn/ui components for contract management, billing operations, invoice tracking, and role-based access control across all admin workflows.

**Depends on**: Phase 6

**Requirements**: R12.2, R12.3, R12.4, R12.5, R12.6, R12.9, R12.10

**Success Criteria** (what must be TRUE):
  1. User can create, edit, publish, amend, and terminate contracts through intuitive UI with state transition buttons
  2. User can create and manage tenants with status lifecycle controls (activate, suspend, deactivate)
  3. Formula builder UI allows user to write expressions, preview with sample data, and see validation errors before saving
  4. User can trigger billing runs, view real-time progress via SSE updates, and approve/reject draft results
  5. Invoice list displays all invoices with status, amount, due date, and provides Stripe hosted URL link for payment
  6. Settings page allows configuration of billing policy (cut-off day, issue day, due date), user management with role assignment, and airport configuration
  7. Responsive design works on desktop (1920x1080 primary, 1366x768 minimum) with consistent Shadcn/ui theming
  8. Role-based access control enforces separation of duties (contract creator cannot approve own contracts, auditor is read-only)

**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 1/4 | In Progress | - |
| 2. Master Data & Formula Engine | 0/TBD | Not started | - |
| 3. Contract Domain | 0/TBD | Not started | - |
| 4. Obligation & Declaration | 0/TBD | Not started | - |
| 5. Billing & Invoice | 0/TBD | Not started | - |
| 6. Multi-Currency & Reporting | 0/TBD | Not started | - |
| 7. Admin Portal | 0/TBD | Not started | - |
