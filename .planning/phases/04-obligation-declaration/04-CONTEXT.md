# Phase 4: Obligation & Declaration - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Obligation lifecycle with 9-state machine (all transitions event-driven), revenue declaration ingestion (CSV/Excel with 6 validation rules), utility meter reading (manual form + bulk CSV), formula evaluation with calculation trace, MAG settlement (monthly higher-of after declaration submit + manual year-end true-up), proration for mid-period contract starts, and line_hash deduplication.

</domain>

<decisions>
## Implementation Decisions

### MAG Settlement Logic
- MAG shortfall timing: **triggered after revenue declaration submit** — when tenant submits a revenue declaration, system automatically calculates monthly revenue share vs MAG (annual_MAG / 12). If revenue share < monthly MAG, a mag_shortfall obligation is created. No declaration = obligation stays pending_input.
- Year-end true-up: **manual trigger by admin** — admin panel button to calculate annual true-up for a contract. Compares total annual revenue share vs annual MAG. Not automated via cron.
- Multiple declarations per period: **allowed** — tenant can submit multiple declarations in one month (different categories). System sums all declaration amounts for that period when calculating MAG comparison.
- Negative shortfall: **zero, no obligation created** — if revenue share exceeds MAG for a month, shortfall = 0 and no mag_shortfall obligation is created. No carry-forward, no credit.

### Obligation State Flow
- All transitions: **event-driven** — no cron-based state transitions. Declaration submit, calculation completion, invoice creation etc. trigger state changes via EventEmitter2.
- Auto-skip rules: **zero-amount obligations auto-skip** — if calculated amount is 0, obligation transitions to skipped automatically.
- Post-calculation: **auto-ready** — after formula evaluation produces a calculated amount, obligation transitions directly to ready. No admin approval step.
- Rollback: **Claude's Discretion** — Claude decides which back-transitions are allowed (e.g., pending_calculation→pending_input for declaration correction) vs which are forward-only.

### Meter Reading & Utility
- Input methods: **both manual form and CSV/Excel upload** — single form entry for individual readings, bulk CSV for multiple readings at once.
- Previous reading: **auto-fetched from system** — last approved reading pulled from DB. User only enters current reading. Consumption = current - previous.
- Negative consumption: **rejected** — if current < previous, reading is rejected with error. Meter replacement handled via admin manual correction.
- Unit pricing: **via formula engine** — utility service's linked formula uses `consumption * unit_price` expression. unit_price is a formula variable, consumption is injected from meter reading.

### Declaration Ingestion (not discussed — Claude's Discretion)
- CSV/Excel validation rules: 6 rules from roadmap (negative amount, deviation threshold, duplicate period, missing fields, invalid tenant, invalid period) — Claude implements per roadmap spec.
- Deviation threshold percentage: Claude decides reasonable default (e.g., 30% deviation from previous period triggers warning).
- File format template: Claude provides a standard CSV template.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ObligationsService`: Already has `generateSchedule()`, `findAll()`, `findOne()` — extend with state transitions, calculation, MAG logic
- `@airport-revenue/formula-engine`: `evaluateWithTimeout()` for formula calculation, `evaluateStepBand()` for tiered pricing
- `EventEmitter2`: Already registered globally via `EventEmitterModule.forRoot()` in AppModule — use for obligation state events
- Pagination pattern: `{ data, meta: { total, page, limit, totalPages } }` consistent across all services
- `@Roles` + `@Audit` decorators: Apply to all new controllers

### Established Patterns
- Prisma schema has complete Declaration, DeclarationLine, DeclarationAttachment models — no migration needed
- Obligation model has all fields for calculation: amount, calculationTrace (JSONB), formulaVersion, sourceDeclarationId
- Type mapping tables (OBLIGATION_TYPE_MAP, CHARGE_TYPE_MAP) already in obligations.service.ts
- `generateMonthlyPeriods()` helper already exists for period arithmetic

### Integration Points
- `ObligationsModule`: Already registered in AppModule — extend service, add new endpoints
- `ContractsService.createSnapshot()`: Provides frozen contract data for billing determinism
- `FormulasService.findOne()`: Fetches formula with expression and variables for evaluation
- Declaration modules (DeclarationsModule, DeclarationLinesModule): New modules to register in AppModule
- lineHash: SHA256 of `${tenantId}:${periodStart}:${chargeType}` for deduplication — add unique constraint

</code_context>

<specifics>
## Specific Ideas

- Meter readings use the existing Declaration model with `declarationType: meter_reading` — no separate MeterReading model needed
- MAG comparison formula: `max(monthly_revenue_share, annual_MAG / 12)` — shortfall = `(annual_MAG / 12) - monthly_revenue_share` when positive
- Proration: first period obligation amount = `full_amount * (remaining_days / total_days_in_period)` — only applies when contract effectiveFrom is not the 1st of the month

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-obligation-declaration*
*Context gathered: 2026-03-05*
