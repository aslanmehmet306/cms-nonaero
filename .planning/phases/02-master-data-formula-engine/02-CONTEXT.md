# Phase 2: Master Data & Formula Engine - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver CRUD management for airports, areas, tenants, and service definitions. Implement a sandboxed formula engine (math.js) for pricing expressions with security hardening. Configure billing policy settings. Seed ADB demo data with realistic formulas and area hierarchy.

Contract lifecycle, obligation scheduling, and billing runs are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Service Definition Versioning
- New version row approach: changing a published service creates a new ServiceDefinition row with version+1
- Old version stays linked to existing contracts; new contracts get latest published version
- Draft services are editable; published services are immutable
- Deprecation is manual (admin action), not automatic

### Formula Sandbox Scope
- Math + conditionals whitelist: basic math functions (add, subtract, multiply, divide, max, min, round, floor, ceil) PLUS comparison operators and ternary branching
- Ternary operator enables conditional logic: `revenue > 100000 ? revenue * 0.08 : revenue * 0.05`
- No loops, no string operations, no variable assignment, no function definitions
- 100ms timeout protection on evaluation
- Detailed AST error reporting: parse expression, walk AST, return specific errors (e.g., "'process' is not an allowed identifier", "Assignment operator '=' is forbidden")

### Formula Variables
- Free-form JSON with hints: variables field defines which variables a formula uses, but schema enforcement happens at evaluation time, not at save time
- Formula authors declare expected variables; engine validates presence when evaluating, not when saving the formula

### Formula Versioning & Contract Upgrade
- Auto-upgrade next period: when a new formula version is published, existing contracts automatically use it starting next billing period
- Already-calculated obligations remain untouched (immutable once calculated per R3.5)
- New obligations use the latest published formula version

### Step-Band Formulas
- Structured bands JSON: define tiered pricing as a JSON array in the formula's variables field
- Format: `[{from: 0, to: 100000, rate: 0.05}, {from: 100000, to: 300000, rate: 0.08}, ...]`
- Formula engine interprets bands programmatically rather than encoding them in the expression

### Escalation Formulas
- Manual index_rate variable: escalation formulas use `index_rate` as a regular context variable
- Admin manually updates the rate each period; no external CPI/TUIK API integration in v1
- Formula pattern: `base_amount * (1 + index_rate)`

### Formula Dry-Run
- API endpoint: POST /formulas/:id/dry-run with sample variables in body
- Predefined sample data per formula type ships with the system (e.g., rent formula pre-fills area_m2=100, rate_per_m2=50)
- User can override predefined values
- Returns: calculated result + full calculation trace

### Service Type Validation
- Type-specific validation rules per service type (rent, revenue_share, service_charge, utility)
- Each type enforces relevant required fields and formula constraints
- Example: utility services require meter linkage reference; revenue_share requires MAG reference compatibility

### Seed Data
- Realistic set of ~10-12 formulas covering all 6 formula types
- Multiple formulas per common type (e.g., 2 rent formulas: fixed vs indexed; 2 revenue share: flat vs tiered; utility formulas per meter type)
- Seed data should feel like a real airport's pricing catalog

### Service & Formula Scoping
- Per airport: each airport has its own service definitions and formulas (airportId FK)
- No global templates or cross-airport sharing in v1

### Tenant Status Transitions
- commercial_manager, airport_admin, and super_admin can change tenant status
- Fully reversible: active <-> suspended <-> deactivated (any direction)
- Suspending a tenant cascades: all active contracts suspended, pending obligations put on_hold
- Reactivating reverses the cascade

### Tenant Required Fields
- Required at creation: code (auto-generated), name, taxId, email
- Optional: phone, address
- stripeCustomerId populated automatically on create (Stripe customer created immediately)

### Tenant Code Generation
- Auto-generated sequential codes: TNT-001, TNT-002, etc.
- Admin cannot customize the code; system ensures format consistency and uniqueness

### Tenant List API
- List endpoint supports status filter (?status=active)
- No computed summary fields (contract_count, total_area) — kept lean for this phase
- Summary/aggregation can be added in Phase 7 admin portal

### Claude's Discretion
- Seed data content for areas (terminal names, floor/zone codes, unit details)
- Area hierarchy API design (flat CRUD vs nested tree endpoints)
- Billing policy CRUD details (single active policy per airport, versioned history)
- Area assignment validation rules (leasable units only, etc.)
- Exact NestJS module structure and DTO patterns
- API pagination approach
- Error response format standardization

</decisions>

<specifics>
## Specific Ideas

- Formula engine lives in the existing `packages/formula-engine/` package (currently a stub)
- DecimalHelper from `apps/api/src/common/utils/decimal-helper.ts` should be used for all financial calculations in formula evaluation
- ADB airport already referenced in seed data patterns from Phase 1 — extend with terminals, floors, zones, units

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/formula-engine/`: Stub package ready for math.js sandbox implementation
- `DecimalHelper` (apps/api/src/common/utils/decimal-helper.ts): Financial precision utility with add, subtract, multiply, divide, roundMoney, max, min
- `PrismaService` (apps/api/src/database/prisma.service.ts): Database access service
- Auth guards and decorators (apps/api/src/common/guards/, decorators/): RBAC enforcement ready
- Users module (apps/api/src/users/): Existing CRUD pattern to follow

### Established Patterns
- NestJS modular architecture: module + controller + service + DTOs per domain
- Prisma ORM with snake_case DB mapping (@@map directives)
- JWT auth with role-based guards
- Decimal.js for all monetary values (configured with precision: 20, ROUND_HALF_UP)
- UUID primary keys across all models

### Integration Points
- Prisma schema already defines Airport, Area, Tenant, ServiceDefinition, Formula, BillingPolicy models with full relations
- Auth module provides role-based access control (7 roles defined)
- formula-engine package imported as workspace dependency
- Environment config via apps/api/src/config/env.validation.ts

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-master-data-formula-engine*
*Context gathered: 2026-03-01*
