---
phase: 03-contract-domain
plan: "04"
subsystem: scheduler
tags: [cron, scheduler, tenant-cascade, seed-data]
dependency_graph:
  requires: [03-01, 03-03]
  provides: [contract-lifecycle-cron, tenant-contract-cascade, demo-seed]
  affects: [app.module, tenants.service, seed]
tech_stack:
  added: ["@nestjs/schedule"]
  patterns: [cron-job, prisma-transaction, batch-updateMany, tdd]
key_files:
  created:
    - apps/api/src/scheduler/contract-scheduler.service.ts
    - apps/api/src/scheduler/contract-scheduler.service.spec.ts
    - apps/api/src/scheduler/contract-scheduler.module.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/tenants/tenants.service.ts
    - apps/api/src/tenants/tenants.service.spec.ts
    - apps/api/prisma/seed.ts
    - apps/api/package.json
decisions:
  - Cron at 02:00 Istanbul time — runs after midnight, before business day starts
  - Amendment flip uses Prisma $transaction with array form (interactive transactions not needed)
  - Tenant cascade uses updateMany for O(1) DB round-trips regardless of contract count
  - Deactivated status does not cascade — business rule: deactivated contracts retain their status
  - Seed uses findFirst+create pattern for idempotent re-runnable contract seeding
metrics:
  duration: 4min
  completed: "2026-03-05"
  tasks: 2
  files: 8
---

# Phase 3 Plan 4: Contract Scheduler + Tenant Cascade Summary

Daily cron scheduler for contract activation + amendment flips, tenant suspension cascade via updateMany, and 3 demo contracts in seed data.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Contract scheduler cron (activation + amendment flip) | 6da4164 | contract-scheduler.service.ts, .spec.ts, .module.ts, app.module.ts, package.json |
| 2 | Tenant suspension cascade + contract seed data | fbecf2f | tenants.service.ts, tenants.service.spec.ts, seed.ts |

## What Was Built

### Task 1: ContractSchedulerService

- `@Cron('0 2 * * *', { timeZone: 'Europe/Istanbul' })` runs daily at 02:00
- `activatePublishedContracts()`: finds contracts with `status=published`, `signedAt != null`, `effectiveFrom <= today` and transitions to `active`
- `flipAmendments()`: finds `pending_amendment` contracts with `effectiveFrom <= today`, atomically swaps old active -> amended and pending -> active using `$transaction`
- `ContractSchedulerModule` registered in `AppModule` alongside `ScheduleModule.forRoot()`
- `@nestjs/schedule` installed

### Task 2: Tenant Cascade + Seed

- `TenantsService.updateStatus()`: wraps tenant update in `$transaction`; on suspend cascades active contracts -> suspended via `updateMany`; on reactivate reverses suspended -> active; deactivated has no cascade
- ContractStatus import added to tenants.service.ts
- Seed data: CNT-001 (Duty Free Main, active, 2 areas, 3 services, annual MAG 500k TRY), CNT-002 (CIP Lounge, draft, 1 area, 2 services, annual MAG 200k TRY), CNT-003 (Ground Floor Retail, published, 1 area, 1 service, no MAG)

## Test Results

- 9 new unit tests in `contract-scheduler.service.spec.ts` — all pass
- 4 new cascade tests in `tenants.service.spec.ts` — all pass alongside existing 17 (21 total)
- Combined: 30 tests pass
- Build: `pnpm --filter api build` compiles without errors

## Verification

- `pnpm --filter api test -- --testPathPattern="(contract-scheduler|tenants).service.spec" --no-coverage` — 30 tests pass
- `pnpm --filter api build` — no TypeScript errors
- AppModule: has `EventEmitterModule.forRoot()` + `ScheduleModule.forRoot()` + all Phase 3 modules including `ContractSchedulerModule`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock mismatch for $transaction array**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** The `$transaction` mock received `[undefined, undefined]` because `prisma.contract.update` wasn't set up in that test; `expect.anything()` doesn't match `undefined`
- **Fix:** Added `prisma.contract.update.mockResolvedValue(...)` in the test and changed assertion to `expect.any(Object)` which matches resolved Promises
- **Files modified:** `contract-scheduler.service.spec.ts`
- **Commit:** 6da4164

**2. [Rule 1 - Bug] Existing updateStatus tests broke with $transaction wrapping**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Existing 5 `updateStatus` tests mocked `prisma.tenant.update` directly but the new code wraps in `$transaction`; mock returned `undefined` causing `updated.code` to throw
- **Fix:** Added `beforeEach` in the `updateStatus` describe block to mock `$transaction` as a pass-through callback executor; also added `prisma.contract.updateMany.mockResolvedValue(...)` where cascade is triggered
- **Files modified:** `tenants.service.spec.ts`
- **Commit:** fbecf2f

## Self-Check: PASSED

Files verified:
- apps/api/src/scheduler/contract-scheduler.service.ts: FOUND
- apps/api/src/scheduler/contract-scheduler.service.spec.ts: FOUND
- apps/api/src/scheduler/contract-scheduler.module.ts: FOUND
- apps/api/src/tenants/tenants.service.ts: FOUND (contains updateMany)
- apps/api/prisma/seed.ts: FOUND (contains CNT-001, CNT-002, CNT-003)

Commits verified:
- 6da4164: FOUND (feat(03-04): Contract scheduler cron)
- fbecf2f: FOUND (feat(03-04): Tenant suspension cascade)
