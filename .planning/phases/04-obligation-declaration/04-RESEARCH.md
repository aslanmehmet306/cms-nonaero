# Phase 4: Obligation & Declaration - Research

**Researched:** 2026-03-05
**Domain:** Obligation state machine, revenue declarations (CSV/Excel), utility meter readings, formula evaluation, MAG settlement, proration, line_hash deduplication
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- MAG shortfall timing: **triggered after revenue declaration submit** — when tenant submits a revenue declaration, system automatically calculates monthly revenue share vs MAG (annual_MAG / 12). If revenue share < monthly MAG, a mag_shortfall obligation is created. No declaration = obligation stays pending_input.
- Year-end true-up: **manual trigger by admin** — admin panel button to calculate annual true-up for a contract. Compares total annual revenue share vs annual MAG. Not automated via cron.
- Multiple declarations per period: **allowed** — tenant can submit multiple declarations in one month (different categories). System sums all declaration amounts for that period when calculating MAG comparison.
- Negative shortfall: **zero, no obligation created** — if revenue share exceeds MAG for a month, shortfall = 0 and no mag_shortfall obligation is created. No carry-forward, no credit.
- All transitions: **event-driven** — no cron-based state transitions. Declaration submit, calculation completion, invoice creation etc. trigger state changes via EventEmitter2.
- Auto-skip rules: **zero-amount obligations auto-skip** — if calculated amount is 0, obligation transitions to skipped automatically.
- Post-calculation: **auto-ready** — after formula evaluation produces a calculated amount, obligation transitions directly to ready. No admin approval step.
- Rollback: **Claude's Discretion** — Claude decides which back-transitions are allowed (e.g., pending_calculation→pending_input for declaration correction) vs which are forward-only.
- Input methods: **both manual form and CSV/Excel upload** — single form entry for individual readings, bulk CSV for multiple readings at once.
- Previous reading: **auto-fetched from system** — last approved reading pulled from DB. User only enters current reading. Consumption = current - previous.
- Negative consumption: **rejected** — if current < previous, reading is rejected with error. Meter replacement handled via admin manual correction.
- Unit pricing: **via formula engine** — utility service's linked formula uses `consumption * unit_price` expression. unit_price is a formula variable, consumption is injected from meter reading.
- Meter readings use the existing Declaration model with `declarationType: meter_reading` — no separate MeterReading model needed.
- MAG comparison formula: `max(monthly_revenue_share, annual_MAG / 12)` — shortfall = `(annual_MAG / 12) - monthly_revenue_share` when positive.
- Proration: first period obligation amount = `full_amount * (remaining_days / total_days_in_period)` — only applies when contract effectiveFrom is not the 1st of the month.

### Claude's Discretion

- Rollback transitions: which back-transitions are allowed (e.g., pending_calculation→pending_input for declaration correction) vs which are forward-only.
- CSV/Excel validation rules: 6 rules from roadmap (negative amount, deviation threshold, duplicate period, missing fields, invalid tenant, invalid period) — Claude implements per roadmap spec.
- Deviation threshold percentage: Claude decides reasonable default (e.g., 30% deviation from previous period triggers warning).
- File format template: Claude provides a standard CSV template.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R5.1 | Automatic obligation schedule generation from contract services on publish | Already implemented in Phase 3 via `ObligationsService.generateSchedule()` — this phase adds state transitions and calculation |
| R5.2 | 9 obligation states: scheduled → pending_input → pending_calculation → ready → invoiced → settled → skipped → on_hold → cancelled | `OBLIGATION_STATE_MACHINE` constant in service, transition validation in `transitionObligation()` |
| R5.3 | Formula evaluation using contract snapshot + declaration inputs → calculated amount | `evaluateWithTimeout()` from `@airport-revenue/formula-engine` + contract snapshot JSON |
| R5.4 | line_hash (SHA256) unique constraint for duplicate detection | Node.js built-in `crypto.createHash('sha256')`, unique constraint on `lineHash` already in schema |
| R5.5 | Proration for new contracts starting mid-period (first obligation only) | Daily proration math: `fullAmount * (remainingDays / totalDaysInPeriod)`, trigger in `generateSchedule()` |
| R5.6 | Obligation amount stored with calculation trace (JSONB: formula + inputs + result) | `calculationTrace` JSONB field already in schema, populated by `evaluateWithTimeout()` trace |
| R6.1 | Declaration CRUD with states: draft → submitted → validated → rejected → frozen | `DeclarationsService` with state machine, `frozenToken` field already in schema |
| R6.2 | CSV/Excel upload with validation (6 rules) | Multer (`@nestjs/platform-express`) for file upload, built-in CSV parse, xlsx library for Excel |
| R6.3 | Declaration line items with gross amount (KDV dahil brüt satış) | `DeclarationLine` model already in schema with `grossAmount`, `deductions`, `amount` fields |
| R6.4 | Attachment upload for POS/Z reports (PDF, Excel, images — max 10MB) | Multer with `limits.fileSize: 10MB`, file stored to disk/memory and URL saved in `DeclarationAttachment` |
| R6.5 | Frozen declarations are immutable (freeze token prevents modification) | `frozenToken` field + check in service: throw if `frozenToken` already set |
| R7.1 | Monthly settlement: higher-of(revenue_share_amount, annual_MAG / 12) — no carry-forward | `DecimalHelper.max()` comparison, `SettlementEntry` model already in schema |
| R7.2 | Monthly MAG shortfall generates mag_shortfall obligation | Create new Obligation with `obligationType: mag_shortfall`, `chargeType: mag_settlement` |
| R7.3 | Year-end true-up: compare annual total vs annual MAG, generate true-up obligation if needed | Sum all `revenue_share` obligations for fiscal year period, compare vs `annualMag`, admin-triggered endpoint |
| R7.4 | Each month independent — surplus NOT carried to next month | No carry-forward means each settlement call is isolated to its period |
| R13.1 | Meter definition — meter type (electricity, water, gas, heating), unit, location | No `Meter` model in schema — use Declaration with `declarationType: meter_reading` + line items |
| R13.2 | Meter reading entry — manual input with timestamp | POST /declarations with declarationType=meter_reading + line with grossAmount=reading value |
| R13.3 | Consumption calculation — current reading - previous reading | Service queries last approved meter_reading declaration for same contract/period, computes diff |
| R13.4 | Rate-based billing — consumption × unit_rate formula | formula engine evaluates `consumption * unit_price` with consumption injected from meter reading |
| R13.5 | Meter reading linked to obligation for audit trail | `sourceDeclarationId` field on Obligation model already in schema |
</phase_requirements>

---

## Summary

Phase 4 extends the obligation system built in Phase 3 with the full state machine, formula calculation, and declaration-driven workflow. The Prisma schema is **complete** — no new models or migrations are needed. All three core domains (obligations, declarations, meter readings) use existing schema models: `Obligation`, `Declaration`, `DeclarationLine`, `DeclarationAttachment`, and `SettlementEntry`.

The primary work is implementing four NestJS modules:
1. **ObligationsService extension** — 9-state machine, formula evaluation, proration, line_hash, MAG settlement
2. **DeclarationsModule** — CRUD with state transitions, frozen token, CSV/Excel bulk upload with 6 validation rules
3. **DeclarationLinesModule** — line item management (grouped under declarations)
4. **MeterReadingsModule** (via Declaration model) — manual entry, auto-fetch previous reading, consumption calculation

The `@airport-revenue/formula-engine` package's `evaluateWithTimeout()` is already production-ready and handles timeout protection, Decimal.js precision, and trace generation. The `DecimalHelper` class handles all financial arithmetic (max, subtract, multiply). Node.js built-in `crypto` module provides SHA256 for line_hash. Multer (already a transitive dependency) handles CSV/Excel file uploads via `@nestjs/platform-express`.

**Primary recommendation:** Implement this phase in 4 plans: (1) obligation state machine + line_hash + proration, (2) declarations CRUD + CSV/Excel upload, (3) formula evaluation + meter readings, (4) MAG settlement + year-end true-up + seed data.

---

## Standard Stack

### Core (All Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/common` | ^10.0.0 | Injectable, BadRequestException, NotFoundException | Existing project standard |
| `@nestjs/event-emitter` | ^2.0.0 | EventEmitter2, @OnEvent — obligation state transitions | Already globally registered in AppModule |
| `@airport-revenue/formula-engine` | workspace:* | `evaluateWithTimeout()`, `evaluateFormula()` | Already used by FormulasService dry-run |
| `decimal.js` | ^10.0.0 | Financial arithmetic via DecimalHelper | Project-wide standard (R1.6) |
| `@prisma/client` | ^5.0.0 | All DB operations (Obligation, Declaration, SettlementEntry) | Existing database layer |
| `class-validator` | ^0.14.0 | DTO validation (@IsEnum, @IsDecimal, @IsISO8601) | Existing project standard |
| `class-transformer` | ^0.5.0 | @Type(() => Number) for query DTOs | Existing project standard |
| `@nestjs/swagger` | ^7.0.0 | @ApiTags, @ApiBearerAuth, @ApiOperation | All controllers require Swagger docs |
| `uuid` | ^11.0.0 | UUID generation where needed | Already installed |
| Node.js `crypto` | built-in | SHA256 for line_hash: `crypto.createHash('sha256')` | No new package needed |

### For File Upload (Already Available)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|-------------|
| `multer` | 2.0.2 | File upload handling (already transitive dep via @nestjs/platform-express) | NestJS platform-express standard |
| `@nestjs/platform-express` | ^10.0.0 | Provides `FileInterceptor`, `UploadedFile`, `Express.Multer.File` | Already in use |

**No new packages needed.** CSV parsing uses Node.js built-in string split. Excel parsing requires `xlsx` package — **must be added**.

### Packages to Install

```bash
pnpm --filter api add xlsx
pnpm --filter api add -D @types/multer
```

- `xlsx` (SheetJS) — parse `.xlsx` / `.xls` files into JSON rows in memory
- `@types/multer` — TypeScript types for `Express.Multer.File`

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `xlsx` (SheetJS) | `exceljs` | ExcelJS is streaming-capable but heavier; xlsx is simpler for in-memory validation |
| Built-in CSV split | `csv-parse` | csv-parse handles edge cases (quoted fields with commas), but adds a dependency; for structured upload templates, built-in split is sufficient |
| Node.js crypto | `crypto-js` | crypto-js is unnecessary — Node.js crypto.createHash is always available in NestJS |

---

## Architecture Patterns

### Recommended Module Structure

```
src/
├── obligations/
│   ├── obligations.controller.ts      # Extended: state transitions + calculation endpoints
│   ├── obligations.service.ts         # Extended: state machine, formula eval, MAG, proration
│   ├── obligations.listener.ts        # Existing: contract.published handler
│   ├── obligations.module.ts          # Existing: extend exports
│   ├── dto/
│   │   ├── query-obligations.dto.ts   # Existing
│   │   ├── transition-obligation.dto.ts  # NEW
│   │   └── calculate-obligation.dto.ts   # NEW
│   └── events/
│       ├── contract-published.event.ts   # Existing
│       └── declaration-submitted.event.ts # NEW
│
├── declarations/
│   ├── declarations.controller.ts     # NEW: CRUD + submit + freeze + upload
│   ├── declarations.service.ts        # NEW: state machine, validation, CSV/Excel parse
│   ├── declarations.module.ts         # NEW
│   ├── declaration-lines.controller.ts # NEW: line item CRUD
│   ├── declaration-lines.service.ts   # NEW
│   └── dto/
│       ├── create-declaration.dto.ts
│       ├── query-declarations.dto.ts
│       ├── upload-declarations.dto.ts
│       └── create-declaration-line.dto.ts
│
└── settlement/
    ├── settlement.controller.ts       # NEW: year-end true-up admin trigger
    ├── settlement.service.ts          # NEW: MAG comparison, true-up logic
    └── settlement.module.ts           # NEW
```

### Pattern 1: Obligation State Machine (ALLOWED_TRANSITIONS Map)

**What:** Same pattern as ContractsService — a const map of `ObligationStatus → ObligationStatus[]` defines valid transitions. Any attempt to skip states throws `BadRequestException`.

**When to use:** All `transitionObligation()` calls.

```typescript
// Source: contracts/contracts.service.ts pattern (adapted for obligations)
const OBLIGATION_TRANSITIONS: Record<ObligationStatus, ObligationStatus[]> = {
  [ObligationStatus.scheduled]:            [ObligationStatus.pending_input, ObligationStatus.skipped, ObligationStatus.cancelled],
  [ObligationStatus.pending_input]:        [ObligationStatus.pending_calculation, ObligationStatus.on_hold, ObligationStatus.cancelled],
  [ObligationStatus.pending_calculation]:  [ObligationStatus.ready, ObligationStatus.pending_input, ObligationStatus.on_hold],
  [ObligationStatus.ready]:                [ObligationStatus.invoiced, ObligationStatus.on_hold, ObligationStatus.cancelled],
  [ObligationStatus.invoiced]:             [ObligationStatus.settled],
  [ObligationStatus.settled]:              [], // terminal
  [ObligationStatus.skipped]:              [], // terminal
  [ObligationStatus.on_hold]:              [ObligationStatus.pending_input, ObligationStatus.pending_calculation, ObligationStatus.cancelled],
  [ObligationStatus.cancelled]:            [], // terminal
};
```

**Rollback rationale (Claude's Discretion):**
- `pending_calculation → pending_input`: allowed — admin can reject a calculation and request corrected declaration
- `on_hold → pending_input/pending_calculation`: allowed — on_hold is a pause state, not terminal
- `ready → invoiced`: forward-only (billing run drives this)
- `invoiced → settled`: forward-only (payment webhook drives this)

### Pattern 2: Formula Evaluation with Trace

**What:** `ObligationsService.calculateObligation()` fetches the contract snapshot (or active contract), resolves the formula, builds the scope from declaration/meter data, calls `evaluateWithTimeout()`, and stores trace in `calculationTrace` JSONB.

```typescript
// Source: formula-engine/src/evaluator.ts + formulas/formulas.service.ts pattern
async calculateObligation(obligationId: string): Promise<void> {
  const obligation = await this.prisma.obligation.findUnique({
    where: { id: obligationId },
    include: { contract: { include: { contractServices: { include: { serviceDefinition: { include: { formula: true } }, overrideFormula: true } } } } },
  });

  // Resolve formula: override > service default
  const contractService = obligation.contract.contractServices
    .find(cs => cs.serviceDefinitionId === obligation.serviceDefinitionId);
  const formula = contractService.overrideFormula ?? contractService.serviceDefinition.formula;

  // Build scope from contract + declaration
  const scope = buildFormulaScope(obligation, formula.variables);

  const evalResult = await evaluateWithTimeout(formula.expression, scope, 100);
  if (!evalResult.success) throw new BadRequestException(`Formula evaluation failed: ${evalResult.error}`);

  const amount = new Decimal(evalResult.result!);
  const newStatus = amount.isZero()
    ? ObligationStatus.skipped  // auto-skip zero amounts
    : ObligationStatus.ready;   // auto-ready on success

  await this.prisma.obligation.update({
    where: { id: obligationId },
    data: {
      amount,
      calculationTrace: evalResult.trace as Prisma.InputJsonValue,
      formulaVersion: formula.version,
      status: newStatus,
      ...(newStatus === ObligationStatus.skipped ? { skippedAt: new Date(), skippedReason: 'zero_amount' } : {}),
    },
  });
}
```

### Pattern 3: line_hash SHA256 Deduplication

**What:** SHA256 of `${tenantId}:${periodStart.toISOString()}:${chargeType}` stored in `lineHash`. The `@@unique([lineHash])` constraint in schema prevents duplicates. Generate before insert; catch `P2002` Prisma error for graceful duplicate handling.

```typescript
// Source: Node.js crypto built-in
import { createHash } from 'crypto';

function buildLineHash(tenantId: string, periodStart: Date, chargeType: ChargeType): string {
  const input = `${tenantId}:${periodStart.toISOString()}:${chargeType}`;
  return createHash('sha256').update(input).digest('hex');
}
```

**Important:** `generateSchedule()` currently does not set `lineHash`. Backfill is needed as part of Phase 4 plan 1 — update `generateSchedule()` to include lineHash on each obligation row.

### Pattern 4: Declaration State Machine

```typescript
const DECLARATION_TRANSITIONS: Record<DeclarationStatus, DeclarationStatus[]> = {
  [DeclarationStatus.draft]:      [DeclarationStatus.submitted, DeclarationStatus.rejected],
  [DeclarationStatus.submitted]:  [DeclarationStatus.validated, DeclarationStatus.rejected],
  [DeclarationStatus.validated]:  [DeclarationStatus.frozen, DeclarationStatus.rejected],
  [DeclarationStatus.rejected]:   [DeclarationStatus.draft],   // allow re-draft after rejection
  [DeclarationStatus.frozen]:     [],  // immutable — frozenToken set
};
```

### Pattern 5: CSV/Excel Upload with FileInterceptor

**What:** NestJS Multer `FileInterceptor` with `memoryStorage()` processes uploaded file into Buffer, then parsed in-memory. No disk writes needed for validation.

```typescript
// Source: NestJS docs + @nestjs/platform-express
import { UseInterceptors, UploadedFile, Post } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as XLSX from 'xlsx';

@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    cb(null, allowed.includes(file.mimetype));
  },
}))
async uploadDeclarations(@UploadedFile() file: Express.Multer.File) {
  // Parse CSV: file.buffer.toString('utf-8').split('\n')...
  // Parse XLSX: XLSX.read(file.buffer, { type: 'buffer' })
}
```

### Pattern 6: MAG Settlement Logic

**What:** After declaration submit, `DeclarationsService.submit()` emits `declaration.submitted` event. `ObligationsListener` receives it and calls `SettlementService.calculateMonthlyMag()`.

```typescript
// Source: CONTEXT.md decisions + schema SettlementEntry model
async calculateMonthlyMag(contractId: string, periodStart: Date, periodEnd: Date): Promise<void> {
  const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract.annualMag) return; // no MAG clause, skip

  // Sum all revenue declarations for this period (multiple declarations allowed)
  const declarations = await this.prisma.declaration.findMany({
    where: {
      contractId,
      declarationType: DeclarationType.revenue,
      periodStart,
      status: { in: [DeclarationStatus.submitted, DeclarationStatus.validated, DeclarationStatus.frozen] },
    },
    include: { lines: true },
  });

  const totalRevenue = declarations
    .flatMap(d => d.lines)
    .reduce((sum, line) => sum.plus(line.amount), new Decimal(0));

  // Find revenue_share obligation for this period to get revenue_share formula result
  // Revenue share rate comes from formula evaluation of the revenue_share obligation
  // For MAG comparison: use the revenue_share obligation amount (already calculated)
  const revShareObligation = await this.prisma.obligation.findFirst({
    where: { contractId, periodStart, chargeType: ChargeType.revenue_share, status: ObligationStatus.ready },
  });

  const monthlyMag = new Decimal(contract.annualMag).dividedBy(12);
  const revenueShareAmount = revShareObligation ? new Decimal(revShareObligation.amount!) : new Decimal(0);

  const shortfall = DecimalHelper.subtract(monthlyMag, revenueShareAmount);

  if (shortfall.isPositive()) {
    // Create mag_shortfall obligation with line_hash deduplication
    const lineHash = buildLineHash(contract.tenantId, periodStart, ChargeType.mag_settlement);
    await this.prisma.obligation.upsert({
      where: { lineHash },
      create: { /* mag_shortfall obligation fields */ },
      update: { amount: shortfall }, // re-submit updates the shortfall amount
    });
  }
}
```

### Pattern 7: Proration

**What:** First obligation gets prorated if contract `effectiveFrom` is not the 1st day of month. Applied during `generateSchedule()` when `chargeType` is `base_rent` or `service_charge` (fixed charges — not revenue_share which depends on actual revenue).

```typescript
// Source: CONTEXT.md specifics
function isProratable(chargeType: ChargeType): boolean {
  // Revenue share depends on actual revenue, not time period
  // Utility depends on meter reading, not time period
  // Only fixed charges get time-based proration
  return chargeType === ChargeType.base_rent || chargeType === ChargeType.service_charge;
}

function calculateProration(effectiveFrom: Date, periodStart: Date, periodEnd: Date): Decimal {
  const contractStart = effectiveFrom;
  const remainingDays = differenceInDays(periodEnd, contractStart) + 1;
  const totalDays = differenceInDays(periodEnd, periodStart) + 1;
  return new Decimal(remainingDays).dividedBy(totalDays);
}
```

**Note:** Proration is calculated at formula-evaluation time (when `calculateObligation()` runs), not at schedule generation time. Schedule generation creates the obligation with `amount=null`. The proration factor is injected as a scope variable (`proration_factor`) when evaluating the formula.

**Alternative:** Store proration metadata in `calculationTrace` JSONB. This provides an audit trail.

### Anti-Patterns to Avoid

- **Storing monetary amounts as JS numbers:** Always use `new Decimal(value)` from Prisma's `Decimal` or strings — the `DecimalHelper` class handles all arithmetic.
- **Setting lineHash only on mag_shortfall obligations:** lineHash must be set on ALL obligations (including base obligations) to prevent re-generation duplicates. Update `generateSchedule()` to include lineHash.
- **Using `new Date()` in UTC vs local time:** Existing codebase uses `new Date(year, month, day)` (local time) for period dates. Be consistent — don't mix UTC Date constructors for period arithmetic.
- **Not using `upsert` for MAG obligations:** When a declaration is re-submitted, the MAG shortfall amount should update, not duplicate. Use `upsert` with `lineHash` as the unique key.
- **Calling `evaluateWithTimeout` without the formula's variable definitions:** The formula `variables` field defines what inputs are expected. Build the scope from contract context + declaration inputs, matching the variable names exactly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File parsing | Custom CSV tokenizer | Built-in `String.split('\n').map(r => r.split(','))` for CSV; `xlsx.utils.sheet_to_json()` for Excel | xlsx handles merged cells, date types, empty rows — hand-rolled parsers miss edge cases |
| SHA256 hashing | Custom hash | `crypto.createHash('sha256').update(input).digest('hex')` | Already in Node.js standard library |
| Financial arithmetic | `amount - mag / 12` | `DecimalHelper.subtract()`, `DecimalHelper.max()` | Decimal precision is a project requirement (R1.6); native JS loses precision |
| Formula evaluation | Inline math.js calls | `evaluateWithTimeout(expression, scope, 100)` from formula-engine | Timeout protection, sandbox, Decimal wrapping already handled |
| State machine logic | Ad-hoc if/else checks | `OBLIGATION_TRANSITIONS` map + validate before update | Same pattern as ContractService — keeps transitions explicit and testable |
| Duplicate detection | Manual DB query before insert | `lineHash` unique constraint + catch Prisma P2002 | DB-level constraint is atomic; application-level checks have race conditions |

**Key insight:** All financial, security, and parsing primitives already exist in this codebase. Phase 4 is about orchestrating existing building blocks, not building new ones.

---

## Common Pitfalls

### Pitfall 1: lineHash Not Set on Base Obligations

**What goes wrong:** `generateSchedule()` currently creates obligations without `lineHash`. If contracts are re-published (or a re-seed runs), duplicate obligations are created because the unique constraint can't prevent `null` duplicates — `@@unique([lineHash])` does not constrain NULL values in PostgreSQL.

**Why it happens:** Phase 3 did not implement lineHash because declaration inputs were not yet in scope.

**How to avoid:** Update `generateSchedule()` to compute and set `lineHash` for every obligation before `createMany`. Also add a migration to populate existing null `lineHash` values with `UPDATE obligation SET line_hash = ...` — or the constraint will conflict with existing data.

**Warning signs:** `prisma.obligation.createMany` succeeds but duplicate rows appear in the table.

### Pitfall 2: Revenue Share MAG Calculation Ordering

**What goes wrong:** `calculateMonthlyMag()` is triggered when a declaration is submitted. But the `revenue_share` obligation may not yet be in `ready` status when the declaration is submitted (it may still be in `pending_calculation` if formula evaluation hasn't run yet).

**Why it happens:** Event ordering — declaration.submitted triggers MAG check, but formula evaluation is also triggered by declaration.submitted. Race condition between two handlers.

**How to avoid:** Trigger MAG settlement from the `obligation.calculated` event instead of `declaration.submitted`. Only after the revenue_share obligation transitions to `ready` does it emit `obligation.calculated`, then MAG check runs.

**Alternative:** Run MAG check synchronously at the end of `calculateObligation()` when the obligation chargeType is `revenue_share`.

### Pitfall 3: Prisma Decimal vs JavaScript Number

**What goes wrong:** `obligation.amount` from Prisma returns a `Prisma.Decimal` object (not a JavaScript number). Passing it directly to `new Decimal(prismaDecimal)` works, but arithmetic like `obligation.amount + monthlyMag` produces NaN.

**Why it happens:** Prisma maps `@db.Decimal` to its own Decimal type, not to decimal.js directly.

**How to avoid:** Always wrap: `new Decimal(obligation.amount!.toString())` or use `DecimalHelper` methods which accept `Decimal.Value` (string | number | Decimal).

### Pitfall 4: Multiple Declarations Summing for MAG

**What goes wrong:** If a tenant submits declarations for categories "Restaurant" and "Retail" in the same month, MAG check only compares one declaration's amount instead of the sum of all submitted declarations.

**Why it happens:** The query for revenue_share_amount queries a single declaration instead of aggregating all declarations for the period.

**How to avoid:** Always `findMany` all declarations for `(contractId, periodStart, status IN [submitted, validated, frozen])` and sum all `lines[].amount` values before comparing to monthly MAG.

### Pitfall 5: CSV Injection / Security

**What goes wrong:** A malicious CSV file with `=HYPERLINK(...)` or `@SUM(...)` formulas in cells gets executed if the file is opened in Excel later (CSV injection).

**Why it happens:** CSV cells starting with `=`, `@`, `+`, `-` are treated as formulas by spreadsheet apps.

**How to avoid:** When building CSV output (template download), prefix string cells with a tab character or single quote to prevent formula execution. When parsing uploaded CSVs, validate that numeric fields parse correctly and reject non-numeric values for amount fields.

### Pitfall 6: Year-End True-Up Fiscal Year Boundaries

**What goes wrong:** True-up calculates wrong annual total because it uses calendar year (Jan–Dec) instead of the contract's fiscal year (which could start in any month per `BillingPolicy.fiscalYearStartMonth`).

**Why it happens:** Simple `WHERE periodStart >= year-01-01` query ignores fiscal year configuration.

**How to avoid:** Look up active `BillingPolicy.fiscalYearStartMonth` for the airport. Build period bounds from fiscal year start to fiscal year end. For ADB, default is month 1 (January), so calendar year = fiscal year for the demo.

---

## Code Examples

Verified patterns from codebase inspection:

### SHA256 line_hash Generation

```typescript
// Source: Node.js built-in crypto (no import needed beyond 'crypto')
import { createHash } from 'crypto';

export function buildLineHash(
  tenantId: string,
  periodStart: Date,
  chargeType: ChargeType,
): string {
  // Use ISO string for deterministic serialization
  const input = `${tenantId}:${periodStart.toISOString()}:${chargeType}`;
  return createHash('sha256').update(input).digest('hex');
}
```

### Declaration CSV Parsing (6 Validation Rules)

```typescript
// Source: project patterns + CONTEXT.md validation rules
interface DeclarationRow {
  tenantId: string;
  periodStart: string;  // ISO date
  category: string;
  grossAmount: string;  // numeric string
}

const SIX_VALIDATION_RULES = {
  MISSING_FIELDS: (row: Partial<DeclarationRow>) =>
    !row.tenantId || !row.periodStart || !row.grossAmount,
  INVALID_TENANT: async (tenantId: string, prisma: PrismaService) =>
    !(await prisma.tenant.findUnique({ where: { id: tenantId } })),
  INVALID_PERIOD: (periodStart: string) =>
    isNaN(Date.parse(periodStart)),
  NEGATIVE_AMOUNT: (grossAmount: string) =>
    parseFloat(grossAmount) < 0,
  DUPLICATE_PERIOD: (rows: DeclarationRow[]) => {
    const seen = new Set<string>();
    return rows.some(r => {
      const key = `${r.tenantId}:${r.periodStart}:${r.category}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
  },
  DEVIATION_THRESHOLD: async (row: DeclarationRow, prisma: PrismaService, thresholdPct = 30) => {
    // Find previous period declaration for same tenant+category
    // Flag if |current - previous| / previous > thresholdPct%
  },
};
```

### Excel Parsing with xlsx

```typescript
// Source: SheetJS (xlsx) library standard usage
import * as XLSX from 'xlsx';

function parseExcelBuffer(buffer: Buffer): DeclarationRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<DeclarationRow>(sheet, { defval: '' });
}
```

### Obligation Transition Helper

```typescript
// Source: contracts/contracts.service.ts pattern
async transitionObligation(
  id: string,
  toStatus: ObligationStatus,
  opts: { skippedReason?: string } = {},
): Promise<void> {
  const obligation = await this.prisma.obligation.findUnique({ where: { id } });
  if (!obligation) throw new NotFoundException(`Obligation ${id} not found`);

  const allowed = OBLIGATION_TRANSITIONS[obligation.status as ObligationStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new BadRequestException(
      `Invalid transition: ${obligation.status} → ${toStatus}. Allowed: [${allowed.join(', ')}]`,
    );
  }

  const data: Record<string, unknown> = { status: toStatus };
  if (toStatus === ObligationStatus.skipped) {
    data.skippedAt = new Date();
    data.skippedReason = opts.skippedReason ?? 'manual';
  }

  await this.prisma.obligation.update({ where: { id }, data });
}
```

### MAG Shortfall Obligation Creation

```typescript
// Source: schema.prisma ObligationType/ChargeType enums + CONTEXT.md logic
async createMagShortfallObligation(
  contract: Contract,
  periodStart: Date,
  periodEnd: Date,
  shortfall: Decimal,
): Promise<void> {
  const lineHash = buildLineHash(contract.tenantId, periodStart, ChargeType.mag_settlement);
  const dueDate = new Date(periodEnd.getTime() + 30 * 86400000);

  await this.prisma.obligation.upsert({
    where: { lineHash },
    create: {
      airportId: contract.airportId,
      contractId: contract.id,
      contractVersion: contract.version,
      tenantId: contract.tenantId,
      serviceDefinitionId: null!, // MAG obligations have no service definition
      obligationType: ObligationType.mag_shortfall,
      chargeType: ChargeType.mag_settlement,
      periodStart,
      periodEnd,
      dueDate,
      amount: shortfall,
      currency: contract.magCurrency ?? 'TRY',
      status: ObligationStatus.ready,
      lineHash,
    },
    update: { amount: shortfall }, // re-calculation updates shortfall amount
  });
}
```

### Meter Reading Consumption Calculation

```typescript
// Source: CONTEXT.md meter reading pattern
async submitMeterReading(dto: CreateMeterReadingDto): Promise<Declaration> {
  // 1. Find previous approved reading for same contract
  const previousDeclaration = await this.prisma.declaration.findFirst({
    where: {
      contractId: dto.contractId,
      declarationType: DeclarationType.meter_reading,
      status: { in: [DeclarationStatus.validated, DeclarationStatus.frozen] },
      periodStart: { lt: dto.periodStart },
    },
    orderBy: { periodStart: 'desc' },
    include: { lines: true },
  });

  const previousReading = previousDeclaration
    ? new Decimal(previousDeclaration.lines[0].grossAmount)
    : new Decimal(0);

  const currentReading = new Decimal(dto.currentReading);

  // 2. Reject negative consumption
  if (currentReading.lessThan(previousReading)) {
    throw new BadRequestException(
      `Current reading (${currentReading}) < previous reading (${previousReading}). ` +
      `For meter replacement, use admin manual correction.`
    );
  }

  const consumption = DecimalHelper.subtract(currentReading, previousReading);

  // 3. Create Declaration with meter_reading type
  return this.prisma.declaration.create({
    data: {
      contractId: dto.contractId,
      tenantId: dto.tenantId,
      airportId: dto.airportId,
      declarationType: DeclarationType.meter_reading,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      status: DeclarationStatus.submitted,
      submittedAt: new Date(),
      lines: {
        create: [{
          grossAmount: currentReading,  // the raw reading
          amount: consumption,          // the derived consumption
          notes: `Previous reading: ${previousReading}`,
        }],
      },
    },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate MeterReading model | Declaration model with `declarationType: meter_reading` | Schema design decision (pre-Phase 4) | No new migration needed |
| Cron-based state transitions | Event-driven via EventEmitter2 | CONTEXT.md decision | All state changes are explicit, traceable, testable |
| Manual MAG calculation | Auto-triggered on declaration.submitted | CONTEXT.md decision | MAG is always current after each submission |
| Year-end cron true-up | Admin button manual trigger | CONTEXT.md decision | Gives admin control over timing |
| Disk-based file uploads | In-memory Buffer via Multer memoryStorage | Project pattern | No temp file cleanup needed; validates before saving |

**Schema note:** The `Obligation.serviceDefinitionId` field is `String` (not nullable in schema). For MAG shortfall and true-up obligations that have no service definition, this needs handling. Options:
1. Use a sentinel service definition ID ("mag-settlement" placeholder)
2. Make `serviceDefinitionId` nullable in schema — **requires migration**

**Recommendation:** Check schema carefully. Current schema shows `serviceDefinitionId String @map("service_definition_id")` — this is NOT nullable. A Prisma migration is needed to make it optional for MAG obligations. Alternatively, create a "MAG Settlement" service definition in seed data.

---

## Open Questions

1. **serviceDefinitionId nullability for MAG obligations**
   - What we know: Schema currently has `serviceDefinitionId String` (not nullable)
   - What's unclear: Can MAG shortfall obligations be created without a service definition ID?
   - Recommendation: Add a Prisma migration to make `serviceDefinitionId` optional (`String?`) — or create a MAG placeholder service definition in seed data. Migration is cleaner.

2. **Meter definition model (R13.1)**
   - What we know: CONTEXT.md says "use Declaration model with declarationType: meter_reading — no separate MeterReading model needed"
   - What's unclear: R13.1 specifies "meter type (electricity, water, gas, heating), unit, location" — this metadata has no home in current Declaration model
   - Recommendation: Store meter type/unit/location in `DeclarationLine.notes` as JSON string, or add a `metadata` JSONB field. For demo purposes, notes field is sufficient.

3. **Proration timing**
   - What we know: First obligation prorates when contract starts mid-period
   - What's unclear: Should proration factor be calculated at obligation creation time (when `generateSchedule()` runs) or at formula evaluation time?
   - Recommendation: Calculate at formula evaluation time — inject `proration_factor` as a scope variable. This allows the formula to control whether proration applies (`monthly_amount * proration_factor`).

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — skipping this section.

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `apps/api/src/obligations/obligations.service.ts` — existing schedule generation, type maps, period helpers
- Codebase inspection: `apps/api/prisma/schema.prisma` — full schema with Declaration, Obligation, SettlementEntry models
- Codebase inspection: `packages/formula-engine/src/evaluator.ts` — `evaluateWithTimeout()` API and return types
- Codebase inspection: `apps/api/src/common/utils/decimal-helper.ts` — financial arithmetic helpers
- Codebase inspection: `apps/api/src/contracts/contracts.service.ts` — state machine pattern with ALLOWED_TRANSITIONS
- Codebase inspection: `packages/shared-types/src/enums.ts` — all 25 enums including ObligationStatus, DeclarationStatus

### Secondary (MEDIUM confidence)

- NestJS platform-express documentation — FileInterceptor, UploadedFile, memoryStorage pattern
- SheetJS (xlsx) library README — `XLSX.read(buffer, { type: 'buffer' })`, `sheet_to_json()` standard usage

### Tertiary (LOW confidence)

- CONTEXT.md decisions section — user intent for MAG settlement logic and event ordering

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages inspected in installed node_modules
- Architecture: HIGH — patterns derived from existing codebase (contracts, formulas, obligations)
- Pitfalls: HIGH — identified from schema inspection, existing code, and business logic analysis
- MAG settlement: MEDIUM — logic derived from CONTEXT.md + schema; no existing implementation to validate against

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable NestJS ecosystem; 30-day window)
