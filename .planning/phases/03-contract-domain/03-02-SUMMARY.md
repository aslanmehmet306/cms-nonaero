---
phase: 03-contract-domain
plan: "02"
subsystem: api
tags: [nestjs, prisma, junction-tables, formula-engine, crud]

# Dependency graph
requires:
  - phase: 02-master-data
    provides: Formula model + validateFormulaAST, ServiceDefinition model, Area model, PrismaService
provides:
  - ContractArea junction table CRUD (assign, remove, list areas per contract)
  - ContractService junction table CRUD (assign, update override, remove, list services per contract)
  - Formula override validation via validateFormulaAST for contract-specific pricing
affects:
  - 03-03-obligations (reads ContractService to create obligation schedules)
  - 03-04-contracts-module-wiring (registers ContractAreasModule + ContractServicesModule in AppModule)
  - 05-billing (reads ContractService overrides for billing calculation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Draft-only mutation pattern: all write operations validate contract.status === draft before proceeding
    - P2002 unique constraint catch pattern: try/catch wrapping Prisma create, rethrow as ConflictException
    - Override formula validation pipeline: findUnique -> check status=published -> validateFormulaAST
    - as any cast for Prisma Json fields (matches formulas.service.ts pattern)

key-files:
  created:
    - apps/api/src/contract-areas/contract-areas.service.ts
    - apps/api/src/contract-areas/contract-areas.controller.ts
    - apps/api/src/contract-areas/contract-areas.module.ts
    - apps/api/src/contract-areas/contract-areas.service.spec.ts
    - apps/api/src/contract-areas/dto/assign-area.dto.ts
    - apps/api/src/contract-services/contract-services.service.ts
    - apps/api/src/contract-services/contract-services.controller.ts
    - apps/api/src/contract-services/contract-services.module.ts
    - apps/api/src/contract-services/contract-services.service.spec.ts
    - apps/api/src/contract-services/dto/assign-service.dto.ts
    - apps/api/src/contract-services/dto/update-service-override.dto.ts
  modified: []

key-decisions:
  - "Draft-only mutations: all area and service assignment changes restricted to draft contracts; rejects non-draft with BadRequestException"
  - "Override formula validation requires published status AND valid AST; two separate checks before accepting overrideFormulaId"
  - "Modules not registered in AppModule yet — 03-04 (wiring plan) registers all new Phase 3 modules together"

patterns-established:
  - "Draft-gate pattern: load contract, check status === draft, throw BadRequestException otherwise — used consistently across both services"
  - "P2002 to ConflictException: catch block wrapping Prisma create, check err.code === P2002"
  - "Nested controller pattern: @Controller('contracts/:contractId/areas') and @Controller('contracts/:contractId/services')"

requirements-completed: [R4.5, R4.6]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 03 Plan 02: Contract-Area and Contract-Service Junction Tables Summary

**ContractArea and ContractService junction modules with draft-only mutations, duplicate rejection via P2002, and override formula validation through validateFormulaAST**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T13:31:35Z
- **Completed:** 2026-03-05T13:34:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- ContractArea CRUD: assign areas to draft contracts, validate contract + area existence, catch P2002 duplicate as ConflictException, remove and list with area relation
- ContractService CRUD: assign published services to draft contracts, validate override formula (published + valid AST via validateFormulaAST), update override fields, remove and list with serviceDefinition + overrideFormula relations
- 24 total unit tests pass across both spec files (9 contract-areas, 15 contract-services)

## Task Commits

Each task was committed atomically (TDD: test commit + implementation commit):

1. **Task 1: Contract-Area assignment CRUD (RED)** - `dc71929` (test)
2. **Task 1: Contract-Area assignment CRUD (GREEN)** - `16198d6` (feat)
3. **Task 2: Contract-Service assignment CRUD (RED)** - `0b0eb0c` (test)
4. **Task 2: Contract-Service assignment CRUD (GREEN)** - `72b1c9d` (feat)

_Note: TDD tasks have RED commit (failing tests) + GREEN commit (implementation)_

## Files Created/Modified
- `apps/api/src/contract-areas/contract-areas.service.ts` - assignArea/removeArea/listAreas with draft-only validation
- `apps/api/src/contract-areas/contract-areas.controller.ts` - POST/GET/DELETE nested under /contracts/:contractId/areas
- `apps/api/src/contract-areas/contract-areas.module.ts` - exports ContractAreasService
- `apps/api/src/contract-areas/contract-areas.service.spec.ts` - 9 unit tests
- `apps/api/src/contract-areas/dto/assign-area.dto.ts` - AssignAreaDto with areaId, effectiveFrom, effectiveTo
- `apps/api/src/contract-services/contract-services.service.ts` - assignService/updateOverride/removeService/listServices
- `apps/api/src/contract-services/contract-services.controller.ts` - POST/GET/PATCH/DELETE nested under /contracts/:contractId/services
- `apps/api/src/contract-services/contract-services.module.ts` - exports ContractServicesService
- `apps/api/src/contract-services/contract-services.service.spec.ts` - 15 unit tests
- `apps/api/src/contract-services/dto/assign-service.dto.ts` - AssignServiceDto with all override fields
- `apps/api/src/contract-services/dto/update-service-override.dto.ts` - UpdateServiceOverrideDto for partial override updates

## Decisions Made
- Override formula validation validates both published status AND valid AST expression — prevents assigning contracts to formulas with syntax errors
- `as any` cast used for Prisma JSON fields (customParameters) — consistent with formulas.service.ts pattern in the codebase
- Modules not registered in AppModule yet per 03-01 pattern — wiring plan (03-04) registers all Phase 3 modules together

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error for Prisma JSON customParameters field**
- **Found during:** Task 2 (Contract-Service implementation)
- **Issue:** `Record<string, unknown>` not assignable to Prisma `NullableJsonNullValueInput | InputJsonValue`; Prisma XOR update type also rejected inline spread
- **Fix:** Added `as any` cast for `customParameters` in create and update data, and `as any` for the entire update data object (consistent with codebase pattern in formulas.service.ts)
- **Files modified:** apps/api/src/contract-services/contract-services.service.ts
- **Verification:** All 15 tests pass, build compiles cleanly
- **Committed in:** `72b1c9d` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript type error)
**Impact on plan:** Type fix necessary for compilation. No scope creep. Using established `as any` pattern from formulas.service.ts.

## Issues Encountered
- Prisma JSON field type incompatibility for `customParameters` required `as any` cast — this is an established pattern in the codebase (formulas.service.ts uses same approach for `variables` field)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ContractAreasModule and ContractServicesModule are ready for registration in AppModule
- ContractAreasService and ContractServicesService exported and available for injection by ObligationsModule (03-03)
- Override formula validation pipeline established and tested
- Depends on 03-01 (ContractsModule) being complete before AppModule wiring in 03-04

---
*Phase: 03-contract-domain*
*Completed: 2026-03-05*
