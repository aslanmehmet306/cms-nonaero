---
phase: 03-contract-domain
plan: "03"
subsystem: api
tags: [nestjs, prisma, event-emitter, obligations, billing, contract]

# Dependency graph
requires:
  - phase: 03-contract-domain/03-01
    provides: ContractsService.transition() emitting contract.published, ContractsModule with export
  - phase: 03-contract-domain/03-02
    provides: ContractServicesModule with contractServices and overrideCurrency
  - phase: 02-master-data/02-04
    provides: BillingPolicy model with dueDateDays, ServiceDefinition with serviceType

provides:
  - ObligationsService.generateSchedule: bulk creates one obligation per service per monthly period
  - ObligationsListener: @OnEvent('contract.published') async handler
  - GET /api/v1/obligations: paginated list with contractId/tenantId/status/periodStart filters
  - GET /api/v1/obligations/:id: single obligation with contract+tenant relations
  - AppModule registers EventEmitterModule.forRoot() + all 4 Phase 3 modules

affects:
  - 03-04: Phase 3 wiring plan — AppModule already done here; 03-04 may handle remaining items
  - 04-obligation-billing: billing engine consumes obligations in scheduled status
  - 05-invoice: invoice generation references obligation lineHash and amount

# Tech tracking
tech-stack:
  added: ["@nestjs/event-emitter@^2.0.0 (already in package.json, now activated via EventEmitterModule.forRoot())"]
  patterns:
    - "Event-driven obligation generation: ContractsService emits 'contract.published', ObligationsListener handles async"
    - "Bulk insert with prisma.obligation.createMany for schedule generation performance"
    - "Currency fallback chain: overrideCurrency -> magCurrency -> 'TRY'"
    - "ServiceType -> ObligationType/ChargeType lookup tables for O(1) mapping"

key-files:
  created:
    - apps/api/src/obligations/obligations.service.ts
    - apps/api/src/obligations/obligations.service.spec.ts
    - apps/api/src/obligations/obligations.listener.ts
    - apps/api/src/obligations/obligations.controller.ts
    - apps/api/src/obligations/obligations.module.ts
    - apps/api/src/obligations/events/contract-published.event.ts
    - apps/api/src/obligations/dto/query-obligations.dto.ts
  modified:
    - apps/api/src/app.module.ts

key-decisions:
  - "BillingPolicy lookup uses status=PolicyStatus.active (not isActive field — plan spec was inaccurate)"
  - "dueDate computed with millisecond arithmetic (periodEnd.getTime() + dueDateDays * 86400000) — simple and correct for day-level due dates"
  - "Test date comparisons use local-time constructors (new Date(year, month, day)) to match service behavior and avoid UTC vs local timezone mismatch"
  - "findOne includes contract and tenant relations only (serviceDefinition not included — available via contractServices relation)"

patterns-established:
  - "Event listener error handling: try/catch in @OnEvent handler, errors logged but not rethrown to protect caller"
  - "Early-exit pattern: return 0 immediately when no contractServices present, no prisma.obligation.createMany call"
  - "Monthly period generation: while (current < effectiveTo) with new Date(year, month+1, 0) for last-day-of-month"

requirements-completed: [R4.2]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 3 Plan 03: Obligation Schedule Generation Summary

**Event-driven obligation schedule generation (one obligation per service per monthly period) via @OnEvent('contract.published') + read-only list/get endpoints + all Phase 3 modules registered in AppModule**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-05T13:40:23Z
- **Completed:** 2026-03-05T13:44:13Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- ObligationsService generates N services x M months = N*M obligation rows via `prisma.obligation.createMany` for bulk performance
- ObligationsListener receives `contract.published` event asynchronously, keeping publish endpoint responsive
- Read-only GET /obligations with contractId/tenantId/status/periodStart/periodEnd pagination; GET /obligations/:id with relations
- AppModule now wires EventEmitterModule.forRoot() + all 4 Phase 3 modules (Contracts, ContractAreas, ContractServices, Obligations)
- 21 new unit tests covering schedule generation, type mappings, currency fallback, period dates, due dates, and read queries (192 total)

## Task Commits

Each task was committed atomically:

1. **TDD RED — failing obligation tests** - `9efd0b6` (test)
2. **Task 1: Obligation schedule, listener, controller** - `a035a01` (feat)
3. **Task 2: AppModule registration** - `c3c7ab7` (feat)

_Note: TDD tasks have multiple commits (test → feat)_

## Files Created/Modified

- `apps/api/src/obligations/obligations.service.ts` - Schedule generation with monthly period arithmetic, type mappings, currency fallback; findAll/findOne read queries
- `apps/api/src/obligations/obligations.service.spec.ts` - 21 unit tests covering all behaviors
- `apps/api/src/obligations/obligations.listener.ts` - @OnEvent('contract.published', { async: true }) handler with error isolation
- `apps/api/src/obligations/obligations.controller.ts` - Read-only GET / and GET /:id under /obligations
- `apps/api/src/obligations/obligations.module.ts` - Module with ObligationsService + ObligationsListener providers
- `apps/api/src/obligations/events/contract-published.event.ts` - ContractPublishedEvent DTO
- `apps/api/src/obligations/dto/query-obligations.dto.ts` - QueryObligationsDto with contractId, tenantId, status, periodStart, periodEnd, page, limit
- `apps/api/src/app.module.ts` - Added EventEmitterModule.forRoot() + ContractsModule, ContractAreasModule, ContractServicesModule, ObligationsModule

## Decisions Made

- **BillingPolicy lookup uses `status: PolicyStatus.active`** — the plan spec mentioned `isActive: true` but the actual Prisma schema uses a `status` enum (PolicyStatus); the billing-policies.service.ts confirms `status: PolicyStatus.active` for findActive queries.
- **dueDate millisecond arithmetic** — `new Date(periodEnd.getTime() + dueDateDays * 86400000)` is simple, deterministic, and correct for day-granularity due dates at this stage.
- **Test dates use local-time constructors** — `new Date(year, month, day)` matches service behavior since the service uses local-time Date constructors throughout; UTC string construction (`new Date('2024-01-31')`) created a timezone offset mismatch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed BillingPolicy lookup query: `isActive` field doesn't exist**
- **Found during:** Task 1 (obligations.service.ts implementation)
- **Issue:** Plan spec's interface block said `prisma.billingPolicy.findFirst({ where: { airportId, isActive: true } })` but the Prisma schema has no `isActive` field — uses `status: PolicyStatus.active` enum instead
- **Fix:** Used `{ where: { airportId, status: PolicyStatus.active } }` matching the actual schema and billing-policies.service.ts pattern
- **Files modified:** apps/api/src/obligations/obligations.service.ts
- **Verification:** TypeScript compiles clean, tests pass
- **Committed in:** a035a01 (Task 1 feat commit)

**2. [Rule 1 - Bug] Fixed test dueDate assertions to use local-time date constructors**
- **Found during:** Task 1 (GREEN phase, 2 of 21 tests failing)
- **Issue:** Test assertions used `new Date('2024-01-31')` (UTC midnight) but service creates dates with `new Date(year, month, day)` (local midnight), causing 1-hour offset mismatch
- **Fix:** Changed test expectations to `new Date(2024, 0, 31)` (local-time constructor)
- **Files modified:** apps/api/src/obligations/obligations.service.spec.ts
- **Verification:** All 21 tests pass
- **Committed in:** a035a01 (Task 1 feat commit, same commit since fix was part of GREEN phase)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 domain modules fully wired: ContractsModule, ContractAreasModule, ContractServicesModule, ObligationsModule all registered in AppModule with EventEmitterModule
- Obligation schedule generation is production-ready: async event listener, bulk insert, correct type/charge/currency mappings
- Phase 4 (obligation billing) can query `status=scheduled` obligations and update them with calculated amounts
- Remaining Phase 3 plan: 03-04 — may handle integration e2e tests or remaining wiring items

---
*Phase: 03-contract-domain*
*Completed: 2026-03-05*

## Self-Check: PASSED

- FOUND: apps/api/src/obligations/obligations.service.ts
- FOUND: apps/api/src/obligations/obligations.service.spec.ts
- FOUND: apps/api/src/obligations/obligations.listener.ts
- FOUND: apps/api/src/obligations/obligations.controller.ts
- FOUND: apps/api/src/obligations/obligations.module.ts
- FOUND: apps/api/src/obligations/events/contract-published.event.ts
- FOUND: apps/api/src/obligations/dto/query-obligations.dto.ts
- FOUND: .planning/phases/03-contract-domain/03-03-SUMMARY.md
- FOUND commit 9efd0b6: test(03-03): add failing tests
- FOUND commit a035a01: feat(03-03): obligation schedule generation
- FOUND commit c3c7ab7: feat(03-03): register Phase 3 modules in AppModule
