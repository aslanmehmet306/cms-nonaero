# Airport Non-Aero Revenue Management Platform

## What This Is

A SaaS platform that manages the full commercial revenue lifecycle for airport non-aeronautical operations — from defining leasable areas and services, through contract management and obligation scheduling, to automated billing and invoice generation. Built to replace legacy on-premise software used by airports to manage tenant relationships, utility metering, revenue share calculations, and MAG settlements. Targets small-to-large airports globally, starting with a single-airport demo-ready MVP.

## Core Value

Automated, end-to-end billing accuracy: a published contract automatically generates the correct obligations, calculates charges from formulas, and produces invoices — eliminating the manual Excel-based processes airports rely on today.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Airport & area hierarchy management (terminal > floor > zone > unit)
- [ ] Tenant (concessionaire) management with multi-currency support
- [ ] Service definition with versioned formula engine (rent, revenue share, utility, service charge)
- [ ] Formula engine using math.js sandbox for flexible pricing expressions
- [ ] Contract lifecycle management (draft → published → active → amended/terminated)
- [ ] Automatic obligation schedule generation on contract publish
- [ ] Revenue declaration ingestion (CSV/Excel upload with validation)
- [ ] Utility meter reading and consumption-based billing
- [ ] MAG (Minimum Annual Guarantee) monthly settlement (higher-of model, no carry-forward)
- [ ] MAG year-end true-up calculation
- [ ] Billing run orchestration (async, tenant-level granularity, delta re-run)
- [ ] Stripe invoice generation with provider-agnostic adapter pattern
- [ ] Multi-currency support (TRY, EUR, USD)
- [ ] Role-based access control (7 roles, separation of duties)
- [ ] Admin portal with dashboard, contract management, billing operations
- [ ] Audit trail (obligation → formula → contract traceability)
- [ ] Email notifications (cut-off reminders, invoice created, payment status)
- [ ] Proration for new contracts starting mid-period

### Out of Scope

- Tenant self-service portal — deferred to v2 (start with admin-only)
- GIB/e-Fatura integration — Stripe invoice is sole document for v1
- Real-time TuIK/CPI escalation API — manual index_rate input for v1
- Multi-airport active usage — architecture supports it, v1 is single-airport demo
- Equipment/asset tracking module — defer to v2
- Allocation engine (shared area cost splitting) — defer to v2
- Credit note / adjustment engine — defer to v2
- Mobile app — web-first

## Context

- **Domain expertise:** 15+ years in airport non-aeronautical revenue management
- **Market gap:** Legacy on-premise solutions are expensive, inflexible, and poorly maintained. No modern SaaS alternative exists for this niche.
- **Target customers:** Small-to-medium airports first (simpler operations, faster onboarding), then scale to hub airports (50M+ passengers)
- **Existing documentation:** 13 comprehensive design documents covering PRD, data model, API contracts, algorithms, UI specs, and timeline
- **Tech stack decided:** NestJS + React 18 + PostgreSQL + Redis + Stripe + Turborepo monorepo
- **Success metric for v1:** A working demo that can be shown to potential airport customers with realistic dummy data

## Constraints

- **Solo developer:** Single developer building the entire platform — timeline and scope must be realistic
- **Tech stack:** NestJS (backend), React 18 + Shadcn/ui (frontend), PostgreSQL 15, Redis 7, Prisma ORM, BullMQ — already decided and documented
- **Docker-first:** Full Docker Compose setup for local development (PostgreSQL + Redis + API all containerized)
- **Multi-currency from day one:** TRY as primary but EUR/USD support required (differs from original docs which specified TRY-only)
- **Demo-ready:** v1 goal is a demonstrable product with realistic ADB (Izmir) dummy data, not production deployment
- **Billing determinism:** Obligation calculations must be reproducible — contract snapshot at billing run start, line_hash for duplicate detection

## Key Decisions

| Decision                                  | Rationale                                                     | Outcome   |
| ----------------------------------------- | ------------------------------------------------------------- | --------- |
| MAG: No carry-forward                     | Each month independent, simpler to implement and audit        | — Pending |
| Revenue declaration: KDV-inclusive gross  | Turkish market standard, avoids tax calculation complexity    | — Pending |
| Amendment: Next full period only          | No mid-month proration for amendments, reduces complexity     | — Pending |
| Stripe customer per tenant (not contract) | Multi-contract tenants share one Stripe customer              | — Pending |
| Admin-first, tenant portal later          | Faster to v1 demo, tenant portal is v2                        | — Pending |
| Multi-currency in v1                      | International sales potential requires EUR/USD from start     | — Pending |
| Formula engine: math.js sandbox           | Flexible, secure expression evaluation with whitelist         | — Pending |
| Invoice provider: Adapter pattern         | Stripe now, ERP integration later without refactoring         | — Pending |
| BullMQ for async billing                  | Billing runs are long-running, need queue-based orchestration | — Pending |
| SSE for real-time notifications           | Simpler than WebSocket, sufficient for notification use case  | — Pending |

---

_Last updated: 2026-02-28 after initialization_
