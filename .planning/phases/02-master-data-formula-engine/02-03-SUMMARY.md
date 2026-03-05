---
phase: 02-master-data-formula-engine
plan: 03
subsystem: tenants
tags: [tenants, stripe, crud, rbac, status-lifecycle, nestjs, prisma]

# Dependency graph
requires:
  - phase: 01-02
    provides: PrismaService, JWT auth guards, RBAC decorators, env validation
  - phase: 02-01
    provides: Airport model (airportId FK reference)
provides:
  - Tenant CRUD at /api/v1/tenants with role-based access
  - Auto-generated sequential codes (TNT-001, TNT-002, ...)
  - Stripe customer creation on tenant creation with idempotency key
  - Graceful fallback when STRIPE_SECRET_KEY not configured
  - Fully reversible status transitions (active <-> suspended <-> deactivated)
  - Status filter on list endpoint (?status=active)
affects: [02-04, 03-01, 05-01]

# Tech tracking
tech-stack:
  added: [stripe@17.3.0, uuid@11.0.0]
  patterns: [sequential-code-generation, stripe-idempotency, graceful-stripe-fallback, reversible-status-lifecycle]

key-files:
  created:
    - apps/api/src/tenants/tenants.module.ts
    - apps/api/src/tenants/tenants.controller.ts
    - apps/api/src/tenants/tenants.service.ts
    - apps/api/src/tenants/tenants.service.spec.ts
    - apps/api/src/tenants/dto/create-tenant.dto.ts
    - apps/api/src/tenants/dto/update-tenant.dto.ts
    - apps/api/src/tenants/dto/update-tenant-status.dto.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/config/env.validation.ts
    - apps/api/package.json

key-decisions:
  - "Stripe customer created at tenant creation with uuidv4 idempotency key; if Stripe not configured, stripeCustomerId stored as null"
  - "All tenant status transitions fully reversible (active<->suspended<->deactivated, any direction)"
  - "taxId and code are immutable after creation (not in UpdateTenantDto)"
  - "Cascade to contracts/obligations deferred to Phase 3+ (documented as TODO in updateStatus)"
  - "Prisma generate required before tests can compile (auto-generates TypeScript types from schema)"

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 2 Plan 3: Tenant CRUD with Stripe Integration Summary

**Tenant CRUD with auto-generated sequential codes (TNT-001...), Stripe customer creation with idempotency on tenant creation and graceful fallback, and fully reversible status lifecycle (active/suspended/deactivated)**

## Performance

- **Duration:** 4 min
- **Tasks:** 1 (TDD)
- **Files modified:** 10

## Accomplishments

- Complete Tenant CRUD at `/api/v1/tenants` with role guards (commercial_manager, airport_admin, super_admin)
- Auto-generated sequential codes: `generateNextTenantCode(airportId)` finds last code per airport, increments and pads to 3 digits (TNT-001, TNT-002, ..., TNT-999, TNT-1000)
- Stripe customer creation on tenant create: uses `stripe.customers.create` with `idempotencyKey: uuidv4()`
- Graceful Stripe fallback: if `STRIPE_SECRET_KEY` not set, logs warning and stores `stripeCustomerId: null` (no crash)
- Stripe failure throws error to prevent creating tenant without Stripe customer (per R2.3)
- Status lifecycle: all transitions allowed (fully reversible) — `updateStatus` accepts any target status
- List endpoint supports `?status=active|suspended|deactivated` filter with pagination
- Required fields enforced: `name`, `taxId`, `email` (DTO validation)
- Immutable fields: `airportId`, `code`, `taxId`, `stripeCustomerId` (excluded from `UpdateTenantDto`)
- 17/17 unit tests pass with mocked PrismaService and mocked Stripe

## Task Commits

1. **Task 1: Tenant CRUD with auto-code, Stripe customer, and status lifecycle** - `dbce9eb` (feat)

## Files Created/Modified

- `apps/api/src/tenants/tenants.module.ts` - TenantsModule (exported, registered in AppModule)
- `apps/api/src/tenants/tenants.controller.ts` - GET /tenants, GET/PATCH /:id, PATCH /:id/status with @Roles and @Audit
- `apps/api/src/tenants/tenants.service.ts` - generateNextTenantCode, create with Stripe, findAll with filter, findOne, update, updateStatus
- `apps/api/src/tenants/tenants.service.spec.ts` - 17 unit tests covering all TDD behaviors
- `apps/api/src/tenants/dto/create-tenant.dto.ts` - airportId, name, taxId, email (required), phone, address (optional)
- `apps/api/src/tenants/dto/update-tenant.dto.ts` - name, email, phone, address (all optional, mutable only)
- `apps/api/src/tenants/dto/update-tenant-status.dto.ts` - status: TenantStatus enum
- `apps/api/src/app.module.ts` - Added TenantsModule import
- `apps/api/src/config/env.validation.ts` - Added optional STRIPE_SECRET_KEY field
- `apps/api/package.json` - Added stripe@^17.3.0, uuid@^11.0.0, @types/uuid@^10.0.0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma client type generation required for tests**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** TypeScript type errors on `this.prisma.tenant.*` because Prisma client types hadn't been generated from schema
- **Fix:** Ran `pnpm --filter api prisma generate` to generate types. This is a one-time setup step.
- **Files modified:** None (external generation step)
- **Commit:** Covered by dbce9eb (build works correctly)

**2. [Rule 1 - Bug] Fixed jest.Mocked<PrismaService> TypeScript error in test**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Using `jest.Mocked<PrismaService>` didn't work because the typed mock didn't include Prisma model accessors. Auth spec uses plain object mocks.
- **Fix:** Changed to explicitly typed plain object mock (following auth.service.spec.ts pattern): `{ tenant: { findFirst: jest.Mock; ... } }`
- **Files modified:** apps/api/src/tenants/tenants.service.spec.ts
- **Commit:** Covered by dbce9eb

## Self-Check: PASSED
