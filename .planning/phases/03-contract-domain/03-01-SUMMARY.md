---
phase: 03-contract-domain
plan: "01"
subsystem: api
tags: [nestjs, prisma, typescript, state-machine, versioning, contracts]

# Dependency graph
requires:
  - phase: 02-master-data
    provides: PrismaService, formula/service/area/tenant CRUD, shared-types enums
provides:
  - Contract CRUD with auto-generated CNT-xxx numbers and draft state
  - State machine enforcing ALLOWED_TRANSITIONS with publishedAt/terminatedAt side effects
  - Amendment versioning — new Contract row (version+1, pending_amendment, previousVersionId)
  - getVersionHistory with field-level diffs across COMPARABLE_FIELDS
  - createSnapshot returning full contract JSON (billing determinism helper for Phase 5)
  - ContractsService exported for ObligationsModule (Phase 03-03+)
affects:
  - 03-02-contract-areas
  - 03-03-obligations
  - 05-billing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ALLOWED_TRANSITIONS map for state machine O(1) lookup
    - pending_amendment status for amendment coexistence (old=active, new=pending_amendment until cron flip)
    - Prisma.$transaction for atomic amendment creation + service copying
    - generateNextContractNumber queries version=1 rows only for unique CNT-xxx per contract
    - EventEmitter2 injected as @Optional() to decouple from EventEmitterModule registration
    - Field-level diff via COMPARABLE_FIELDS array + string comparison for Decimal/Date values
    - createSnapshot uses JSON.parse(JSON.stringify()) for plain-object billing determinism

key-files:
  created:
    - apps/api/src/contracts/contracts.service.ts
    - apps/api/src/contracts/contracts.controller.ts
    - apps/api/src/contracts/contracts.module.ts
    - apps/api/src/contracts/contracts.service.spec.ts
    - apps/api/src/contracts/dto/create-contract.dto.ts
    - apps/api/src/contracts/dto/update-contract.dto.ts
    - apps/api/src/contracts/dto/transition-contract.dto.ts
    - apps/api/src/contracts/dto/amend-contract.dto.ts
    - apps/api/src/contracts/dto/query-contracts.dto.ts
  modified:
    - apps/api/prisma/schema.prisma (pending_amendment added to ContractStatus enum)
    - packages/shared-types/src/enums.ts (pending_amendment added to ContractStatus enum)

key-decisions:
  - "EventEmitter2 injected with @Optional() so ContractsModule can be imported before EventEmitterModule is registered globally"
  - "Amendment effectiveFrom validation uses UTC (getUTCDate()) not local time to avoid timezone-dependent bugs"
  - "COMPARABLE_FIELDS uses string comparison for Decimal/Date equality to handle Prisma proxy object types"
  - "generateNextContractNumber queries version=1 only — ensures CNT-001/CNT-002 are per contract, not per version row"

patterns-established:
  - "State machine via ALLOWED_TRANSITIONS const map — add new states by editing one map"
  - "Amendment as new DB row pattern — previousVersionId links chain, contractNumber stays same across versions"
  - "TDD with UTC-based date helpers in tests — avoids timezone offset bugs in date boundary tests"

requirements-completed: [R4.1, R4.3, R4.4, R4.8]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 03 Plan 01: Contract Domain Summary

**Contract entity lifecycle — CRUD, 8-state machine, pricing-only amendments with new version rows, field-level version history diffs, and billing-determinism snapshot helper**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T13:30:47Z
- **Completed:** 2026-03-05T13:36:05Z
- **Tasks:** 1 (TDD: Red + Green + schema migration)
- **Files modified:** 11

## Accomplishments

- Contract CRUD with auto-generated CNT-001/CNT-002/... numbers (version=1 rows only for unique numbering)
- 8-state machine: draft -> in_review -> published -> active -> amended/suspended/terminated; pending_amendment as coexistence state for amendments
- Amendment versioning: validates pricing-only scope, future period start (1st of UTC month), no duplicate pending amendments, creates new Contract row with previousVersionId chain via $transaction
- Version history with field-level diffs across annualMag/magCurrency/effectiveFrom/effectiveTo/billingFrequency/responsibleOwner
- Snapshot helper returns plain JSON for Phase 5 billing determinism (JSONB storage)
- 23 unit tests added; total test count 171 (all passing), build clean

## Task Commits

1. **Task 1: Schema + Contract CRUD + State Machine + Amendment Versioning** - `47b2110` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD task — Red phase (cannot find module) confirmed, then Green phase with all 23 tests passing._

## Files Created/Modified

- `apps/api/prisma/schema.prisma` - Added pending_amendment to ContractStatus enum
- `packages/shared-types/src/enums.ts` - Added pending_amendment to ContractStatus enum
- `apps/api/src/contracts/contracts.service.ts` - Full service: CRUD, state machine, amendment, version history, snapshot
- `apps/api/src/contracts/contracts.controller.ts` - REST endpoints under /contracts with @Roles + @Audit
- `apps/api/src/contracts/contracts.module.ts` - Module exporting ContractsService
- `apps/api/src/contracts/contracts.service.spec.ts` - 23 unit tests covering all behaviors
- `apps/api/src/contracts/dto/create-contract.dto.ts` - CreateContractDto with class-validator
- `apps/api/src/contracts/dto/update-contract.dto.ts` - UpdateContractDto (PartialType/OmitType, excludes airportId/tenantId)
- `apps/api/src/contracts/dto/transition-contract.dto.ts` - TransitionContractDto with status + terminationReason
- `apps/api/src/contracts/dto/amend-contract.dto.ts` - AmendContractDto: effectiveFrom + pricing-only fields
- `apps/api/src/contracts/dto/query-contracts.dto.ts` - QueryContractsDto with pagination + status/tenant/airport filters

## Decisions Made

- **@Optional() EventEmitter2:** EventEmitter2 injected with `@Optional()` so ContractsModule works without EventEmitterModule registered. Plan 03 will register it globally.
- **UTC date validation:** Amendment date validation uses `getUTCDate()` to avoid local timezone surprises (e.g., UTC+3 turning "2026-04-01" local into 2026-03-31 UTC).
- **String comparison for diffs:** COMPARABLE_FIELDS diff uses `String(value)` for comparison — handles Prisma Decimal proxy objects correctly without importing Decimal.js.
- **version=1 filter for number generation:** `generateNextContractNumber` queries only `version=1` rows to avoid CNT-002 for an amendment of CNT-001.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timezone bug in test date helper**
- **Found during:** Task 1 (GREEN phase — 1 test failing)
- **Issue:** `nextMonthStart()` used local `new Date(year, month, 1).toISOString().slice(0, 10)` — in UTC+3, April 1 00:00 local = March 31 21:00 UTC, yielding "2026-03-31" which is day 31 not day 1
- **Fix:** Rewrote to use UTC arithmetic: `${nextYear}-${pad(nextMonth)}-01` directly from `getUTCMonth()`
- **Files modified:** `apps/api/src/contracts/contracts.service.spec.ts`
- **Verification:** All 23 tests pass including the amendment date validation tests
- **Committed in:** 47b2110 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added Prisma.InputJsonValue cast for JSON fields**
- **Found during:** Task 1 (GREEN phase — TypeScript compile errors)
- **Issue:** `escalationRule: Record<string, unknown>` not assignable to Prisma `NullableJsonNullValueInput | InputJsonValue`
- **Fix:** Cast JSON fields with `as Prisma.InputJsonValue`; used conditional spread for null handling
- **Files modified:** `apps/api/src/contracts/contracts.service.ts`
- **Verification:** Build passes clean, no TS2322 errors
- **Committed in:** 47b2110 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing type cast)
**Impact on plan:** Both essential for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ContractsService exported and ready for use by ContractAreasModule, ContractServicesModule, ObligationsModule
- ContractsModule not yet registered in AppModule — Plan 03 or 04 will register all new Phase 3 modules together
- EventEmitter2 @Optional() injection means transition events are fire-and-forget until EventEmitterModule registered
- pending_amendment state ready for daily cron job (Phase 3+) to flip old=amended, new=active

---
*Phase: 03-contract-domain*
*Completed: 2026-03-05*
