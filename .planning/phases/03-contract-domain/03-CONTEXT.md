# Phase 3: Contract Domain - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete contract lifecycle management: draft creation with tenant/area/service assignment, state machine transitions (draft → in_review → published → active → amended/suspended/terminated), amendment versioning with pricing-only scope, automatic obligation schedule generation on publish, and daily cron for published→active activation.

</domain>

<decisions>
## Implementation Decisions

### Amendment & Versioning
- Amendment scope: **pricing only** — override formula, custom parameters, MAG amount, and currency can be changed. Area and service add/remove is NOT allowed through amendments.
- Effective date: **user selects from future period starts** — system presents valid options (next month start, month after, etc.). Past dates and mid-month dates are rejected. Validation ensures effectiveFrom is always a period start date.
- Old version behavior: **remains active until effective date** — when amendment is created, old version stays `active` and new version gets `pending_amendment` status. Daily cron job transitions: old → `amended`, new → `active` when effective date is reached.
- At any time, only one version per contract can be `active`. The `pending_amendment` version coexists with the `active` version until cron flips them.
- Amendment history: **field-level diff between versions** — GET /contracts/:id/versions returns each version with a diff object showing `{ field: { old: value, new: value } }` for every changed field. Admin panel can render this as a changelog.

### Contract State Machine
- Claude's Discretion: specific validation rules for each state transition (e.g., which fields required for draft→in_review, which checks for in_review→published)
- Claude's Discretion: whether publish requires explicit approval or is immediate
- Tenant suspension cascade to contracts: when tenant status changes to suspended, active contracts should also be suspended (the TODO in tenants.service.ts)

### Obligation Generation
- Claude's Discretion: exact obligation generation logic on contract publish (period splitting, MAG vs revenue-share separation, currency handling)
- Claude's Discretion: how contract snapshot (JSONB) is frozen for billing determinism

### Contract-Service Overrides
- Claude's Discretion: which fields can be overridden at contract level (schema already has overrideFormulaId, overrideCurrency, overrideBillingFreq, customParameters)
- Override formula must be validated via validateFormulaAST before being accepted

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PrismaService`: All modules use PrismaService for database access — contract module follows same pattern
- `@Roles` + `@Audit` decorators: Applied to all controllers — contract endpoints need same guards
- `FormulasService.findOne()` + `validateFormulaAST()`: Used for formula validation — reuse for override formula validation
- `ServicesService.publish()`: Validates linked formula is published — similar pattern for contract publish validating linked services
- `TenantsService.updateStatus()`: Has explicit TODO for Phase 3 cascade — implement cascade here
- Pagination pattern: `{ data, meta: { total, page, limit, totalPages } }` — apply to contract listing

### Established Patterns
- Immutability enforcement: Published entities (formulas, services) reject updates with BadRequestException
- Version creation: `createNewVersion()` creates new DB row with version+1 — same pattern for contract amendments
- Status enum-based lifecycle: All entities use Prisma enum for status field
- NotFoundException guard: `findOne()` throws on missing entity — consistent across all services

### Integration Points
- `AppModule`: New ContractModule, ContractAreaModule, ContractServiceModule, ObligationModule must be registered
- `ContractArea` and `ContractService` junction tables: Cascade delete on contract delete already in schema
- `@nestjs/schedule`: Needed for daily cron job (published→active transition) — new dependency
- Formula engine: `evaluateWithTimeout()` from `@airport-revenue/formula-engine` for dry-run and obligation amount calculation

</code_context>

<specifics>
## Specific Ideas

- Amendment creates a new Contract row (new version) linked via `previousVersionId` — not an in-place update
- Daily cron should run at a configurable time (e.g., 02:00 local time) via @nestjs/schedule
- Contract number format: auto-generated like tenant codes, e.g., `CNT-001`, `CNT-002`
- Obligation schedule should cover the full contract period (effectiveFrom to effectiveTo) with monthly periods

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-contract-domain*
*Context gathered: 2026-03-05*
