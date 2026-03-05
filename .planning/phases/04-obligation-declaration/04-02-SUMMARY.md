---
phase: 04-obligation-declaration
plan: 02
subsystem: declarations
tags: [declarations, state-machine, csv-upload, excel-upload, attachments, event-driven]
dependency_graph:
  requires: [03-01-contracts, 03-04-obligations]
  provides: [declarations-module, declaration-submitted-event]
  affects: [05-billing-run]
tech_stack:
  added: [xlsx@^0.18.5, "@types/multer"]
  patterns: [5-state-machine, csv-parsing, excel-parsing, multer-memory-storage, event-emission]
key_files:
  created:
    - apps/api/src/declarations/declarations.service.ts
    - apps/api/src/declarations/declarations.service.spec.ts
    - apps/api/src/declarations/declarations.module.ts
    - apps/api/src/declarations/declarations.controller.ts
    - apps/api/src/declarations/declaration-lines.controller.ts
    - apps/api/src/declarations/declaration-lines.service.ts
    - apps/api/src/declarations/dto/create-declaration.dto.ts
    - apps/api/src/declarations/dto/update-declaration.dto.ts
    - apps/api/src/declarations/dto/query-declarations.dto.ts
    - apps/api/src/declarations/dto/create-declaration-line.dto.ts
    - apps/api/src/declarations/dto/upload-declarations.dto.ts
    - apps/api/src/declarations/events/declaration-submitted.event.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/package.json
    - pnpm-lock.yaml
decisions:
  - "DEVIATION_THRESHOLD is a warning (not rejection) — row still created, error included in summary"
  - "frozenToken UUID check guards all mutation paths (update, remove, createLine, updateLine, removeLine)"
  - "EventEmitter2 injected with @Optional() — same pattern as ContractsService"
  - "fileUrl stored as placeholder path for v1 — no cloud storage, metadata-first approach"
  - "DeclarationLinesService thin wrapper over DeclarationsService for clean DI"
  - "DUPLICATE_PERIOD detected via in-memory Set within upload batch — no DB round-trip"
  - "Batch tenant validation via findMany({ where: { id: { in: uniqueIds } } }) for efficiency"
metrics:
  duration: 5min
  completed_date: "2026-03-05"
  tasks_completed: 2
  tests_added: 26
  tests_total: 249
  files_created: 12
  files_modified: 3
---

# Phase 4 Plan 2: DeclarationsModule Summary

DeclarationsModule with 5-state machine (draft/submitted/validated/rejected/frozen), freeze token immutability, CSV/Excel bulk upload with 6 validation rules, DeclarationLine CRUD with amount computation, attachment upload, and `declaration.submitted` event emission.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Declaration CRUD + state machine + freeze token + DeclarationLine CRUD | 18cb1bc | 12 new files, app.module.ts |
| 2 | CSV/Excel upload with 6 validation rules + attachment upload | 18cb1bc | declarations.service.ts (extended) |

## What Was Built

### DeclarationsService
- Full CRUD with `create`, `findAll` (paginated), `findOne`, `update`, `remove`
- 5-state machine: `draft → submitted → validated → frozen` (terminal), rejections at draft/submitted/validated, redraft from rejected
- `submit()` emits `declaration.submitted` event via EventEmitter2 with `@Optional()`
- `freeze()` sets `frozenAt` + `frozenToken` (UUID v4); all mutation paths check `frozenToken`
- `createLine`, `findLinesByDeclaration`, `updateLine`, `removeLine` with `amount = grossAmount - deductions`
- CSV parsing via string splitting (no external dependency)
- Excel parsing via `xlsx` library (`XLSX.read` + `XLSX.utils.sheet_to_json`)
- 6-rule validation pipeline: MISSING_FIELDS, INVALID_TENANT (batch query), INVALID_PERIOD, NEGATIVE_AMOUNT, DUPLICATE_PERIOD (Set-based), DEVIATION_THRESHOLD (warning)
- `createAttachment` enforces 10MB limit, stores metadata in `DeclarationAttachment`
- `getTemplate()` returns CSV header row string

### DeclarationsController (12 endpoints)
- POST /declarations — create
- GET /declarations — findAll
- GET /declarations/template — CSV template
- GET /declarations/:id — findOne
- PATCH /declarations/:id — update
- DELETE /declarations/:id — remove
- POST /declarations/:id/submit — submit
- POST /declarations/:id/validate — validate
- POST /declarations/:id/reject — reject
- POST /declarations/:id/redraft — redraft
- POST /declarations/:id/freeze — freeze
- POST /declarations/upload — bulk CSV/Excel upload (FileInterceptor + memoryStorage)
- POST /declarations/:id/attachments — attachment upload
- GET /declarations/:id/attachments — list attachments

### DeclarationLinesController (4 endpoints)
- POST /declarations/:declarationId/lines
- GET /declarations/:declarationId/lines
- PATCH /declaration-lines/:id
- DELETE /declaration-lines/:id

### DeclarationsModule
- Registered in AppModule under Phase 4 comment block
- Exports `DeclarationsService` for future listeners

## Decisions Made

1. **DEVIATION_THRESHOLD as warning:** Row is still created even if deviation exceeds 30%. Error included in response with rule='DEVIATION_THRESHOLD' so caller can alert users without blocking the upload.

2. **Frozen token guard pattern:** All mutations check `frozenToken` directly (not just `status === frozen`) to ensure consistency even if status becomes inconsistent. Message: "Declaration is frozen".

3. **Batch tenant validation:** All tenant IDs from upload are batched in one `findMany` query rather than N individual lookups — O(1) lookup after batch.

4. **fileUrl as placeholder path:** `uploads/{declarationId}/{uuid}/{filename}` for v1. No S3/cloud storage dependency introduced.

5. **DeclarationLinesService thin wrapper:** Delegates entirely to DeclarationsService. Provides clean injection target for the controller without duplicating logic.

6. **DUPLICATE_PERIOD via in-memory Set:** Detects duplicates within the same upload batch using `tenantId:periodStart:category` key. Does not check against existing DB declarations (would require N queries).

## Deviations from Plan

None — plan executed exactly as written. Both tasks collapsed into one commit since Task 1 and Task 2 share the same test file and were built together for the TDD cycle.

## Verification

- `pnpm --filter api test -- --testPathPattern="declarations.service.spec" --no-coverage` — 26/26 tests pass
- `pnpm --filter api test -- --no-coverage` — 249/249 tests pass (no regressions)
- `pnpm --filter api build` — TypeScript compiles clean

## Self-Check: PASSED

All 12 created files verified present. Commit 18cb1bc verified in git log.
