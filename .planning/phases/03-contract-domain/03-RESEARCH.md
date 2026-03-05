# Phase 3: Contract Domain - Research

**Researched:** 2026-03-05
**Domain:** NestJS contract lifecycle, state machine, amendment versioning, obligation schedule generation, cron scheduling
**Confidence:** HIGH

## Summary

Phase 3 implements the core commercial entity of the system: the Contract. Contracts sit at the intersection of tenants, areas, services, and billing — they are the source of truth for what a tenant owes and when. The primary complexity is three-fold: (1) a multi-state lifecycle machine with business rules at each transition, (2) amendment versioning where the old version stays active until an effective date, and (3) automatic obligation schedule generation triggered by the publish event.

The codebase is already in strong shape. The Prisma schema fully models the Contract, ContractArea, ContractService, and Obligation entities. All required enums exist in `@shared-types`. The formula engine (`evaluateWithTimeout`, `validateFormulaAST`) is available and already used in Phase 2. The `@nestjs/event-emitter` package is installed and ready to wire. The only new package required is `@nestjs/schedule` for the daily cron job.

**Primary recommendation:** Decompose into 4 plans: (1) Contract CRUD + State Machine, (2) Contract Areas + Services (junction tables + overrides), (3) Obligation Schedule Generation (event-driven, on publish), (4) Cron Jobs + Tenant Suspension Cascade. Follow the established service/controller/spec pattern exactly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Amendment Scope:**
- Pricing only: override formula, custom parameters, MAG amount, and currency can be changed. Area and service add/remove is NOT allowed through amendments.

**Effective Date:**
- User selects from future period starts — system presents valid options (next month start, month after, etc.). Past dates and mid-month dates are rejected. Validation ensures effectiveFrom is always a period start date.

**Old Version Behavior on Amendment:**
- Old version remains active until effective date. When amendment is created, old version stays `active` and new version gets `pending_amendment` status. Daily cron transitions: old → `amended`, new → `active` when effective date is reached.
- At any time, only one version per contract can be `active`. The `pending_amendment` version coexists with the active version until cron flips them.

**Amendment History:**
- Field-level diff between versions: `GET /contracts/:id/versions` returns each version with a diff object showing `{ field: { old: value, new: value } }` for every changed field.

**Contract-Specific Specifics:**
- Amendment creates a new Contract row (new version) linked via `previousVersionId` — not an in-place update
- Daily cron runs at configurable time (e.g., 02:00 local) via @nestjs/schedule
- Contract number format: auto-generated like tenant codes, e.g., `CNT-001`, `CNT-002`
- Obligation schedule covers full contract period (effectiveFrom to effectiveTo) with monthly periods

### Claude's Discretion

**State Machine Validation:**
- Specific validation rules for each state transition (which fields required for draft→in_review, which checks for in_review→published)
- Whether publish requires explicit approval or is immediate

**Tenant Suspension Cascade:**
- When tenant status changes to suspended, active contracts should also be suspended (the TODO in tenants.service.ts)

**Obligation Generation:**
- Exact obligation generation logic on contract publish (period splitting, MAG vs revenue-share separation, currency handling)
- How contract snapshot (JSONB) is frozen for billing determinism

**Contract-Service Overrides:**
- Which fields can be overridden at contract level (schema already has overrideFormulaId, overrideCurrency, overrideBillingFreq, customParameters)
- Override formula must be validated via validateFormulaAST before being accepted

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R4.1 | Contract CRUD with state machine: draft → in_review → published → active → amended/suspended/terminated | Prisma schema ready, ContractStatus enum exists, validation patterns from ServicesService.publish() |
| R4.2 | Contract publish triggers automatic obligation schedule generation | @nestjs/event-emitter (v2.1.1 installed), ContractPublished event pattern, Obligation model fully defined |
| R4.3 | Contract versioning — amendments create new version, previous version archived | previousVersionId FK in Contract schema, createNewVersion() pattern from ServicesService |
| R4.4 | Amendment effective date = next full period start only (no mid-month) | Date arithmetic with JavaScript Date/day-of-month validation, enforced in ContractsService.amend() |
| R4.5 | Contract-service assignment with optional formula override per service | ContractService junction table with overrideFormulaId/overrideCurrency/overrideBillingFreq/customParameters in schema |
| R4.6 | Contract-area assignment (which spaces the tenant occupies) | ContractArea junction table with contractId+areaId unique constraint in schema |
| R4.7 | Published → Active transition: daily cron + API-time check (signed_at + effective_from) | @nestjs/schedule v6.1.1 to install, @Cron decorator, ScheduleModule.forRoot() |
| R4.8 | Contract snapshot (JSONB) frozen at billing run start for deterministic billing | BillingRun.contractSnapshot Json field in schema; snapshot logic in BillingRunService (Phase 5) — Phase 3 provides the snapshot helper method on ContractsService |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/common` | ^10.0.0 | Controllers, services, decorators | Already in project |
| `@prisma/client` | ^5.22.0 | Database ORM — Contract/ContractArea/ContractService/Obligation | Already in project, schema complete |
| `@nestjs/event-emitter` | ^2.1.1 | ContractPublished event → obligation generation | Already installed, not yet wired |
| `@nestjs/schedule` | ^6.1.1 | Daily cron job for published→active transition | New dependency, compatible with NestJS 10 |
| `@airport-revenue/formula-engine` | workspace:* | Formula validation for override formulas | Already in project |
| `@shared-types/enums` | workspace:* | ContractStatus, ObligationStatus, ChargeType enums | Already in project |
| `decimal.js` | ^10.0.0 | Financial arithmetic in obligation amounts | Already in project, global pattern established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nestjs-cls` | ^4.0.0 | CLS context for audit actor/airportId | Already in project, used in AuditService |
| `class-validator` | ^0.14.0 | DTO validation | Already in project |
| `class-transformer` | ^0.5.0 | DTO transformation | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@nestjs/event-emitter` | Direct service call | Event-driven decoupling is cleaner; obligation generation triggered asynchronously on publish |
| `@nestjs/schedule` | BullMQ job | Cron is simpler for this use case; no distributed lock needed for single-airport demo |

**Installation (new dependency only):**
```bash
pnpm add @nestjs/schedule --filter api
```

## Architecture Patterns

### Recommended Module Structure
```
src/
├── contracts/
│   ├── dto/
│   │   ├── create-contract.dto.ts
│   │   ├── update-contract.dto.ts
│   │   ├── transition-contract.dto.ts
│   │   ├── amend-contract.dto.ts
│   │   └── query-contracts.dto.ts
│   ├── contracts.controller.ts
│   ├── contracts.module.ts
│   ├── contracts.service.ts
│   └── contracts.service.spec.ts
├── contract-areas/
│   ├── dto/
│   │   ├── assign-area.dto.ts
│   │   └── remove-area.dto.ts
│   ├── contract-areas.controller.ts
│   ├── contract-areas.module.ts
│   ├── contract-areas.service.ts
│   └── contract-areas.service.spec.ts
├── contract-services/
│   ├── dto/
│   │   ├── assign-service.dto.ts
│   │   └── update-service-override.dto.ts
│   ├── contract-services.controller.ts
│   ├── contract-services.module.ts
│   ├── contract-services.service.ts
│   └── contract-services.service.spec.ts
├── obligations/
│   ├── events/
│   │   └── contract-published.event.ts
│   ├── obligations.listener.ts      ← @OnEvent('contract.published')
│   ├── obligations.service.ts       ← schedule generation logic
│   ├── obligations.controller.ts    ← read-only list/get
│   ├── obligations.module.ts
│   └── obligations.service.spec.ts
└── scheduler/
    ├── contract-scheduler.service.ts   ← @Cron for published→active
    └── contract-scheduler.module.ts
```

### Pattern 1: Contract State Machine
**What:** State transitions are explicit named methods on ContractsService, each with guard assertions.
**When to use:** Any POST /:id/transition or POST /:id/submit-for-review endpoint.
**Example:**
```typescript
// Allowed transitions map — prevents invalid transitions at service layer
const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.draft]: [ContractStatus.in_review],
  [ContractStatus.in_review]: [ContractStatus.published, ContractStatus.draft],
  [ContractStatus.published]: [ContractStatus.active],
  [ContractStatus.active]: [ContractStatus.amended, ContractStatus.suspended, ContractStatus.terminated],
  [ContractStatus.suspended]: [ContractStatus.active, ContractStatus.terminated],
  [ContractStatus.amended]: [],  // terminal after flip
  [ContractStatus.terminated]: [], // terminal
};

async transition(id: string, toStatus: ContractStatus): Promise<Contract> {
  const contract = await this.findOne(id);
  const allowed = ALLOWED_TRANSITIONS[contract.status];
  if (!allowed.includes(toStatus)) {
    throw new BadRequestException(
      `Cannot transition contract from '${contract.status}' to '${toStatus}'`,
    );
  }
  // ... additional validation per transition ...
  return this.prisma.contract.update({ where: { id }, data: { status: toStatus } });
}
```

### Pattern 2: Contract Publish with Event Emission
**What:** On publish, validate prerequisites, update status, then emit `contract.published` event.
**When to use:** POST /contracts/:id/publish endpoint.
**Example:**
```typescript
// Source: @nestjs/event-emitter v2.1.1 dist/index.d.ts
import { EventEmitter2 } from '@nestjs/event-emitter';

async publish(id: string): Promise<Contract> {
  const contract = await this.findOne(id);
  if (contract.status !== ContractStatus.in_review) {
    throw new BadRequestException('Only in_review contracts can be published.');
  }
  // Validate: all assigned services must be published
  const services = await this.prisma.contractService.findMany({
    where: { contractId: id },
    include: { serviceDefinition: true },
  });
  for (const cs of services) {
    if (cs.serviceDefinition.status !== ServiceStatus.published) {
      throw new BadRequestException(
        `Service '${cs.serviceDefinition.code}' must be published before publishing contract.`,
      );
    }
  }
  const updated = await this.prisma.contract.update({
    where: { id },
    data: { status: ContractStatus.published, publishedAt: new Date() },
    include: { contractServices: { include: { serviceDefinition: true } }, contractAreas: true },
  });
  // Fire-and-forget event — obligation generation is async
  this.eventEmitter.emit('contract.published', { contractId: id });
  return updated;
}
```

### Pattern 3: Obligation Schedule Generation (Event Listener)
**What:** ObligationsListener handles `contract.published` event by generating one Obligation row per service per billing period.
**When to use:** Triggered automatically on contract publish.
**Example:**
```typescript
// Source: @nestjs/event-emitter dist/decorators/on-event.decorator.d.ts
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class ObligationsListener {
  constructor(private readonly obligationsService: ObligationsService) {}

  @OnEvent('contract.published', { async: true })
  async handleContractPublished(payload: { contractId: string }): Promise<void> {
    await this.obligationsService.generateSchedule(payload.contractId);
  }
}

// In ObligationsService.generateSchedule():
// 1. Load contract with contractServices
// 2. For each ContractService:
//    - Determine effective currency (overrideCurrency ?? serviceDefinition.defaultCurrency)
//    - Determine billing frequency (overrideBillingFreq ?? serviceDefinition.defaultBillingFreq)
//    - Generate monthly periods from contract.effectiveFrom to contract.effectiveTo
//    - Create one Obligation per period with status=scheduled
// 3. Compute dueDate from BillingPolicy.dueDateDays
// 4. Map service type → obligation type (rent→rent, revenue_share→revenue_share, etc.)
```

### Pattern 4: Amendment Versioning
**What:** Amendment creates a new Contract row (version+1) linked via previousVersionId; old version stays active until effectiveFrom.
**When to use:** POST /contracts/:id/amend endpoint.
**Example:**
```typescript
async amend(id: string, dto: AmendContractDto): Promise<Contract> {
  const activeContract = await this.findOne(id);
  if (activeContract.status !== ContractStatus.active) {
    throw new BadRequestException('Only active contracts can be amended.');
  }

  // Validate effectiveFrom is a future period start (first of a future month)
  const effectiveFrom = new Date(dto.effectiveFrom);
  const now = new Date();
  if (effectiveFrom.getDate() !== 1) {
    throw new BadRequestException('Amendment effective date must be the first day of a month.');
  }
  if (effectiveFrom <= now) {
    throw new BadRequestException('Amendment effective date must be in the future.');
  }

  // Create new version via Prisma transaction
  return this.prisma.$transaction(async (tx) => {
    const newVersion = await tx.contract.create({
      data: {
        airportId: activeContract.airportId,
        tenantId: activeContract.tenantId,
        contractNumber: activeContract.contractNumber,
        version: activeContract.version + 1,
        previousVersionId: activeContract.id,
        status: ContractStatus.pending_amendment,  // NEW status needed — see note below
        effectiveFrom: effectiveFrom,
        effectiveTo: activeContract.effectiveTo,
        annualMag: dto.annualMag ?? activeContract.annualMag,
        magCurrency: dto.magCurrency ?? activeContract.magCurrency,
        billingFrequency: activeContract.billingFrequency,
        responsibleOwner: activeContract.responsibleOwner,
      },
    });
    // Copy contractServices with pricing overrides applied
    // Old contract remains active — no change
    return newVersion;
  });
}
```

**IMPORTANT NOTE ON `pending_amendment` STATUS:** The current `ContractStatus` enum does NOT include `pending_amendment`. The CONTEXT.md specifies the new version gets `pending_amendment` status. This means the Prisma schema enum needs a migration to add `pending_amendment` to `ContractStatus`. Alternatively, this can be modeled as a boolean `isPendingAmendment` flag or a different status (e.g., `in_review` repurposed). The planner must decide: add `pending_amendment` to the enum via migration, or use a different approach. **Recommended: add `pending_amendment` to `ContractStatus` enum via a Prisma migration** — it is the cleanest model.

### Pattern 5: Daily Cron (published→active and amendment flip)
**What:** Scheduled job runs at 02:00 to check all contracts due for status transition.
**When to use:** ScheduleModule registered in AppModule.
**Example:**
```typescript
// @nestjs/schedule v6.1.1 — CronExpression enum available
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ContractSchedulerService {
  private readonly logger = new Logger(ContractSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs daily at 02:00
  @Cron('0 2 * * *', { name: 'contract-activation', timeZone: 'Europe/Istanbul' })
  async activatePublishedContracts(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. published → active: signed_at is set AND effectiveFrom <= today
    const toActivate = await this.prisma.contract.findMany({
      where: {
        status: ContractStatus.published,
        signedAt: { not: null },
        effectiveFrom: { lte: today },
      },
    });
    for (const contract of toActivate) {
      await this.prisma.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.active },
      });
      this.logger.log(`Activated contract ${contract.contractNumber} v${contract.version}`);
    }

    // 2. pending_amendment flip: effectiveFrom <= today
    //    old (active) → amended
    //    new (pending_amendment) → active
    // ... similar pattern with transaction
  }
}
```

### Pattern 6: Contract Number Auto-Generation
**What:** Same pattern as tenant code generation (TNT-001 → CNT-001).
**Example:**
```typescript
// Mirrors TenantsService.generateNextTenantCode()
async generateNextContractNumber(airportId: string): Promise<string> {
  const lastContract = await this.prisma.contract.findFirst({
    where: { airportId, version: 1 },  // only version 1 rows for unique numbering
    orderBy: { contractNumber: 'desc' },
    select: { contractNumber: true },
  });

  if (!lastContract) return 'CNT-001';

  const match = lastContract.contractNumber.match(/^CNT-(\d+)$/);
  if (!match) return 'CNT-001';

  const nextNumber = parseInt(match[1], 10) + 1;
  return `CNT-${String(nextNumber).padStart(3, '0')}`;
}
```

### Pattern 7: Contract Snapshot Helper
**What:** Provides a frozen JSON snapshot of a contract for billing determinism (R4.8). Called by BillingRunService in Phase 5 but implemented here.
**Example:**
```typescript
async createSnapshot(contractId: string): Promise<Record<string, unknown>> {
  const contract = await this.prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      contractServices: { include: { serviceDefinition: true, overrideFormula: true } },
      contractAreas: { include: { area: true } },
      tenant: true,
    },
  });
  if (!contract) throw new NotFoundException(`Contract ${contractId} not found`);
  // Return plain object — caller stores as JSONB
  return JSON.parse(JSON.stringify(contract));
}
```

### Anti-Patterns to Avoid
- **Mutating active contracts in-place for amendments:** Amendments MUST create new rows. In-place mutation destroys version history and breaks billing determinism.
- **Generating obligations synchronously in the publish endpoint:** Use `event-emitter` with `{ async: true }` so the HTTP response returns immediately. Obligation generation can be slow for long contracts.
- **Calculating period dates with JS native arithmetic:** Month boundaries are error-prone. Use explicit date logic: `new Date(year, month + n, 1)` to always get first-of-month. Never add 30 days.
- **Missing Prisma transaction on amendment:** The old version status change and new version creation must be atomic. Use `prisma.$transaction()`.
- **Calling ContractsService from ObligationsListener (circular dep):** ObligationsListener should only call ObligationsService. Pass full context in the event payload if needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setInterval or OS crontab | `@nestjs/schedule` with `@Cron` decorator | Handles lifecycle, timezone, NestJS DI injection |
| Event-driven obligation generation | Direct service call in publish() | `@nestjs/event-emitter` `@OnEvent` | Decouples publish from obligation logic, supports multiple listeners |
| Formula validation in overrides | Custom expression parser | `validateFormulaAST()` from formula-engine | Already hardened, AST traversal, sandbox-safe |
| Financial arithmetic in obligation amounts | Native JS number | `Decimal.js` (already used project-wide) | Floating point precision, global project rule |
| Date period generation | Manual month iteration | Explicit `new Date(year, month + i, 1)` | Correct, predictable; avoids DST/leap year bugs |

**Key insight:** The hard parts of this phase (formula eval, financial arithmetic, event decoupling) already have solutions in the codebase. The contract domain is coordination logic, not algorithmic complexity.

## Common Pitfalls

### Pitfall 1: Missing `pending_amendment` in ContractStatus Enum
**What goes wrong:** Code references `ContractStatus.pending_amendment` but it doesn't exist in the Prisma schema enum — TypeScript compiles but Prisma throws a runtime error.
**Why it happens:** The CONTEXT.md specifies this status but the schema was written before this decision was made.
**How to avoid:** Add `pending_amendment` to the `ContractStatus` enum in `schema.prisma` and run `prisma migrate dev` before writing service code that uses it.
**Warning signs:** TypeScript error `Property 'pending_amendment' does not exist on type 'typeof ContractStatus'` or Prisma runtime error on create.

### Pitfall 2: Obligation Period Generation — Off-by-One at Contract End Date
**What goes wrong:** Generating monthly periods from `effectiveFrom` to `effectiveTo` creates an extra period or misses the last period.
**Why it happens:** Period end is computed as "start of next month minus one day" — comparison must be `< effectiveTo` not `<= effectiveTo`.
**How to avoid:** Define period as `[periodStart, periodEnd]` where `periodEnd = new Date(year, month + 1, 0)` (last day of month). Stop generating periods when `periodStart >= effectiveTo`.
**Warning signs:** Test checking obligation count for a 12-month contract returns 13 or 11.

### Pitfall 3: Event Listener Not Registered (No AppModule Import)
**What goes wrong:** `@OnEvent('contract.published')` handler never fires — obligations never generated on publish.
**Why it happens:** `EventEmitterModule.forRoot()` must be in AppModule. `ObligationsModule` must be imported so the listener service is instantiated.
**How to avoid:** Explicitly add `EventEmitterModule.forRoot()` to AppModule imports. Add ObligationsModule to AppModule imports.
**Warning signs:** `publishContract()` returns successfully but no Obligation rows are created in DB.

### Pitfall 4: `@nestjs/schedule` Not Registered in AppModule
**What goes wrong:** `@Cron` decorator is silently ignored — cron never executes.
**Why it happens:** `ScheduleModule.forRoot()` must be in AppModule. Without it, the scheduler is not initialized.
**How to avoid:** Add `ScheduleModule.forRoot()` to AppModule imports when installing the package.
**Warning signs:** No log output from ContractSchedulerService at configured time.

### Pitfall 5: Amendment Versioning Race Condition
**What goes wrong:** Two simultaneous amendment requests create two pending amendments for the same contract.
**Why it happens:** No optimistic lock or unique constraint prevents concurrent amendments.
**How to avoid:** Add a check in the amendment service: if any version with `pending_amendment` status already exists for this `contractNumber`, reject with `BadRequestException('Contract already has a pending amendment.')`. This check + the Prisma unique constraint `[airportId, contractNumber, version]` prevents duplication.
**Warning signs:** Two Contract rows with same contractNumber but different versions both have status `pending_amendment`.

### Pitfall 6: Tenant Suspension Cascade — N+1 Update Problem
**What goes wrong:** When a tenant is suspended, updating each contract one-by-one in a loop causes N database round-trips.
**Why it happens:** Looping over contracts and calling `prisma.contract.update()` per contract.
**How to avoid:** Use `prisma.contract.updateMany({ where: { tenantId, status: ContractStatus.active }, data: { status: ContractStatus.suspended } })` — single query.
**Warning signs:** `TenantsService.updateStatus()` slowness when tenant has many contracts.

### Pitfall 7: ContractService Override Formula Validation Skipped
**What goes wrong:** Invalid formula expression stored in `overrideFormulaId` — billing engine crashes at evaluation time.
**Why it happens:** `validateFormulaAST()` not called when assigning an override formula.
**How to avoid:** In `ContractServicesService.assignService()` and `updateOverride()`, if `overrideFormulaId` is provided, load the formula and call `validateFormulaAST(formula.expression)` — throw `BadRequestException` if invalid.
**Warning signs:** Obligation calculation failures in Phase 5 with cryptic formula engine errors.

### Pitfall 8: Month Period Arithmetic with JavaScript Date
**What goes wrong:** `new Date(date.getFullYear(), date.getMonth() + 12, date.getDate())` gives wrong date when start date is e.g. Jan 31 (Feb 31 → March 2 or 3).
**Why it happens:** JavaScript Date rolls over on invalid day-of-month.
**How to avoid:** Always use day=1 for period starts: `new Date(year, month, 1)`. Period end is computed as `new Date(year, month + 1, 0)` (day 0 of next month = last day of current month).
**Warning signs:** Periods with unexpected dates like March 2 or February 28 for non-Feb contracts.

## Code Examples

### Obligation Period Generation
```typescript
// Verified pattern — pure date arithmetic, no external library needed
function generateMonthlyPeriods(
  effectiveFrom: Date,
  effectiveTo: Date,
): Array<{ periodStart: Date; periodEnd: Date }> {
  const periods: Array<{ periodStart: Date; periodEnd: Date }> = [];
  let current = new Date(
    effectiveFrom.getFullYear(),
    effectiveFrom.getMonth(),
    1
  );

  while (current < effectiveTo) {
    const periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    periods.push({ periodStart: new Date(current), periodEnd });
    // Advance to next month
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return periods;
}
```

### Validate Future Period Start Date
```typescript
// Enforces R4.4: amendment effective date = next full period start only
function validateAmendmentEffectiveDate(effectiveFrom: Date): void {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Must be first of month
  if (effectiveFrom.getDate() !== 1) {
    throw new BadRequestException(
      'Amendment effective date must be the first day of a month (period start).',
    );
  }
  // Must be strictly in the future (at least next month start)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (effectiveFrom < nextMonthStart) {
    throw new BadRequestException(
      'Amendment effective date must be a future period start (minimum: next month).',
    );
  }
}
```

### Field-Level Diff Between Contract Versions
```typescript
// Computes diff for GET /contracts/:id/versions response
function computeContractDiff(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const COMPARABLE_FIELDS = [
    'annualMag', 'magCurrency', 'billingFrequency',
    'effectiveFrom', 'effectiveTo', 'responsibleOwner',
  ];
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  for (const field of COMPARABLE_FIELDS) {
    if (String(previous[field]) !== String(current[field])) {
      diff[field] = { old: previous[field], new: current[field] };
    }
  }
  return diff;
}
```

### ScheduleModule Registration in AppModule
```typescript
// @nestjs/schedule v6.1.1 — install: pnpm add @nestjs/schedule --filter api
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // ... existing modules ...
    ScheduleModule.forRoot(),     // registers cron scheduler
    EventEmitterModule.forRoot(), // registers event bus
    ContractsModule,
    ContractAreasModule,
    ContractServicesModule,
    ObligationsModule,
    ContractSchedulerModule,
  ],
})
export class AppModule {}
```

### Unit Test Pattern for Cron Service
```typescript
// Mirror of existing spec pattern — mock PrismaService
describe('ContractSchedulerService', () => {
  let service: ContractSchedulerService;
  let prisma: { contract: { findMany: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = { contract: { findMany: jest.fn(), update: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [
        ContractSchedulerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<ContractSchedulerService>(ContractSchedulerService);
  });

  it('should activate published contracts with effectiveFrom <= today', async () => {
    prisma.contract.findMany.mockResolvedValue([{ id: 'c1', contractNumber: 'CNT-001', version: 1 }]);
    prisma.contract.update.mockResolvedValue({});
    await service.activatePublishedContracts();
    expect(prisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: ContractStatus.active } }),
    );
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cron via OS crontab | `@nestjs/schedule` `@Cron` decorator | NestJS ecosystem standard | DI injection available in cron handlers, no external process needed |
| Manual event callbacks | `@nestjs/event-emitter` `@OnEvent` | NestJS 8+ | Decoupled pub/sub in-process, `async: true` for non-blocking |
| Prisma `$queryRaw` for complex queries | Prisma `findMany` with `where` | Prisma 5+ | Type-safe, no SQL injection risk |

**Not deprecated:**
- `prisma.$transaction()` — still the correct approach for atomic multi-row operations in Prisma 5

## Open Questions

1. **`pending_amendment` Status in ContractStatus Enum**
   - What we know: CONTEXT.md specifies the new amendment version should have `pending_amendment` status
   - What's unclear: The current Prisma schema enum does not include this value — a migration is required
   - Recommendation: Plan 03-01 (Contract CRUD) adds `pending_amendment` to `ContractStatus` enum via migration before any amendment code is written

2. **Obligation Type Mapping: ContractService → ObligationType**
   - What we know: ServiceType has: rent, revenue_share, service_charge, utility. ObligationType has: rent, revenue_share, mag_shortfall, mag_true_up. ChargeType has: base_rent, revenue_share, service_charge, utility, mag_settlement.
   - What's unclear: service_charge and utility services create obligations with chargeType=service_charge/utility but what obligationType? The schema shows ObligationType only has 4 values.
   - Recommendation: Map `ServiceType.rent` → `ObligationType.rent`, `ServiceType.revenue_share` → `ObligationType.revenue_share`, `ServiceType.service_charge` and `ServiceType.utility` → `ObligationType.rent` (base obligation, not MAG). ChargeType follows the service type directly.

3. **Obligation `dueDate` Calculation Without Active BillingPolicy**
   - What we know: BillingPolicy has `dueDateDays` (default 30). Obligation dueDate = periodEnd + dueDateDays.
   - What's unclear: What if no active BillingPolicy exists for the airport at contract publish time?
   - Recommendation: Fetch active BillingPolicy in `generateSchedule()`. If none found, use default of 30 days. Log a warning but don't fail.

4. **How Many Obligations for `pending_amendment` Contract Versions**
   - What we know: When an amendment is created, a new contract version is born with `pending_amendment` status and a future `effectiveFrom`.
   - What's unclear: Should obligations be generated immediately for the new version, or only when it becomes active?
   - Recommendation: Generate obligations for the new version immediately upon amendment creation (not on `contract.published` event since it goes to `pending_amendment` not `published`). This ensures the schedule is visible in advance. Status of these obligations can be `scheduled` with the correct period dates. The cron flip just changes contract status — obligations already exist.

## Validation Architecture

> nyquist_validation is false in .planning/config.json — this section is skipped.

## Sources

### Primary (HIGH confidence)
- Prisma schema at `apps/api/prisma/schema.prisma` — Contract, ContractArea, ContractService, Obligation models verified directly
- `apps/api/src/services/services.service.ts` — createNewVersion(), publish() patterns verified directly
- `apps/api/src/billing-policies/billing-policies.service.ts` — `prisma.$transaction()` pattern verified directly
- `apps/api/src/common/interceptors/audit-log.interceptor.ts` — fire-and-forget pattern verified directly
- `apps/api/node_modules/@nestjs/event-emitter/dist/index.d.ts` — @OnEvent decorator signature verified
- `apps/api/node_modules/@nestjs/event-emitter/dist/decorators/on-event.decorator.d.ts` — OnEvent API verified
- npm registry: `@nestjs/schedule` v6.1.1 peerDeps `@nestjs/common@^10.0.0||^11.0.0` — compatible
- `apps/api/package.json` — confirmed `@nestjs/schedule` NOT installed, `@nestjs/event-emitter@^2.0.0` IS installed

### Secondary (MEDIUM confidence)
- NestJS task scheduling docs (WebSearch verified) — ScheduleModule.forRoot(), @Cron decorator, cron expression format, timeZone option
- NestJS event emitter docs — EventEmitter2.emit(), @OnEvent({ async: true }) pattern

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against installed node_modules and package.json
- Architecture: HIGH — patterns derived directly from Phase 2 codebase, not hypothetical
- Pitfalls: HIGH — derived from schema analysis, existing code patterns, and known NestJS gotchas
- Open questions: MEDIUM — schema gaps are real and confirmed; obligation type mapping is an interpretation

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable NestJS ecosystem; @nestjs/schedule API is stable)
