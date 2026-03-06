---
phase: 04-obligation-declaration
plan: "01"
subsystem: obligations
tags: [state-machine, line-hash, proration, deduplication, api-endpoints]
dependency_graph:
  requires: [03-03-SUMMARY.md]
  provides: [obligation-state-machine, lineHash-deduplication, proration-helper, transition-api]
  affects: [04-02, 04-03, 04-04]
tech_stack:
  added: [crypto.createHash]
  patterns: [9-state-machine, SHA256-deduplication, TDD-red-green]
key_files:
  created:
    - apps/api/src/obligations/dto/transition-obligation.dto.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/obligations/obligations.service.ts
    - apps/api/src/obligations/obligations.service.spec.ts
    - apps/api/src/obligations/obligations.controller.ts
decisions:
  - OBLIGATION_TRANSITIONS map covers all 9 states with explicit rollbacks (pending_calculation->pending_input, on_hold->pending_input/pending_calculation)
  - buildLineHash uses tenantId+periodStart.toISOString()+chargeType as input (not contractId) so deduplication is per-tenant per-period per-charge-type
  - calculateProration checks date===1 AND same month/year for the 1.0 shortcut to avoid false positives
  - serviceDefinitionId made nullable (String?) in Obligation model to support MAG obligations in plan 04-04
metrics:
  duration: "5min"
  completed: "2026-03-05"
  tasks_completed: 2
  files_modified: 5
  tests_added: 18
  tests_total: 39
---

# Phase 4 Plan 1: Obligation State Machine + LineHash + Transition API Summary

**One-liner:** 9-state obligation machine with SHA256 line-hash deduplication, mid-month proration helper, and PATCH /obligations/:id/transition API endpoint.

## What Was Built

### Task 1: Schema migration + lineHash in generateSchedule + OBLIGATION_TRANSITIONS map (TDD)

**State machine:** Added `OBLIGATION_TRANSITIONS` const map covering all 9 `ObligationStatus` values with valid allowed transitions. Terminal states (settled, skipped, cancelled) have empty arrays. Rollbacks are explicitly included: `pending_calculation -> pending_input` and `on_hold -> pending_input | pending_calculation`.

**Line hash:** Added `buildLineHash(tenantId, periodStart, chargeType)` — a SHA256 hex function that produces a 64-char deterministic string. Updated `generateSchedule` to compute and attach `lineHash` on every obligation row before `createMany`. The `@@unique([lineHash])` constraint in the schema prevents duplicate obligations when contracts are re-published.

**Proration:** Added exported `calculateProration(effectiveFrom, periodStart, periodEnd): Decimal` that returns `1.0` when `effectiveFrom` is on the 1st of the same month as `periodStart`, otherwise computes `remainingDays / totalDays` using inclusive day arithmetic. Called at formula evaluation time (plan 04-03), not at schedule generation.

**Schema:** Changed `serviceDefinitionId String` to `serviceDefinitionId String?` on the Obligation model, allowing MAG obligations (plan 04-04) to be created without a linked service definition.

**TDD:** RED (39 failing TypeScript errors) → GREEN (39 passing tests).

### Task 2: Obligation transition API endpoint + query enhancements

**TransitionObligationDto:** Created at `apps/api/src/obligations/dto/transition-obligation.dto.ts` with `toStatus: ObligationStatus` and optional `skippedReason?: string`. Uses `@IsEnum` and `@IsOptional` + `@IsString` validation.

**PATCH /obligations/:id/transition:** Added to controller with:
  - Role guard: commercial_manager, finance, airport_admin, super_admin (auditor is read-only)
  - `@Audit('Obligation')` decorator for audit trail
  - Swagger `@ApiOperation` + `@ApiResponse(200, 400, 403, 404)`
  - Delegates to `transitionObligation(id, dto.toStatus, { skippedReason })`

**GET /obligations/:id/trace:** Returns the `calculationTrace` JSON field (or null) for UI drill-down into obligation calculation details (prepared for plan 04-03).

## Verification Results

- `pnpm --filter api test -- --testPathPattern="obligations" --no-coverage`: 39/39 pass
- `pnpm --filter api build`: TypeScript compiles clean
- Prisma schema has `serviceDefinitionId String?` (nullable) on Obligation model
- OBLIGATION_TRANSITIONS map has entries for all 9 states
- buildLineHash uses `crypto.createHash('sha256')`

## Decisions Made

1. **LineHash input = tenantId + periodStart + chargeType** (not contractId): deduplication is per-tenant-period-chargeType so that re-publishing generates the same hashes and the unique constraint prevents double-creation.
2. **Rollbacks explicit in OBLIGATION_TRANSITIONS**: both `pending_calculation -> pending_input` and `on_hold -> pending_input | pending_calculation` are modelled as first-class transitions, not special cases.
3. **calculateProration not applied at generateSchedule time**: proration factor is computed at formula evaluation time (plan 04-03) using the helper, keeping schedule generation pure/idempotent.
4. **serviceDefinitionId nullable**: MAG obligations don't originate from a ContractService — they're created programmatically in plan 04-04. Making the column nullable avoids a separate model for MAG-type obligations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed toStatus property definite assignment in TransitionObligationDto**
- **Found during:** Task 2 build
- **Issue:** TypeScript strict mode requires `!` (definite assignment) on class properties without constructor initialization in NestJS DTOs
- **Fix:** Changed `toStatus: ObligationStatus` to `toStatus!: ObligationStatus`
- **Files modified:** `apps/api/src/obligations/dto/transition-obligation.dto.ts`
- **Commit:** 4f3f697

**2. [Rule 3 - Blocking] Fixed pre-existing type errors in declarations.service.ts**
- **Found during:** Task 2 build
- **Issue:** Untracked `declarations.service.ts` (scaffolded for future plan 04-02) had three TypeScript errors that blocked the build: (a) `sheet_to_json` result cast to `string[]` needed `unknown as string[]`; (b) same for row cast; (c) `UploadError` interface not exported so controller return type couldn't be named
- **Fix:** Added `unknown as` intermediate cast for xlsx rows; exported `UploadError` interface
- **Files modified:** `apps/api/src/declarations/declarations.service.ts`
- **Commit:** 4f3f697

## Self-Check: PASSED

- FOUND: obligations.service.ts
- FOUND: transition-obligation.dto.ts
- FOUND: obligations.controller.ts
- FOUND: 04-01-SUMMARY.md
- FOUND commit 7e4926a (Task 1)
- FOUND commit 4f3f697 (Task 2)
