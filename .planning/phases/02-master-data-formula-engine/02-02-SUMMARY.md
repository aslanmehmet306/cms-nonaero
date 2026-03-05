---
phase: 02-master-data-formula-engine
plan: "02"
subsystem: api
tags: [nestjs, prisma, airport, area, hierarchy, tree-query, seed]

requires:
  - phase: 01-foundation-infrastructure
    provides: DatabaseModule with global PrismaService, common decorators (@Roles, @Audit), UserRole enum

provides:
  - Airport CRUD endpoints at /api/v1/airports (findAll, findOne, create, update)
  - Area CRUD endpoints at /api/v1/areas with hierarchical tree queries (findAll, findOne, findTree, findRoots)
  - Area depth validation enforcing max 4 levels (terminal/floor/zone/unit)
  - Area type validation enforcing terminal > floor > zone > unit ordering
  - Extended seed data: ADB airport with 3 terminals, 9 floors, 21 zones, 13 leasable units

affects:
  - 02-03 (contracts reference areas via ContractArea; AreasService exported for future use)
  - 02-04 (area_m2 is a formula variable sourced from Area.areaM2)
  - 03-contracts (contract scoping uses airportId and areaId)

tech-stack:
  added: []
  patterns:
    - "NestJS module: controller + service + DTOs with PrismaService from global DatabaseModule"
    - "Tree query via explicit Prisma include nesting (3 levels: children.children.children)"
    - "Immutable FK fields in UpdateDto using OmitType(CreateDto, [airportId, parentAreaId])"
    - "Depth validation via AREA_TYPE_DEPTH lookup map instead of recursive ancestor count"
    - "Seed refactor: typed interface hierarchy (TerminalSpec/FloorSpec/ZoneSpec/UnitSpec) with recursive async function"

key-files:
  created:
    - apps/api/src/airports/airports.module.ts
    - apps/api/src/airports/airports.controller.ts
    - apps/api/src/airports/airports.service.ts
    - apps/api/src/airports/airports.service.spec.ts
    - apps/api/src/airports/dto/create-airport.dto.ts
    - apps/api/src/airports/dto/update-airport.dto.ts
    - apps/api/src/areas/areas.module.ts
    - apps/api/src/areas/areas.controller.ts
    - apps/api/src/areas/areas.service.ts
    - apps/api/src/areas/areas.service.spec.ts
    - apps/api/src/areas/dto/create-area.dto.ts
    - apps/api/src/areas/dto/update-area.dto.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/prisma/seed.ts

key-decisions:
  - "Area depth validated via AREA_TYPE_DEPTH map (terminal=1, floor=2, zone=3, unit=4) — avoids recursive parent traversal"
  - "UpdateAreaDto uses OmitType(CreateAreaDto, [airportId, parentAreaId]) to make FKs truly immutable"
  - "findRoots uses parentAreaId=null filter — terminal areas are the natural entry point for tree traversal"
  - "Seed extended with named realistic units (Duty Free Main 250m2, International Food Hall 120.5m2, etc.)"
  - "Seed made idempotent for billingPolicy via findFirst check before create"

patterns-established:
  - "NestJS module pattern: no extra imports needed (DatabaseModule is global)"
  - "Controller GET /roots defined before GET /:id to prevent 'roots' being parsed as UUID"
  - "Service exports allow downstream modules to reuse AreasService without HTTP overhead"

requirements-completed: [R2.1, R2.2]

duration: 4min
completed: 2026-03-05
---

# Phase 02 Plan 02: Airport and Area Hierarchy CRUD Summary

**NestJS Airport/Area CRUD modules with 3-level tree queries, hierarchy validation (max 4 depth, typed areaType ordering), and ADB seed data with 3 terminals and 13 named leasable units**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T10:37:57Z
- **Completed:** 2026-03-05T10:41:57Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Airport CRUD module with Swagger, @Roles, @Audit decorators and 7 passing unit tests
- Area hierarchy module with tree query (3-level Prisma include), depth validation (BadRequestException at depth >4), and areaType ordering enforcement with 16 passing unit tests
- GET /api/v1/areas/roots returns full subtree (terminal -> floor -> zone -> unit) for an airport
- Seed data extended with named ADB areas: Duty Free Main 250m2, International Food Hall 120.5m2, CIP Executive Dining 68m2, etc.
- AirportsModule and AreasModule registered in AppModule; API builds without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Airport CRUD module** - `61674a3` (feat)
2. **Task 2: Area hierarchy CRUD module with tree queries and seed extension** - `0ecf1cb` (feat)

## Files Created/Modified

- `apps/api/src/airports/airports.module.ts` - AirportsModule (exports AirportsService)
- `apps/api/src/airports/airports.controller.ts` - REST endpoints with @Roles/@Audit
- `apps/api/src/airports/airports.service.ts` - findAll, findOne, create, update with NotFoundException
- `apps/api/src/airports/airports.service.spec.ts` - 7 unit tests
- `apps/api/src/airports/dto/create-airport.dto.ts` - code, name, countryCode, currency, timezone
- `apps/api/src/airports/dto/update-airport.dto.ts` - PartialType(CreateAirportDto)
- `apps/api/src/areas/areas.module.ts` - AreasModule (exports AreasService)
- `apps/api/src/areas/areas.controller.ts` - GET /, GET /roots, GET /:id, GET /:id/tree, POST /, PATCH /:id
- `apps/api/src/areas/areas.service.ts` - findAll (filters), findOne, findTree, findRoots, create (validation), update
- `apps/api/src/areas/areas.service.spec.ts` - 16 unit tests covering all CRUD, depth, and type validation
- `apps/api/src/areas/dto/create-area.dto.ts` - airportId, parentAreaId, code, name, areaType, areaM2, isLeasable
- `apps/api/src/areas/dto/update-area.dto.ts` - OmitType(CreateAreaDto, [airportId, parentAreaId]) + isActive
- `apps/api/src/app.module.ts` - Added AirportsModule and AreasModule imports
- `apps/api/prisma/seed.ts` - Refactored with typed specs, named units, idempotent billing policy

## Decisions Made

- Depth validated via `AREA_TYPE_DEPTH` map (O(1) lookup, no recursive ancestor traversal)
- `UpdateAreaDto` uses `OmitType` to make `airportId` and `parentAreaId` truly immutable
- `GET /roots` route placed before `GET /:id` so "roots" is not incorrectly parsed as a UUID
- Seed refactored with `TerminalSpec/FloorSpec/ZoneSpec/UnitSpec` interfaces for readability and extensibility
- Billing policy seed made idempotent with `findFirst` check before `create` (was causing duplicate key on re-runs)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Airport and Area data layer complete; ready for Plan 02-03 (Tenant CRUD and Contract foundation)
- AreasService exported for use by ContractArea linking in Phase 3
- Seed provides realistic ADB data including 13 leasable units for contract assignment testing

---
*Phase: 02-master-data-formula-engine*
*Completed: 2026-03-05*
