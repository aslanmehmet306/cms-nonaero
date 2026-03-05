---
phase: 02-master-data-formula-engine
plan: "04"
subsystem: api
tags: [nestjs, prisma, formula-engine, mathjs, versioning, immutability]

# Dependency graph
requires:
  - phase: 02-master-data-formula-engine
    provides: "Formula engine package (validateFormulaAST, evaluateWithTimeout)"
provides:
  - Formula CRUD with expression validation, immutability enforcement, dry-run evaluation
  - Service Definition CRUD with versioning (new row on edit of published service)
  - Billing Policy CRUD with activation that archives previous active policy atomically
  - 12 published formulas covering all 6 formula types in ADB airport seed data
  - 8 published service definitions linked to formulas in seed data
affects:
  - 03-contract-management
  - 04-obligation-engine
  - 05-billing-engine

# Tech tracking
tech-stack:
  added:
    - "@airport-revenue/formula-engine (workspace:*) added to api/package.json"
    - "jest.config.ts: @airport-revenue/formula-engine module name mapper added"
  patterns:
    - "Immutability pattern: published entities reject updates with BadRequestException; must createNewVersion"
    - "Versioning pattern: createNewVersion creates new DB row with version+1, status=draft; old row stays linked to existing contracts"
    - "DTO definite assignment: required DTO properties use ! (strictPropertyInitialization)"
    - "Prisma JSON cast: variables field cast as any to satisfy Prisma InputJsonValue type"
    - "FormulaScope cast: mergedScope cast as FormulaScope for evaluateWithTimeout"
    - "Prisma transaction for activate: updateMany archives existing active, then update sets active"
    - "Seed upsert pattern: findFirst+create for entities without unique compound index"

key-files:
  created:
    - apps/api/src/formulas/formulas.service.ts
    - apps/api/src/formulas/formulas.controller.ts
    - apps/api/src/formulas/formulas.module.ts
    - apps/api/src/formulas/formulas.service.spec.ts
    - apps/api/src/formulas/dto/create-formula.dto.ts
    - apps/api/src/formulas/dto/update-formula.dto.ts
    - apps/api/src/formulas/dto/dry-run-formula.dto.ts
    - apps/api/src/services/services.service.ts
    - apps/api/src/services/services.controller.ts
    - apps/api/src/services/services.module.ts
    - apps/api/src/services/services.service.spec.ts
    - apps/api/src/services/dto/create-service.dto.ts
    - apps/api/src/services/dto/update-service.dto.ts
    - apps/api/src/billing-policies/billing-policies.service.ts
    - apps/api/src/billing-policies/billing-policies.controller.ts
    - apps/api/src/billing-policies/billing-policies.module.ts
    - apps/api/src/billing-policies/billing-policies.service.spec.ts
    - apps/api/src/billing-policies/dto/create-billing-policy.dto.ts
    - apps/api/src/billing-policies/dto/update-billing-policy.dto.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/prisma/seed.ts
    - apps/api/package.json
    - apps/api/jest.config.ts

key-decisions:
  - "Formula dry-run uses per-type predefined sample data (SAMPLE_DATA map) merged with user overrides"
  - "deprecate maps to archived status (FormulaStatus.archived) per existing enum design"
  - "Service publish validates linked formula is published — prevents orphaned service-formula relationships"
  - "BillingPolicy activate uses Prisma $transaction to atomically archive previous active and activate new"
  - "Seed uses findFirst+create pattern for formulas and services (no compound unique index on formula)"

patterns-established:
  - "Immutability: published entities return 400 on update; users must call /new-version"
  - "Version rows: new versions are independent DB rows preserving historical contract linkage"
  - "Formula validation at every state transition: create, update, publish all call validateFormulaAST"

requirements-completed: [R2.4, R2.5, R2.6, R3.5, R3.6]

# Metrics
duration: 11min
completed: 2026-03-05
---

# Phase 2 Plan 4: Service Definitions, Formulas, and Billing Policy CRUD Summary

**Formula CRUD with math.js expression validation + immutability, Service Definition versioning with formula-linkage validation, and Billing Policy activation with atomic policy swap — all backed by 19+22 unit tests and 12 formulas / 8 services in seed data.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-05T10:49:28Z
- **Completed:** 2026-03-05T10:59:54Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments

- Formula CRUD at /api/v1/formulas: create validates expression via formula-engine, published formulas immutable, dry-run returns calculated result + trace with predefined per-type sample data, 19 unit tests pass
- Service Definition CRUD at /api/v1/services: create links to existing formula, publish validates linked formula is also published, createNewVersion creates new DB row with version+1, 14 unit tests pass
- Billing Policy CRUD at /api/v1/billing-policies: activate uses Prisma $transaction to archive previous active policy atomically, 8 unit tests pass
- 12 published formulas seeded covering all 6 formula types (arithmetic x5, conditional x1, step_band x1, revenue_share x1, escalation x2, proration x1)
- 8 published service definitions seeded (rent x2, revenue_share x2, service_charge x1, utility x3)
- FormulasModule, ServicesModule, BillingPoliciesModule registered in AppModule
- All 124 API tests pass; formula-engine 51 tests still pass; API builds clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Formula CRUD with immutability, versioning, and dry-run** - `6820b01` (feat)
2. **Task 2: Service Definition CRUD + Billing Policy CRUD** - `c3c8426` (feat)
3. **Task 3: Register modules in AppModule + extend seed data** - `1693c1b` (feat)

_Note: TDD tasks have test-first RED phase verified before implementation (GREEN)._

## Files Created/Modified

- `apps/api/src/formulas/formulas.service.ts` - Formula CRUD with expression validation, immutability, dry-run
- `apps/api/src/formulas/formulas.controller.ts` - REST endpoints with role guards and @Audit
- `apps/api/src/formulas/formulas.module.ts` - NestJS module
- `apps/api/src/formulas/formulas.service.spec.ts` - 19 unit tests
- `apps/api/src/formulas/dto/create-formula.dto.ts` - CreateFormulaDto
- `apps/api/src/formulas/dto/update-formula.dto.ts` - UpdateFormulaDto
- `apps/api/src/formulas/dto/dry-run-formula.dto.ts` - DryRunFormulaDto
- `apps/api/src/services/services.service.ts` - Service Definition CRUD with versioning
- `apps/api/src/services/services.controller.ts` - REST endpoints with role guards and @Audit
- `apps/api/src/services/services.module.ts` - NestJS module (imports FormulasModule)
- `apps/api/src/services/services.service.spec.ts` - 14 unit tests
- `apps/api/src/services/dto/create-service.dto.ts` - CreateServiceDto
- `apps/api/src/services/dto/update-service.dto.ts` - UpdateServiceDto
- `apps/api/src/billing-policies/billing-policies.service.ts` - Billing Policy CRUD with transaction-safe activate
- `apps/api/src/billing-policies/billing-policies.controller.ts` - REST endpoints with role guards and @Audit
- `apps/api/src/billing-policies/billing-policies.module.ts` - NestJS module
- `apps/api/src/billing-policies/billing-policies.service.spec.ts` - 8 unit tests
- `apps/api/src/billing-policies/dto/create-billing-policy.dto.ts` - CreateBillingPolicyDto
- `apps/api/src/billing-policies/dto/update-billing-policy.dto.ts` - UpdateBillingPolicyDto
- `apps/api/src/app.module.ts` - Added FormulasModule, ServicesModule, BillingPoliciesModule
- `apps/api/prisma/seed.ts` - Extended with 12 formulas + 8 service definitions
- `apps/api/package.json` - Added @airport-revenue/formula-engine workspace dependency
- `apps/api/jest.config.ts` - Added @airport-revenue/formula-engine module name mapper

## Decisions Made

- Formula dry-run uses a SAMPLE_DATA constant map keyed by FormulaType — realistic defaults for each type merged with user-provided overrides
- `deprecate` maps to `FormulaStatus.archived` (enum has no `deprecated` value — user decision from earlier planning already mapped deprecated to archived)
- Service publish validates linked formula is published to prevent service-formula inconsistency at billing time
- BillingPolicy activate uses `prisma.$transaction` with `updateMany` + `update` for atomic policy swap
- Seed uses `findFirst + create` pattern because Formula and ServiceDefinition have no compound unique index (unlike Area which uses `airportId_code` unique)
- Prisma JSON field (`variables`) requires `as any` cast — `Record<string, unknown>` is not assignable to Prisma's `InputJsonValue`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma JSON field type incompatibility**
- **Found during:** Task 1 (Formula CRUD implementation)
- **Issue:** `Record<string, unknown>` not assignable to Prisma `InputJsonValue` for `variables` JSON field
- **Fix:** Cast `variables` as `any` with eslint-disable comment for Prisma create/update operations
- **Files modified:** apps/api/src/formulas/formulas.service.ts
- **Verification:** TypeScript compilation succeeds; tests pass
- **Committed in:** 6820b01 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed DTO strict property initialization errors**
- **Found during:** Task 3 (API build verification)
- **Issue:** Required DTO properties missing `!` definite assignment assertion, causing `TS2564` errors
- **Fix:** Added `!` to all required properties in CreateFormulaDto, CreateServiceDto, CreateBillingPolicyDto (consistent with existing CreateTenantDto pattern)
- **Files modified:** create-formula.dto.ts, create-service.dto.ts, create-billing-policy.dto.ts
- **Verification:** `pnpm --filter api build` succeeds with no errors
- **Committed in:** 1693c1b (Task 3 commit)

**3. [Rule 3 - Blocking] Added @airport-revenue/formula-engine jest module mapper**
- **Found during:** Task 1 (running tests)
- **Issue:** Jest could not resolve `@airport-revenue/formula-engine` import in formulas.service.spec.ts
- **Fix:** Added moduleNameMapper entry in jest.config.ts pointing to packages/formula-engine/src/index.ts
- **Files modified:** apps/api/jest.config.ts
- **Verification:** Tests resolve and pass
- **Committed in:** 6820b01 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bug fixes, 1 blocking dependency)
**Impact on plan:** All auto-fixes necessary for correctness and buildability. No scope creep.

## Issues Encountered

- FormulaScope type (`Record<string, number | number[] | Band[]>`) is stricter than the generic scope we build from merged data — required `as FormulaScope` cast when calling `evaluateWithTimeout`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FormulasModule, ServicesModule, BillingPoliciesModule all ready for use by Phase 3 (Contract Management)
- Service Definitions are the "what to charge for" master data — contracts reference them via ContractService
- Formula dry-run endpoint enables UI preview before publishing
- Phase 2 complete: all 4 plans done (02-01 formula engine, 02-02 airport+area, 02-03 tenant, 02-04 service+formula+billing-policy)

---
*Phase: 02-master-data-formula-engine*
*Completed: 2026-03-05*
