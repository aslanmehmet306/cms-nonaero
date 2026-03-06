---
phase: 05-billing-invoice
plan: 02
subsystem: api
tags: [sse, event-emitter, rxjs, billing, cancel, rerun, delta]

# Dependency graph
requires:
  - phase: 05-billing-invoice/05-01
    provides: BillingModule with BullMQ pipeline, state machine, EventEmitter2 progress events
provides:
  - SSE endpoint for real-time billing run progress streaming
  - Partial tenant cancellation from in-progress billing runs
  - Billing run re-run with full/delta mode based on previous status
affects: [05-billing-invoice/05-03, 05-billing-invoice/05-04, admin-ui]

# Tech tracking
tech-stack:
  added: [rxjs fromEvent, @Sse decorator, timer/takeUntil operators]
  patterns: [SSE via EventEmitter2 bridge, partial entity cancellation with filter tracking, re-run mode derivation from terminal status]

key-files:
  created:
    - apps/api/src/billing/sse/billing-sse.controller.ts
    - apps/api/src/billing/sse/billing-sse.controller.spec.ts
    - apps/api/src/billing/dto/cancel-tenant.dto.ts
    - apps/api/src/billing/dto/rerun-billing-run.dto.ts
  modified:
    - apps/api/src/billing/billing.module.ts
    - apps/api/src/billing/billing.service.ts
    - apps/api/src/billing/billing.service.spec.ts
    - apps/api/src/billing/billing.controller.ts

key-decisions:
  - "SSE endpoint uses @Public() to bypass JWT since EventSource API cannot send Authorization headers"
  - "5-minute timeout on SSE connections via rxjs timer+takeUntil prevents connection leaks"
  - "cancelTenants tracks cancelled tenants in filters.cancelledTenants JSON field for audit trail"
  - "Re-run mode derivation: cancelled/rejected -> full, completed/partial -> delta"
  - "rerunBillingRun delegates to createBillingRun to reuse concurrency check and queue logic"

patterns-established:
  - "SSE bridge pattern: EventEmitter2 -> fromEvent -> filter(billingRunId) -> map(MessageEvent)"
  - "Partial cancellation: unlink entities by nulling FK, track in JSON filters field, auto-transition on all-cancelled"

requirements-completed: [R8.3, R8.4, R8.9]

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 5 Plan 2: SSE Progress, Partial Cancel, Re-run Summary

**SSE real-time billing progress via EventEmitter2 bridge, partial tenant cancellation with audit tracking, and full/delta re-run mode derivation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-05T20:56:49Z
- **Completed:** 2026-03-05T21:03:15Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- SSE endpoint at GET /billing-runs/:id/progress streams filtered real-time events with 5-min timeout
- Partial tenant cancellation removes specific tenants from billing run without affecting others; auto-cancels run when all tenants removed
- Re-run creates new billing run from terminal run with correct mode (full from cancelled/rejected, delta from completed/partial)
- 11 new tests across 2 test suites (3 SSE + 8 service), 33 total billing tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: SSE progress endpoint with EventEmitter2 bridge** - `46cd4fc` (feat)
2. **Task 2: Partial cancel + re-run with full/delta mode** - `4d4c8d7` (feat)

## Files Created/Modified
- `apps/api/src/billing/sse/billing-sse.controller.ts` - SSE endpoint with rxjs Observable, @Public(), 5-min timeout
- `apps/api/src/billing/sse/billing-sse.controller.spec.ts` - 3 tests: event emission, ID filtering, @Public metadata
- `apps/api/src/billing/dto/cancel-tenant.dto.ts` - DTO with tenantIds UUID array validation
- `apps/api/src/billing/dto/rerun-billing-run.dto.ts` - DTO with previousRunId UUID validation
- `apps/api/src/billing/billing.module.ts` - Added BillingSseController to controllers
- `apps/api/src/billing/billing.service.ts` - Added cancelTenants and rerunBillingRun methods
- `apps/api/src/billing/billing.service.spec.ts` - Added 8 tests for cancel + rerun (21 total)
- `apps/api/src/billing/billing.controller.ts` - Added PATCH cancel-tenants and POST rerun endpoints

## Decisions Made
- SSE endpoint uses @Public() to bypass JWT since EventSource API cannot send Authorization headers; optional query token parameter for basic security
- 5-minute timeout on SSE connections via rxjs timer+takeUntil prevents connection leaks; clients should reconnect
- cancelTenants tracks cancelled tenants in filters.cancelledTenants JSON field (not separate table) for simplicity and audit trail
- Re-run mode derived from previous run terminal status: cancelled/rejected = full (redo everything), completed/partial = delta (only new/changed)
- rerunBillingRun delegates to createBillingRun to reuse concurrency enforcement (R8.7) and BullMQ queue logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SSE endpoint ready for admin UI integration (Phase 7 or admin dashboard)
- Cancel/rerun endpoints ready for Stripe invoice generation (05-03)
- Progress events flow: BillingRunProcessor -> EventEmitter2 -> SSE -> admin UI

## Self-Check: PASSED

- All 5 created files verified on disk
- Commit 46cd4fc (Task 1) verified in git log
- Commit 4d4c8d7 (Task 2) verified in git log
- Build compiles cleanly
- 33 billing tests pass

---
*Phase: 05-billing-invoice*
*Completed: 2026-03-06*
