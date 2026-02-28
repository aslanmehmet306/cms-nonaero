# Project Research Summary

**Project:** Airport Non-Aeronautical Revenue Management Platform
**Domain:** Billing/Invoicing SaaS for airport commercial operations
**Researched:** 2026-02-28
**Confidence:** MEDIUM (training data + domain expertise, no current market validation)

## Executive Summary

This is a financial billing system with complex multi-currency calculations, formula-driven pricing, and automated invoice generation. Experts build such systems using NestJS (backend API framework), PostgreSQL (ACID compliance for financial transactions), and Decimal.js (precision arithmetic). The core technical challenge is deterministic billing orchestration: ensuring the same contract always produces the same invoice regardless of when billing runs, supporting audit trails, and handling async queue processing for long-running billing jobs.

The recommended approach is a **modular monolith** (not microservices) using queue-based billing orchestration (BullMQ), provider-agnostic invoice generation (Stripe adapter pattern), and formula sandboxing (math.js with whitelisting). This avoids over-engineering for solo developer context while maintaining clean domain boundaries (Contract → Obligation → Billing → Invoice pipeline). Critical early decisions: establish Decimal.js for all financial math in Phase 1, implement idempotent billing runs in Phase 2, and harden the formula engine sandbox before any production use.

Key risks include decimal precision loss (0.1 + 0.2 ≠ 0.3 creates invoice discrepancies), non-idempotent billing (duplicate charges if run twice), formula injection attacks (malicious expressions crash server or leak data), and contract amendment state explosion (mid-month changes create untestable complexity). Mitigate by enforcing decimal.js usage globally, using unique constraints on (tenant, period), sandboxing math.js with function whitelists, and deferring mid-month amendments to v2 (next-full-period-only rule).

## Key Findings

### Recommended Stack

The proposed NestJS + React 18 + PostgreSQL + Prisma + BullMQ + Stripe stack is **validated** for billing SaaS. This is a production-proven combination for financial platforms requiring deterministic calculations and async job processing. Critical additions not in original docs: **Decimal.js** (not dinero.js) for currency-agnostic precision, **@bull-board/nestjs** for queue monitoring UI, **Puppeteer** for PDF invoice generation, and **ExcelJS** for revenue declaration uploads.

**Core technologies:**

- **NestJS 10.x:** Backend framework — enterprise-grade with built-in DI, module architecture, decorator routing; excellent for domain-driven billing logic
- **PostgreSQL 15+:** Primary database — ACID compliance critical for financial transactions; JSONB for formula snapshots; native DECIMAL type
- **Prisma 5.x:** ORM — type-safe queries prevent runtime errors in financial calculations; schema-first migrations enable audit trail
- **BullMQ 5.x:** Async queue — billing runs are long-running; supports job priority, retry with exponential backoff, monitoring via Bull Board
- **Decimal.js 10.x:** Financial precision — JavaScript Number type is unsafe for money (0.1 + 0.2 ≠ 0.3); Decimal.js provides exact decimal arithmetic
- **math.js 12.x:** Formula engine — sandbox mode for safe expression evaluation; MUST configure whitelist (not secure by default)
- **Stripe SDK:** Invoice provider — multi-currency out of box; adapter pattern isolates vendor (future: ERP integration)

**Warnings:**

- math.js requires custom sandbox configuration with function whitelist (security critical)
- Puppeteer is resource-heavy; may need worker pool for scale
- Decimal.js has immutable API; team must understand no `+=` on Decimal objects

### Expected Features

Research identified 33 table stakes features (users expect them) and 24 differentiators (competitive advantage). MVP must deliver core billing automation: contract lifecycle → obligation scheduling → billing run orchestration → invoice generation with audit trail. Defer tenant portal, e-invoice integration, allocation engine, and credit notes to v2.

**Must have (table stakes for demo):**

- Contract management (draft → published → active → amended/terminated lifecycle)
- MAG settlement (monthly higher-of calculation, year-end true-up)
- Revenue declaration ingestion (CSV upload with validation)
- Formula engine (flexible pricing: `revenue * share_rate`, `max(mag, revenue * rate)`)
- Billing run orchestration (async, tenant-level granularity, progress tracking)
- Multi-currency support (TRY, EUR, USD from day one)
- Audit trail (obligation → formula → contract traceability)
- Invoice generation via Stripe (PDF, email delivery, payment tracking)

**Should have (competitive differentiators):**

- Real-time billing preview (dry-run mode before committing)
- Formula engine versioning (contract snapshots prevent non-reproducible billing)
- Automated email notifications (cut-off reminders, invoice delivery)
- Smart duplicate detection (hash-based line deduplication)

**Defer to v2 (post-validation):**

- Tenant self-service portal (admin-only for v1)
- E-invoice integration (GIB/e-Fatura for Turkey; Stripe PDF sufficient for demo)
- Equipment/asset tracking module
- Allocation engine (shared cost splitting across tenants)
- Credit note workflow (reversal logic, approval flows)
- Mobile meter reading app (web-first for v1)

### Architecture Approach

Use **modular monolith** with domain boundaries (Contract, Obligation, Billing, Invoice domains) communicating via NestJS event emitter. Avoid microservices — operational complexity unjustified for solo developer, and ACID boundaries are critical (contract → obligation generation must be atomic). Queue-based billing orchestration (BullMQ) decouples long-running jobs from HTTP requests. Provider-agnostic adapter pattern for Stripe (future: ERP integration without refactoring).

**Major components:**

1. **Contract Domain** — lifecycle management (draft/publish/amend/terminate state machine), service definitions, formula validation; emits ContractPublished event
2. **Obligation Domain** — schedule generation (triggered by contract publish), formula evaluation engine (math.js sandbox), revenue declaration ingestion, MAG settlement logic
3. **Billing Domain** — run orchestration (BullMQ job queue), contract snapshot creation (freeze state at run start), tenant-level granularity, progress tracking via SSE
4. **Invoice Domain** — invoice generation from billing results, Stripe adapter (provider abstraction), webhook handling (payment status sync), email notifications (async via BullMQ)

**Critical path for build order (Phase 1-6):**
Foundation (multi-tenant context, audit trail) → Master data (tenant/area/service management) → Contract domain (lifecycle + formula engine) → Obligation domain (scheduling + calculation) → Billing orchestration (BullMQ + runs) → Invoice integration (Stripe adapter + webhooks) → Admin UI (dashboard + operations)

### Critical Pitfalls

Research identified 6 critical pitfalls (cause rewrites or data corruption), 4 moderate (bugs or tech debt), and 4 minor (annoyances). Top 3 must be addressed in Phase 1-2 as retrofitting is expensive.

1. **Decimal/floating point precision loss** — Using JavaScript `number` type creates rounding errors (0.1 + 0.2 = 0.30000000000000004); compounds across thousands of invoices; breaks reconciliation. **Prevention:** Use Decimal.js for ALL financial math; PostgreSQL NUMERIC(19,4) type; establish pattern in Phase 1 before any calculation code.

2. **Non-idempotent billing runs** — Running same period twice creates duplicate invoices and Stripe charges; triggers from cron skew, developer re-runs, user double-clicks, BullMQ retries. **Prevention:** Unique constraint on (tenant_id, period_start, period_end); idempotency key in billing_runs table; Stripe API calls use idempotency headers.

3. **Formula engine injection & DoS** — User formulas can execute malicious code (`process.exit()`, infinite loops, data theft) if math.js not sandboxed; default config allows function definitions. **Prevention:** Whitelist allowed functions (add, multiply, max, min, round only); AST validation before evaluation; timeout protection (1s max); formula versioning (immutable once used).

4. **Contract amendment state explosion** — Mid-month amendments create exponential edge cases (3 amendments = 8 states, 5 = 32 states, 10 = 1024 states); untestable. **Prevention:** PROJECT.md decision: "Amendment: Next full period only" — no mid-month proration for amendments; simplifies billing to single active contract per period.

5. **Multi-currency conversion timing ambiguity** — When to convert? What rate? Different choices produce different amounts; FX risk allocation unclear. **Prevention:** Contract currency = source of truth; convert only for reporting (never for billing); snapshot exchange rate at obligation calculation time; document FX policy clearly.

## Implications for Roadmap

Based on dependency analysis from ARCHITECTURE.md and feature prioritization from FEATURES.md, suggest **7-phase roadmap** following critical path: Foundation → Master Data → Contract → Obligation → Billing → Invoice → UI.

### Phase 1: Foundation & Master Data

**Rationale:** Database schema, multi-tenant context, and audit trail are prerequisites for all domains; tenant/area/service management have no dependencies and can be built in parallel.
**Delivers:** PostgreSQL schema with Prisma migrations; multi-tenant context (NestJS guard + middleware); audit trail module; Airport/area hierarchy (terminal → floor → zone → unit); Tenant management; Service definitions (rent, revenue share, utility, service charge).
**Addresses:** Table stakes features (tenant database, area hierarchy, service definition).
**Avoids:** Pitfall #1 (decimal precision) — establish Decimal.js usage pattern NOW; all monetary fields use NUMERIC(19,4) and Decimal.js in code.
**Research flags:** None — standard CRUD with NestJS + Prisma (well-documented).

### Phase 2: Contract Domain

**Rationale:** Contracts are the legal basis for all billing; formula engine needed for contract validation before publish; versioning prevents amendment state explosion.
**Delivers:** Contract CRUD with state machine (draft → published → active → amended/terminated); Formula engine (math.js sandbox with whitelist); Contract versioning (amendments create new versions); Service-to-contract assignment.
**Addresses:** Table stakes feature (contract management); Differentiator (formula engine flexibility).
**Avoids:** Pitfall #3 (formula injection) — MUST implement sandbox hardening before any production use; Pitfall #4 (amendment explosion) — enforce "next period only" rule in state machine.
**Research flags:** **Formula sandbox security** — validate math.js whitelist configuration against 2026 CVEs; add unit tests for malicious expression rejection.

### Phase 3: Obligation Domain

**Rationale:** Contracts generate obligations (triggered by publish event); revenue declarations and meter readings are inputs to obligation calculations; MAG settlement is complex but required for demo.
**Delivers:** Obligation schedule generation (triggered by ContractPublished event); Revenue declaration module (CSV upload with validation); Meter reading module (manual entry for v1); Formula evaluation (using Phase 2 sandbox); MAG settlement logic (monthly higher-of, year-end true-up); Proration for mid-period contract starts.
**Addresses:** Table stakes features (obligation scheduling, revenue share calculation, MAG settlement, utility billing, proration).
**Avoids:** Pitfall #5 (multi-currency FX timing) — snapshot exchange rate at obligation calculation time; store in obligation record.
**Research flags:** **MAG proration edge cases** — validate year-end true-up logic with dummy data spanning partial years.

### Phase 4: Billing Orchestration

**Rationale:** Billing runs orchestrate obligation finalization and invoice trigger; async queue required for tenant-level granularity and progress tracking.
**Delivers:** BullMQ setup (Redis queue configuration); Billing run CRUD (create, start, monitor status); Contract snapshot creation (JSONB freeze at run start); BillingWorker (processes runs async); Progress tracking (SSE for real-time updates to UI); Idempotency (unique constraint on tenant/period, line_hash for obligations).
**Addresses:** Table stakes feature (billing run orchestration); Differentiator (async billing with progress tracking).
**Avoids:** Pitfall #2 (non-idempotent runs) — CRITICAL to implement unique constraints and idempotency keys.
**Research flags:** None — BullMQ + NestJS integration is well-documented.

### Phase 5: Invoice Integration

**Rationale:** Invoices are the output of billing runs; Stripe adapter provides multi-currency invoicing without PCI compliance burden; webhooks sync payment status.
**Delivers:** Invoice generation (from billing run results); Stripe adapter (implements InvoiceProvider interface); Webhook handler (payment status updates, event sourcing pattern); Email notifications (async via BullMQ); Invoice PDF generation (Puppeteer fallback if Stripe insufficient).
**Addresses:** Table stakes features (invoice generation, payment tracking); Differentiator (provider-agnostic adapter for future ERP integration).
**Avoids:** Pitfall #6 (webhook ordering) — use event sourcing pattern (store all events, process idempotently, fetch current state from Stripe).
**Research flags:** **Stripe webhook event ordering** — validate handling of out-of-order events with integration tests.

### Phase 6: Multi-Currency & Reporting

**Rationale:** Multi-currency is table stakes (PROJECT.md requirement); dashboard provides visibility for demo.
**Delivers:** Exchange rate management (manual input for v1; API deferred to v2); Multi-currency invoice generation (Stripe native support); Currency conversion for reporting (snapshot at period end); Dashboard (revenue by tenant, by service type, aging report, KPIs); Reporting (billing history, obligation details, audit trail queries).
**Addresses:** Table stakes features (multi-currency support, reporting dashboard); Differentiator (audit trail drill-down).
**Avoids:** Pitfall #5 (FX conversion ambiguity) — clear UI labels for "invoice currency" vs "reporting currency".
**Research flags:** None — Stripe multi-currency is standard feature.

### Phase 7: Admin Portal (UI)

**Rationale:** Backend APIs can be tested with Postman/curl; UI built last to avoid rework as domain logic stabilizes.
**Delivers:** React 18 frontend (Vite + Shadcn/ui); Contract management UI (CRUD + state transitions); Billing operations UI (trigger runs, view progress via SSE); Invoice list (view, resend, void); Dashboard (visualizations with recharts); Role-based access control (7 roles, separation of duties).
**Addresses:** Table stakes feature (admin portal with dashboard).
**Avoids:** Pitfall #10 (scope creep: multi-airport UI) — hardcode single demo airport; skip airport selector dropdown.
**Research flags:** None — React 18 + Shadcn/ui patterns are standard.

### Phase Ordering Rationale

- **Bottom-up dependencies:** Can't build contracts without tenants/services (Phase 1 before 2); can't bill without obligations (Phase 3 before 4); can't invoice without billing results (Phase 4 before 5).
- **Early risk mitigation:** Decimal.js (Phase 1), formula sandbox (Phase 2), idempotency (Phase 4) address critical pitfalls before complex logic built on top.
- **Async infrastructure mid-phase:** BullMQ needed before billing runs (Phase 4), but not for contract/obligation setup (Phases 2-3).
- **UI last:** Backend API stability more important than visual polish for demo; API can be tested independently while domain logic solidifies.
- **Parallel opportunities (for context switching):** Phase 1 master data modules (tenant, area, service) are independent; Phase 3 modules (revenue declaration, meter reading) are independent.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (Contract Domain):** math.js sandbox security — validate whitelist configuration against 2026 security advisories; test malicious expression rejection.
- **Phase 3 (Obligation Domain):** MAG proration edge cases — validate year-end true-up with partial-year contracts.
- **Phase 5 (Invoice Integration):** Stripe webhook event ordering — integration tests for out-of-order event handling.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Foundation):** NestJS + Prisma CRUD is well-documented; Turborepo monorepo setup has official templates.
- **Phase 4 (Billing Orchestration):** BullMQ + NestJS integration has official docs and examples.
- **Phase 6 (Multi-Currency):** Stripe multi-currency support is standard feature with clear documentation.
- **Phase 7 (Admin Portal):** React 18 + Shadcn/ui has comprehensive examples for forms, tables, dashboards.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                       |
| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | MEDIUM     | Core technologies (NestJS, Prisma, BullMQ) are standard for billing SaaS; specific version numbers need npm verification (training data cutoff Jan 2025)                    |
| Features     | MEDIUM     | Table stakes identified from domain expertise (15+ years per PROJECT.md) and billing SaaS patterns; not validated against current market offerings (web search unavailable) |
| Architecture | MEDIUM     | Modular monolith + queue-based billing is established pattern; specific library integrations (Prisma RLS, math.js sandbox) need verification with current docs              |
| Pitfalls     | HIGH       | Decimal precision, idempotency, formula injection are universal problems in billing systems; prevention strategies are well-documented                                      |

**Overall confidence:** MEDIUM

Research is based on training data (cutoff Jan 2025) and domain reasoning; not validated against current market (web search unavailable) or current library versions (npm versions need verification). Core patterns (billing pipeline, queue orchestration, adapter pattern) are sound and widely applicable, but specific API changes and 2026 best practices could not be verified.

### Gaps to Address

- **math.js sandbox security:** Verify whitelist configuration against 2026 CVE database; validate AST traversal blocks all injection vectors. **Handling:** Phase 2 must include security audit + penetration testing before production use.

- **Prisma RLS support:** Unclear if Prisma natively supports PostgreSQL row-level security policies; may need raw SQL or middleware. **Handling:** Phase 1 research spike (1 day) to validate multi-tenant isolation approach.

- **MAG proration for partial years:** PROJECT.md states "No carry-forward" but year-end true-up with mid-year contract start requires clear policy. **Handling:** Phase 3 research spike to validate true-up calculation with ADB (Izmir) dummy data scenarios.

- **Stripe invoice vs ERP future integration:** Adapter pattern defined, but minimal interface for ERP unclear (needs discovery with target ERPs). **Handling:** Defer to Phase 5; build Stripe adapter first, refactor interface based on first ERP integration attempt (post-v1).

- **Multi-airport scope:** PROJECT.md states "architecture supports it, v1 is single-airport demo" but doesn't specify schema decisions (airport_id in all tables vs separate databases). **Handling:** Phase 1 must clarify: include airport_id FK in schema (enables future multi-airport) but hardcode single DEMO_AIRPORT constant in code (avoids UI/permission complexity).

## Sources

### Primary (training data)

- NestJS architecture patterns for billing/invoicing SaaS (modular monolith, domain-driven design, event-driven state machines)
- PostgreSQL best practices for financial data (NUMERIC type, ACID transactions, JSONB for metadata)
- BullMQ job queue patterns (async billing, retry logic, idempotency, monitoring)
- Stripe API patterns (invoice generation, webhook handling, multi-currency, idempotency)
- Financial calculation libraries (Decimal.js vs dinero.js vs currency.js comparison)
- math.js security considerations (sandbox escapes, function whitelisting, AST validation)

### Secondary (project context)

- `/Users/aslan/Documents/Non-Aero/.planning/PROJECT.md` — domain expertise (15+ years), tech stack decisions, key requirements, constraints
- Airport non-aeronautical revenue management domain knowledge (MAG settlements, revenue share, concession contracts)

### Tertiary (inferred, needs validation)

- Current competitive landscape (IBS, Inform, Veovo commercial modules) — could not verify with web search
- 2026 library versions and API changes — training data cutoff Jan 2025; all version numbers need npm verification
- Turkish market practices (KDV-inclusive revenue, TuIK/CPI escalation) — mentioned in PROJECT.md but not validated against current regulations

**Validation needed before implementation:**

- [ ] npm view @nestjs/common version (verify 10.x is current)
- [ ] npm view prisma version (verify 5.x is current)
- [ ] npm view bullmq version (verify 5.x is current)
- [ ] npm view decimal.js version (verify 10.x is current)
- [ ] npm view mathjs version (verify 12.x is current; check CVEs)
- [ ] Stripe API version compatibility (verify multi-currency invoice API unchanged)
- [ ] Prisma RLS support (check official docs for row-level security integration)

---

_Research completed: 2026-02-28_
_Ready for roadmap: yes_
