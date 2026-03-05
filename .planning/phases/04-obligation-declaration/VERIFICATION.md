---
phase: 04-obligation-declaration
verified: 2026-03-05T22:50:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 4: Obligation & Declaration Verification Report

**Phase Goal:** Deliver obligation scheduling with revenue declaration ingestion, utility meter reading, formula evaluation, proration, and MAG settlement logic (monthly higher-of + year-end true-up).
**Verified:** 2026-03-05T22:50:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Obligations transition through 9 states with state validation | VERIFIED | `OBLIGATION_TRANSITIONS` map at `obligations.service.ts:29-39` covers all 9 `ObligationStatus` values including rollbacks. `transitionObligation()` validates transitions and throws `BadRequestException` on invalid. 18 tests verify transitions (spec file). |
| 2 | User can upload revenue declarations via CSV/Excel with 6 validation rules | VERIFIED | `parseAndValidateUpload()` at `declarations.service.ts:436-603` implements MISSING_FIELDS, INVALID_TENANT, INVALID_PERIOD, NEGATIVE_AMOUNT, DUPLICATE_PERIOD, DEVIATION_THRESHOLD. `parseCSV()` and `parseExcel()` parsers present. Controller `POST /declarations/upload` with `FileInterceptor` at `declarations.controller.ts:216-245`. |
| 3 | User can submit meter readings manually with consumption calculation | VERIFIED | `submitMeterReading()` at `declarations.service.ts:702-786` fetches previous validated/frozen reading, computes `consumption = current - previous`, rejects negative consumption. `CreateMeterReadingDto` with full validation. `POST /declarations/meter-reading` endpoint. Bulk CSV upload via `parseMeterReadingUpload()` and `POST /declarations/meter-reading/upload`. |
| 4 | Formula evaluation produces calculated amount with full trace in calculationTrace JSONB | VERIFIED | `calculateObligation()` at `obligations.service.ts:449-600` calls `evaluateWithTimeout()`, stores `amount`, `calculationTrace` (trace JSONB), `formulaVersion`, `sourceDeclarationId`. `buildFormulaScope()` resolves variables from formula defaults, customParameters, contractAreas, and declaration lines. |
| 5 | MAG settlement generates mag_shortfall obligation when revenue < annual_MAG/12 | VERIFIED | `calculateMonthlyMag()` at `settlement.service.ts:27-138` computes `monthlyMag = annualMag / 12`, compares with revenue_share amount, creates `SettlementEntry` for audit, upserts `mag_shortfall` obligation via `lineHash` when shortfall > 0. No obligation created when surplus. |
| 6 | Year-end true-up compares annual total vs annual MAG and generates true-up obligation | VERIFIED | `calculateYearEndTrueUp()` at `settlement.service.ts:144-281` sums annual revenue_share obligations, nets out monthly shortfalls already paid, creates `mag_true_up` obligation when net shortfall > 0. Admin-triggered via `POST /settlement/true-up/:contractId`. |
| 7 | Proration applies to first obligation when contract starts mid-period | VERIFIED | `calculateProration()` exported at `obligations.service.ts:80-93` returns `remainingDays/totalDays` for mid-month starts, `1.0` for 1st-of-month. Applied in `calculateObligation()` at lines 520-536 for base_rent/service_charge charge types. Post-multiplication when formula lacks `proration_factor` string. |
| 8 | line_hash (SHA256) unique constraint prevents duplicate obligations | VERIFIED | `buildLineHash()` at `obligations.service.ts:50-53` uses `crypto.createHash('sha256')` with `tenantId:periodStart.toISOString():chargeType`. `generateSchedule()` sets `lineHash` on every obligation (line 247). Schema has `@@unique([lineHash])` constraint. Exported as `buildObligationLineHash()` for settlement module. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/obligations/obligations.service.ts` | State machine, lineHash, proration, calculateObligation | VERIFIED | 672 lines. OBLIGATION_TRANSITIONS, buildLineHash, calculateProration, transitionObligation, calculateObligation, buildFormulaScope, generateSchedule all present and substantive. |
| `apps/api/src/obligations/obligations.controller.ts` | PATCH /transition, POST /calculate, GET /trace | VERIFIED | 127 lines. All three endpoints present with role guards, audit decorators, Swagger docs. |
| `apps/api/src/obligations/obligations.listener.ts` | Event handlers for contract.published, declaration.submitted, obligation.calculated | VERIFIED | 161 lines. Three `@OnEvent` handlers: `handleContractPublished`, `handleDeclarationSubmitted`, `handleObligationCalculated`. All wrapped in try/catch. |
| `apps/api/src/obligations/events/obligation-calculated.event.ts` | ObligationCalculatedEvent class | VERIFIED | 16 lines. Fields: obligationId, contractId, chargeType, amount, periodStart, periodEnd. |
| `apps/api/src/obligations/dto/transition-obligation.dto.ts` | TransitionObligationDto | VERIFIED | 28 lines. toStatus with @IsEnum, optional skippedReason. |
| `apps/api/src/obligations/dto/calculate-obligation.dto.ts` | CalculateObligationDto | VERIFIED | 16 lines. Optional declarationId with @IsUUID. |
| `apps/api/src/declarations/declarations.service.ts` | CRUD, state machine, CSV/Excel upload, meter reading | VERIFIED | 984 lines. Full CRUD, 5-state machine (DECLARATION_TRANSITIONS), freeze token guard, parseAndValidateUpload (6 rules), submitMeterReading, parseMeterReadingUpload, createAttachment, getTemplate. |
| `apps/api/src/declarations/declarations.controller.ts` | REST endpoints including upload | VERIFIED | 286 lines. 16 endpoints: CRUD, state transitions (submit/validate/reject/redraft/freeze), upload, meter-reading, meter-reading/upload, attachments. |
| `apps/api/src/declarations/declaration-lines.controller.ts` | Line item CRUD | VERIFIED | 75 lines. 4 endpoints: create, list, update, delete. |
| `apps/api/src/declarations/declaration-lines.service.ts` | Thin wrapper for DI | VERIFIED | Exists, delegates to DeclarationsService. |
| `apps/api/src/declarations/declarations.module.ts` | DeclarationsModule | VERIFIED | Registers both controllers, provides both services, exports DeclarationsService. |
| `apps/api/src/declarations/events/declaration-submitted.event.ts` | DeclarationSubmittedEvent | VERIFIED | 16 lines. Fields: declarationId, contractId, tenantId, periodStart, periodEnd, declarationType. |
| `apps/api/src/declarations/dto/create-meter-reading.dto.ts` | CreateMeterReadingDto | VERIFIED | 60 lines. Full validation decorators, Swagger annotations. |
| `apps/api/src/settlement/settlement.service.ts` | Monthly MAG + year-end true-up | VERIFIED | 322 lines. calculateMonthlyMag, calculateYearEndTrueUp, findAllEntries. Creates SettlementEntry records, upserts mag_shortfall obligations, creates mag_true_up obligations. |
| `apps/api/src/settlement/settlement.controller.ts` | POST /true-up, GET /entries | VERIFIED | 110 lines. Two endpoints with inline DTOs (TrueUpDto, QuerySettlementEntriesDto), role guards, Swagger docs. |
| `apps/api/src/settlement/settlement.module.ts` | SettlementModule | VERIFIED | 17 lines. Exports SettlementService. |
| `apps/api/src/app.module.ts` | DeclarationsModule + SettlementModule registered | VERIFIED | Both imported and registered in AppModule imports array. |
| `apps/api/prisma/schema.prisma` | serviceDefinitionId nullable | VERIFIED | `serviceDefinitionId String?` at line 285. |
| `apps/api/prisma/seed.ts` | Demo declarations + meter readings | VERIFIED | 3 revenue declarations (Jan-Mar 2026, frozen, with 3 line items each) + 2 meter reading declarations (Jan-Feb electricity) for CNT-001. Idempotent with findFirst guard. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `obligations.controller.ts` | `obligations.service.ts` | `transitionObligation(id, dto.toStatus)` | WIRED | Controller line 85 calls `this.obligationsService.transitionObligation(id, dto.toStatus, { skippedReason })` |
| `obligations.controller.ts` | `obligations.service.ts` | `calculateObligation(id, dto.declarationId)` | WIRED | Controller line 124 calls `this.obligationsService.calculateObligation(id, dto.declarationId)` |
| `obligations.service.ts calculateObligation` | `formula-engine evaluateWithTimeout` | `evaluateWithTimeout(expression, scope, 100)` | WIRED | Service line 539 calls `evaluateWithTimeout(formula.expression, scope, 100)` with result checked and amount extracted |
| `obligations.service.ts calculateObligation` | `transitionObligation` | Auto-transition to ready or skipped | WIRED | Service lines 558-576 determine `newStatus` (ready/skipped), update obligation with `status: newStatus`, set `skippedAt`/`skippedReason` for zero amount |
| `obligations.service.ts calculateObligation` | `EventEmitter2` | `emit('obligation.calculated', event)` | WIRED | Service lines 589-599 create `ObligationCalculatedEvent` and emit via `this.eventEmitter.emit('obligation.calculated', event)` |
| `declarations.service.ts submit()` | `EventEmitter2` | `emit('declaration.submitted', event)` | WIRED | Service lines 238-248 create `DeclarationSubmittedEvent` and emit |
| `obligations.listener.ts` | `declarations.service.ts` | `@OnEvent('declaration.submitted')` | WIRED | Listener line 57 has `@OnEvent('declaration.submitted', { async: true })` handler that finds matching obligations and triggers calculation |
| `obligations.listener.ts` | `settlement.service.ts` | `@OnEvent('obligation.calculated') triggers calculateMonthlyMag` | WIRED | Listener lines 139-159 listen for `obligation.calculated`, filter for `revenue_share` chargeType, call `this.settlementService.calculateMonthlyMag()` |
| `settlement.service.ts calculateMonthlyMag` | `prisma.obligation.upsert` | Creates mag_shortfall via lineHash | WIRED | Service lines 94-128 call `prisma.obligation.upsert({ where: { lineHash } })` with `obligationType: mag_shortfall` |
| `settlement.controller.ts true-up` | `settlement.service.ts calculateYearEndTrueUp` | `POST /settlement/true-up/:contractId` | WIRED | Controller lines 77-91 call `settlementService.calculateYearEndTrueUp(contractId, ...)` |
| `obligations.module.ts` | `settlement.module.ts` | `imports: [SettlementModule]` | WIRED | ObligationsModule imports SettlementModule for SettlementService DI into ObligationsListener |

### Event Chain Verification

The full event chain is wired end-to-end:

1. `declaration.submitted` -- emitted by `DeclarationsService.submit()` and `submitMeterReading()`
2. Caught by `ObligationsListener.handleDeclarationSubmitted()` -- transitions obligations to `pending_calculation` then calls `calculateObligation()`
3. `calculateObligation()` evaluates formula, stores trace, transitions to `ready`/`skipped`, emits `obligation.calculated`
4. Caught by `ObligationsListener.handleObligationCalculated()` -- for `revenue_share` chargeType only, calls `SettlementService.calculateMonthlyMag()`
5. `calculateMonthlyMag()` creates `SettlementEntry` audit record and upserts `mag_shortfall` obligation if revenue < monthly MAG

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R5.1 | 04-01 | Automatic obligation schedule generation from contract services on publish | SATISFIED | `generateSchedule()` in obligations.service.ts with `contract.published` event listener |
| R5.2 | 04-01 | 9 obligation states with validation | SATISFIED | `OBLIGATION_TRANSITIONS` map covers all 9 states |
| R5.3 | 04-03 | Formula evaluation using contract snapshot + declaration inputs | SATISFIED | `calculateObligation()` with `buildFormulaScope()` |
| R5.4 | 04-01 | line_hash SHA256 unique constraint | SATISFIED | `buildLineHash()` uses crypto.createHash('sha256'), lineHash set in generateSchedule |
| R5.5 | 04-01 | Proration for mid-period contract starts | SATISFIED | `calculateProration()` with first-period check |
| R5.6 | 04-03 | Obligation amount with calculation trace JSONB | SATISFIED | calculationTrace stored as JSON with formula + inputs + result |
| R6.1 | 04-02 | Declaration CRUD with 5-state machine | SATISFIED | DECLARATION_TRANSITIONS map, CRUD methods, state transition methods |
| R6.2 | 04-02 | CSV/Excel upload with 6 validation rules | SATISFIED | parseAndValidateUpload with all 6 rules |
| R6.3 | 04-02 | Declaration line items with gross amount | SATISFIED | DeclarationLine with grossAmount, deductions, computed amount |
| R6.4 | 04-02 | Attachment upload max 10MB | SATISFIED | createAttachment with 10MB check, FileInterceptor with 10MB limit |
| R6.5 | 04-02 | Frozen declarations immutable | SATISFIED | frozenToken check in update, remove, createLine, updateLine, removeLine |
| R7.1 | 04-04 | Monthly settlement higher-of, no carry-forward | SATISFIED | calculateMonthlyMag compares revenue vs monthlyMag, no surplus carry |
| R7.2 | 04-04 | Monthly MAG shortfall generates mag_shortfall obligation | SATISFIED | Upserts obligation with obligationType mag_shortfall when shortfall > 0 |
| R7.3 | 04-04 | Year-end true-up | SATISFIED | calculateYearEndTrueUp nets monthly shortfalls, creates mag_true_up obligation |
| R7.4 | 04-04 | Each month independent, no carry-forward | SATISFIED | calculateMonthlyMag returns early when surplus; no inter-month state |
| R13.1 | 04-03 | Meter definition (type, unit, location) | SATISFIED | CreateMeterReadingDto has meterType, unit, location fields; stored in line.notes JSON |
| R13.2 | 04-03 | Meter reading entry with manual input | SATISFIED | POST /declarations/meter-reading endpoint, submitMeterReading() |
| R13.3 | 04-03 | Consumption calculation (current - previous) | SATISFIED | submitMeterReading computes consumption = currentReading - previousReading |
| R13.4 | 04-03 | Rate-based billing (consumption x unit_rate) | SATISFIED | buildFormulaScope injects `consumption` into scope; utility formula evaluates `consumption * unit_price` |
| R13.5 | 04-03 | Meter reading linked to obligation for audit | SATISFIED | sourceDeclarationId set on obligation when calculated from declaration |

**All 20 requirements from ROADMAP.md Phase 4 scope are SATISFIED.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `declarations.service.ts` | 940, 952 | "placeholder" in comment about fileUrl storage | Info | Deliberate v1 decision: fileUrl stored as path pattern, no cloud storage. Code is functional (stores metadata correctly), cloud storage deferred to v2. Not a blocker. |
| `settlement.service.ts` | 101, 251 | `null as unknown as string` for serviceDefinitionId | Info | Prisma types not regenerated (Docker unavailable for migration). Schema has `String?` but generated types still expect `String`. Workaround is correct and documented. Not a blocker. |

No TODO/FIXME/HACK/PLACEHOLDER patterns found in obligations or settlement modules. No empty implementations. No console.log-only handlers.

### Test Results

- **281/281 tests pass** (`pnpm --filter api test -- --no-coverage`)
- **TypeScript compiles clean** (`pnpm --filter api exec tsc --noEmit` -- zero errors)
- **16 test suites all pass** including obligations.service.spec, declarations.service.spec, settlement.service.spec

### Summary Files

All 4 SUMMARY.md files exist and are substantive:

| Summary | Tests Added | Total Tests |
|---------|------------|-------------|
| 04-01-SUMMARY.md | 18 | 39 |
| 04-02-SUMMARY.md | 26 | 249 |
| 04-03-SUMMARY.md | 21 | 270 |
| 04-04-SUMMARY.md | 10 | 281 |

### Human Verification Required

None required for automated verification. All phase deliverables are programmatically verifiable through tests and code analysis.

### Gaps Summary

No gaps found. All 8 success criteria from ROADMAP.md are verified. All 20 requirements are satisfied. All artifacts exist, are substantive (not stubs), and are fully wired. The event chain (declaration.submitted -> obligation calculation -> obligation.calculated -> MAG settlement) is complete and connected. Build and tests pass cleanly.

---

_Verified: 2026-03-05T22:50:00Z_
_Verifier: Claude (gsd-verifier)_
