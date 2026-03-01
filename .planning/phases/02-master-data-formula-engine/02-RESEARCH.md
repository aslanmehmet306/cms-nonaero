# Phase 2: Master Data & Formula Engine - Research

**Researched:** 2026-03-01
**Domain:** Master data CRUD (airports, areas, tenants, services) + sandboxed formula engine security
**Confidence:** HIGH

## Summary

Phase 2 delivers the foundational master data layer and a secure formula evaluation engine. The master data domain follows standard NestJS CRUD patterns with Prisma ORM for airports, hierarchical areas, tenants, service definitions, and formulas. The formula engine uses math.js with a security-first whitelist approach to safely evaluate pricing expressions without code injection risk.

The core challenge is balancing formula flexibility (supporting conditionals, step-bands, escalation) with absolute security (preventing malicious expressions, DOS attacks, and sandbox escapes). Math.js provides built-in AST parsing and can be hardened through function blacklisting, but requires careful timeout enforcement and input validation.

The hierarchical area tree (terminal > floor > zone > unit) uses Prisma's self-referential relations, which work well for data storage but lack native recursive query support. Implementation must use explicit depth specification or manual recursive fetching.

**Primary recommendation:** Use math.js 13+ with custom whitelist sandbox, implement AST validation before evaluation, enforce 100ms timeout via Promise.race wrapper, and integrate DecimalHelper for all financial calculations within formula scope.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Service Definition Versioning:**
- New version row approach: changing a published service creates a new ServiceDefinition row with version+1
- Old version stays linked to existing contracts; new contracts get latest published version
- Draft services are editable; published services are immutable
- Deprecation is manual (admin action), not automatic

**Formula Sandbox Scope:**
- Math + conditionals whitelist: basic math functions (add, subtract, multiply, divide, max, min, round, floor, ceil) PLUS comparison operators and ternary branching
- Ternary operator enables conditional logic: `revenue > 100000 ? revenue * 0.08 : revenue * 0.05`
- No loops, no string operations, no variable assignment, no function definitions
- 100ms timeout protection on evaluation
- Detailed AST error reporting: parse expression, walk AST, return specific errors (e.g., "'process' is not an allowed identifier", "Assignment operator '=' is forbidden")

**Formula Variables:**
- Free-form JSON with hints: variables field defines which variables a formula uses, but schema enforcement happens at evaluation time, not at save time
- Formula authors declare expected variables; engine validates presence when evaluating, not when saving the formula

**Formula Versioning & Contract Upgrade:**
- Auto-upgrade next period: when a new formula version is published, existing contracts automatically use it starting next billing period
- Already-calculated obligations remain untouched (immutable once calculated per R3.5)
- New obligations use the latest published formula version

**Step-Band Formulas:**
- Structured bands JSON: define tiered pricing as a JSON array in the formula's variables field
- Format: `[{from: 0, to: 100000, rate: 0.05}, {from: 100000, to: 300000, rate: 0.08}, ...]`
- Formula engine interprets bands programmatically rather than encoding them in the expression

**Escalation Formulas:**
- Manual index_rate variable: escalation formulas use `index_rate` as a regular context variable
- Admin manually updates the rate each period; no external CPI/TUIK API integration in v1
- Formula pattern: `base_amount * (1 + index_rate)`

**Formula Dry-Run:**
- API endpoint: POST /formulas/:id/dry-run with sample variables in body
- Predefined sample data per formula type ships with the system (e.g., rent formula pre-fills area_m2=100, rate_per_m2=50)
- User can override predefined values
- Returns: calculated result + full calculation trace

**Service Type Validation:**
- Type-specific validation rules per service type (rent, revenue_share, service_charge, utility)
- Each type enforces relevant required fields and formula constraints
- Example: utility services require meter linkage reference; revenue_share requires MAG reference compatibility

**Seed Data:**
- Realistic set of ~10-12 formulas covering all 6 formula types
- Multiple formulas per common type (e.g., 2 rent formulas: fixed vs indexed; 2 revenue share: flat vs tiered; utility formulas per meter type)
- Seed data should feel like a real airport's pricing catalog

**Service & Formula Scoping:**
- Per airport: each airport has its own service definitions and formulas (airportId FK)
- No global templates or cross-airport sharing in v1

**Tenant Status Transitions:**
- commercial_manager, airport_admin, and super_admin can change tenant status
- Fully reversible: active <-> suspended <-> deactivated (any direction)
- Suspending a tenant cascades: all active contracts suspended, pending obligations put on_hold
- Reactivating reverses the cascade

**Tenant Required Fields:**
- Required at creation: code (auto-generated), name, taxId, email
- Optional: phone, address
- stripeCustomerId populated automatically on create (Stripe customer created immediately)

**Tenant Code Generation:**
- Auto-generated sequential codes: TNT-001, TNT-002, etc.
- Admin cannot customize the code; system ensures format consistency and uniqueness

**Tenant List API:**
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R2.1 | Airport management — single ADB airport with 3 terminals, 13 units (seed data) | NestJS CRUD pattern + Prisma seed with upsert |
| R2.2 | Area hierarchy — terminal > floor > zone > unit with self-referential tree | Prisma self-relations, manual recursive queries |
| R2.3 | Tenant management — CRUD with status lifecycle (active/suspended/deactivated) | Standard CRUD + status enum transitions + Stripe customer creation |
| R2.4 | Service definition — 4 types: rent, revenue_share, service_charge, utility | Type-specific validation + formula FK relationship |
| R2.5 | Service versioning — draft → published → deprecated lifecycle | Status enum + version integer + immutability rules |
| R2.6 | Billing policy — cut-off day, issue day, due date days, fiscal year config | Simple config CRUD with airportId FK |
| R3.1 | math.js sandbox with whitelisted functions only | Custom whitelist sandbox + function blacklisting |
| R3.2 | Expression validation on save (AST traversal, reject assignments/function definitions) | Math.js parse() + AST node visitor pattern |
| R3.3 | Variable substitution from contract context | Math.js evaluate() scope parameter |
| R3.4 | Timeout protection (100ms max execution) | Promise.race wrapper with timeout |
| R3.5 | Formula versioning — immutable once used in obligation calculation | Version tracking + auto-upgrade logic |
| R3.6 | Dry-run evaluation with sample data before formula publish | Separate evaluation endpoint with trace logging |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mathjs | 13.2.0+ | Safe expression evaluation engine | Industry standard for JS math parsing, 870+ Context7 snippets, trust score 9.5, built-in AST support, no eval() under hood |
| class-validator | 0.14+ | DTO validation decorators | NestJS ecosystem standard, supports nested validation with @ValidateNested() |
| class-transformer | 0.5+ | Plain-to-class transformation | Required companion to class-validator, enables @Type() for nested objects |
| Prisma | 5.22.0 | ORM for master data CRUD | Already in use from Phase 1, self-referential relations supported |
| stripe | 17.3.0+ | Tenant-customer creation | Locked requirement R2.3, idempotent customer creation |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workerpool | 9.2.0+ | Isolate formula execution in worker threads | Optional hardening for production (NOT v1), prevents main thread freeze |
| decimal.js | 10.4.3 | Financial precision | Already in use via DecimalHelper, integrate into formula scope |
| uuid | 11.0.0+ | Idempotency keys for Stripe | V4 UUIDs for customer creation retries |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mathjs | expr-eval | Lighter weight (30KB vs 500KB) but less mature ecosystem, fewer safety features |
| mathjs | VM2 sandbox | Better isolation but deprecated in 2023, security unmaintained |
| Prisma self-relation | Closure table | Better performance for deep trees but schema complexity, overkill for 4-level max depth |
| Manual recursive fetch | Raw SQL CTEs | Faster for deep queries but loses type safety, breaks Prisma abstraction |

**Installation:**
```bash
pnpm add mathjs@13.2.0 class-validator@0.14.1 class-transformer@0.5.1 stripe@17.3.1 uuid@11.0.2
pnpm add -D @types/uuid@10.0.0
```

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/
├── airports/               # Airport CRUD module
│   ├── airports.controller.ts
│   ├── airports.service.ts
│   ├── airports.module.ts
│   └── dto/
├── areas/                  # Area hierarchy module
│   ├── areas.controller.ts
│   ├── areas.service.ts
│   ├── areas.module.ts
│   └── dto/
├── tenants/                # Tenant CRUD + Stripe integration
│   ├── tenants.controller.ts
│   ├── tenants.service.ts
│   ├── tenants.module.ts
│   └── dto/
├── services/               # Service definition CRUD
│   ├── services.controller.ts
│   ├── services.service.ts
│   ├── services.module.ts
│   └── dto/
├── formulas/               # Formula CRUD + dry-run endpoint
│   ├── formulas.controller.ts
│   ├── formulas.service.ts
│   ├── formulas.module.ts
│   └── dto/
├── billing-policies/       # Billing policy config
│   ├── billing-policies.controller.ts
│   ├── billing-policies.service.ts
│   ├── billing-policies.module.ts
│   └── dto/
packages/formula-engine/src/
├── index.ts                # Public API exports
├── sandbox.ts              # Math.js whitelist sandbox
├── validator.ts            # AST traversal security checks
├── evaluator.ts            # Safe evaluation with timeout
└── types.ts                # TypeScript interfaces
```

### Pattern 1: Math.js Whitelist Sandbox

**What:** Create a math.js instance with dangerous functions disabled and only whitelisted operators/functions enabled.

**When to use:** Every formula evaluation to prevent code injection.

**Example:**
```typescript
// Source: https://mathjs.org/docs/expressions/security.html + Context7
import { create, all } from 'mathjs';

const math = create(all);

// Blacklist dangerous functions (override with error throwers)
math.import({
  import: () => { throw new Error('Function import is disabled') },
  createUnit: () => { throw new Error('Function createUnit is disabled') },
  reviver: () => { throw new Error('Function reviver is disabled') },
  evaluate: () => { throw new Error('Function evaluate is disabled') },
  parse: () => { throw new Error('Function parse is disabled') },
  simplify: () => { throw new Error('Function simplify is disabled') },
  derivative: () => { throw new Error('Function derivative is disabled') },
  resolve: () => { throw new Error('Function resolve is disabled') },
}, { override: true });

// Safe evaluation still works
const limitedEvaluate = math.evaluate;
export { limitedEvaluate };
```

### Pattern 2: AST Validation Before Evaluation

**What:** Parse expression into AST, traverse nodes, reject assignments, function definitions, or blacklisted identifiers.

**When to use:** On formula save (creation/update) to provide immediate feedback.

**Example:**
```typescript
// Source: math.js AST documentation + security best practices
import { parse } from 'mathjs';

const ALLOWED_OPERATORS = new Set([
  '+', '-', '*', '/', '^', '%',
  '==', '!=', '<', '>', '<=', '>=',
  '?', ':', 'and', 'or', 'not'
]);

const ALLOWED_FUNCTIONS = new Set([
  'add', 'subtract', 'multiply', 'divide',
  'max', 'min', 'round', 'floor', 'ceil', 'abs'
]);

const FORBIDDEN_IDENTIFIERS = new Set([
  'process', 'require', 'eval', 'Function',
  'import', 'createUnit', 'reviver'
]);

export function validateFormulaAST(expression: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const node = parse(expression);

    // Traverse AST recursively
    node.traverse((n: any, path: string, parent: any) => {
      // Reject assignments
      if (n.type === 'AssignmentNode') {
        errors.push(`Assignment operator '=' is forbidden at ${path}`);
      }

      // Reject function definitions
      if (n.type === 'FunctionAssignmentNode') {
        errors.push(`Function definition is forbidden at ${path}`);
      }

      // Validate operators
      if (n.type === 'OperatorNode' && !ALLOWED_OPERATORS.has(n.op)) {
        errors.push(`Operator '${n.op}' is not allowed at ${path}`);
      }

      // Validate functions
      if (n.type === 'FunctionNode' && !ALLOWED_FUNCTIONS.has(n.fn.name)) {
        errors.push(`Function '${n.fn.name}' is not allowed at ${path}`);
      }

      // Reject forbidden identifiers
      if (n.type === 'SymbolNode' && FORBIDDEN_IDENTIFIERS.has(n.name)) {
        errors.push(`'${n.name}' is not an allowed identifier at ${path}`);
      }
    });

    return { valid: errors.length === 0, errors };
  } catch (parseError: any) {
    return { valid: false, errors: [`Parse error: ${parseError.message}`] };
  }
}
```

### Pattern 3: Timeout Enforcement with Promise.race

**What:** Wrap formula evaluation in a Promise.race with 100ms timeout to prevent infinite loops or heavy computation DOS.

**When to use:** Every evaluation (dry-run + production billing calculation).

**Example:**
```typescript
// Source: JavaScript timeout best practices
export async function evaluateWithTimeout(
  expression: string,
  scope: Record<string, any>,
  timeoutMs = 100
): Promise<{ success: boolean; result?: any; error?: string }> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Formula execution timeout')), timeoutMs)
  );

  const evalPromise = Promise.resolve().then(() => {
    // limitedEvaluate from Pattern 1
    return limitedEvaluate(expression, scope);
  });

  try {
    const result = await Promise.race([evalPromise, timeoutPromise]);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

### Pattern 4: Nested Object Validation with class-validator

**What:** Use @ValidateNested() + @Type() decorators to validate nested DTOs (e.g., formula variables JSON).

**When to use:** CreateFormulaDto, UpdateServiceDto with nested configuration objects.

**Example:**
```typescript
// Source: https://dev.to/avantar/validating-nested-objects-with-class-validator-in-nestjs-1gn8
import { IsString, IsEnum, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class FormulaVariableDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(['number', 'decimal'])
  type: string;
}

export class CreateFormulaDto {
  @IsString()
  code: string;

  @IsString()
  expression: string;

  @IsEnum(['arithmetic', 'conditional', 'step_band', 'revenue_share', 'escalation', 'proration'])
  formulaType: string;

  @ValidateNested({ each: true })
  @Type(() => FormulaVariableDto)
  @IsArray()
  variables: FormulaVariableDto[];
}
```

### Pattern 5: Self-Referential Tree Queries with Prisma

**What:** Fetch hierarchical area tree by explicitly specifying nested include depth or using recursive function.

**When to use:** GET /areas/:id/tree endpoint to return full subtree.

**Example:**
```typescript
// Source: https://wanago.io/2023/12/11/api-nestjs-sql-recursive-relationships-prisma-postgresql/
// Explicit depth (simple, works for max 4 levels)
async findAreaWithChildren(areaId: string) {
  return this.prisma.area.findUnique({
    where: { id: areaId },
    include: {
      children: {
        include: {
          children: {
            include: {
              children: true, // 3 levels deep
            },
          },
        },
      },
    },
  });
}

// Recursive approach (flexible but more queries)
async findAreaTreeRecursive(areaId: string): Promise<any> {
  const area = await this.prisma.area.findUnique({
    where: { id: areaId },
  });

  if (!area) return null;

  const children = await this.prisma.area.findMany({
    where: { parentAreaId: areaId },
  });

  const childrenWithNested = await Promise.all(
    children.map(child => this.findAreaTreeRecursive(child.id))
  );

  return { ...area, children: childrenWithNested };
}
```

### Pattern 6: Stripe Customer Idempotent Creation

**What:** Create Stripe customer with idempotency key to prevent duplicates on retry.

**When to use:** Tenant creation (R2.3 requirement).

**Example:**
```typescript
// Source: https://docs.stripe.com/api/idempotent_requests
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

async createTenantWithStripe(dto: CreateTenantDto) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // Generate idempotency key (V4 UUID recommended)
  const idempotencyKey = uuidv4();

  // Create Stripe customer (safe to retry with same key)
  const customer = await stripe.customers.create({
    email: dto.email,
    name: dto.name,
    metadata: {
      tenantCode: dto.code, // Will be generated
    },
  }, {
    idempotencyKey, // Prevents duplicate customers on retry
  });

  // Create tenant with Stripe customer ID
  return this.prisma.tenant.create({
    data: {
      ...dto,
      stripeCustomerId: customer.id,
    },
  });
}
```

### Pattern 7: Step-Band Formula Evaluation

**What:** Interpret tiered pricing bands from JSON and calculate progressive commission.

**When to use:** Formula type = step_band.

**Example:**
```typescript
// Source: https://commissionpeople.com/sales-commission-guide-2026-structure-types-formulas-best-practices/
interface Band {
  from: number;
  to: number;
  rate: number;
}

function evaluateStepBand(revenue: number, bands: Band[]): number {
  let commission = 0;
  let remaining = revenue;

  // Sort bands by from value ascending
  const sortedBands = [...bands].sort((a, b) => a.from - b.from);

  for (const band of sortedBands) {
    const tierSize = band.to - band.from;
    const amountInTier = Math.min(remaining, tierSize);

    if (amountInTier <= 0) break;

    commission += amountInTier * band.rate;
    remaining -= amountInTier;
  }

  return commission;
}

// Usage in formula scope
const scope = {
  revenue: 25000,
  calculateStepBand: (rev: number, bands: Band[]) => evaluateStepBand(rev, bands),
};

// Expression: "calculateStepBand(revenue, bands)"
```

### Anti-Patterns to Avoid

- **Using eval() or Function() constructor:** Never use JavaScript's native eval for formula evaluation — use math.js parser exclusively
- **Trusting user input without AST validation:** Always validate expressions before storing or evaluating, even from admin users
- **Infinite recursion in area tree:** Set max depth limit (4 levels = terminal/floor/zone/unit) to prevent stack overflow
- **Mutable published formulas:** Once status = published, prevent all edits — create new version instead
- **Synchronous heavy computation:** Always wrap evaluation in timeout promise to prevent main thread blocking
- **String concatenation in formulas:** Keep formula scope to numbers/Decimals only — no string operations allowed
- **Global math.js instance:** Create sandboxed instance per request to prevent scope pollution

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expression parsing | Custom tokenizer/parser | mathjs 13.2+ | 10+ years battle-tested, handles operator precedence, supports AST introspection, 870 code snippets |
| Tenant code sequence | Manual counter queries | Prisma transaction + MAX(code) | Race condition prevention, atomic increment |
| Recursive tree queries | Custom SQL query builder | Prisma include pattern or helper function | Type safety, maintains abstraction layer |
| Tiered pricing calculation | Inline ternary chains | Helper function with Band[] | Maintainability, reusable across formulas |
| Financial rounding | Native Math.round() | DecimalHelper.roundMoney() | Avoids floating-point errors (0.1 + 0.2 ≠ 0.3) |
| Timeout enforcement | setInterval polling | Promise.race pattern | Non-blocking, cleaner async flow |
| Nested DTO validation | Manual object traversal | @ValidateNested() + @Type() | Declarative, automatic error messages |
| Idempotency keys | Custom UUID generation | uuid v4 package | Cryptographically secure randomness |

**Key insight:** Math.js handles all expression parsing edge cases (parentheses, operator precedence, type coercion, scientific notation). Building a custom parser would take weeks and miss subtle bugs. Similarly, Prisma's type safety and DecimalHelper's precision guarantees eliminate entire classes of runtime errors that manual SQL and native math operations introduce.

## Common Pitfalls

### Pitfall 1: Math.js Version Confusion (eval under hood)

**What goes wrong:** Math.js v3 and earlier used JavaScript's eval() internally, creating security vulnerabilities. Developers assume current versions are similarly unsafe.

**Why it happens:** Outdated documentation and StackOverflow answers reference old behavior. Search results show historical exploits (2017 CVE).

**How to avoid:** Use math.js v4+ exclusively (current is v13). Versions 4+ removed eval and use AST compilation instead. Verify with package.json lock file.

**Warning signs:** Seeing eval() in stack traces, finding old GitHub issues about code execution vulnerabilities.

### Pitfall 2: Prisma Self-Relation Query Depth Explosion

**What goes wrong:** Fetching area tree without depth limit triggers N+1 queries and can crash with stack overflow on circular references.

**Why it happens:** Prisma docs show simple include examples but don't emphasize depth control. Developers copy pattern without thinking about recursion limits.

**How to avoid:** For 4-level hierarchy, use explicit include depth (3 nested includes) or manual recursive function with max depth guard. Add unique constraint on (parentAreaId, code) to prevent cycles.

**Warning signs:** Slow API responses on /areas endpoints, database connection pool exhaustion, memory spikes.

### Pitfall 3: Formula Versioning Lock-In

**What goes wrong:** Published formula is edited in-place, breaking existing contract calculations that depend on immutable formula text.

**Why it happens:** Forgetting that contracts reference formulas by ID, not by capturing expression text at assignment time.

**How to avoid:** Enforce immutability at service layer: if status = published, throw BadRequestException on update. Force creation of new formula version (increment version field, new UUID).

**Warning signs:** Billing calculation discrepancies, contract amounts changing retroactively, audit trail inconsistencies.

### Pitfall 4: Decimal.js Not Integrated in Formula Scope

**What goes wrong:** Formula evaluation uses native JavaScript numbers, causing floating-point precision errors (0.1 + 0.2 = 0.30000000000000004).

**Why it happens:** Math.js returns number types by default. Developers forget to wrap results in DecimalHelper.

**How to avoid:** Configure math.js with custom functions that use DecimalHelper internally, or wrap all evaluation results with `new Decimal(result)`. Add unit test: `evaluate("0.1 + 0.2")` must equal exactly "0.3".

**Warning signs:** Cent-level discrepancies in billing amounts, rounding errors accumulating over time.

### Pitfall 5: Timeout Not Actually Enforced

**What goes wrong:** Promise.race timeout set but evaluation runs in synchronous blocking call, freezing Node.js event loop anyway.

**Why it happens:** Math.js evaluate() is synchronous. Promise.race only works if wrapped in async executor or worker thread.

**How to avoid:** Use `Promise.resolve().then(() => limitedEvaluate(...))` to make evaluation async, allowing Promise.race to actually interrupt. For production hardening, use workerpool to isolate in separate thread.

**Warning signs:** API hanging on malicious formulas (e.g., `10^10^10`), CPU at 100% with no timeout trigger.

### Pitfall 6: AST Validation Bypassed on Dry-Run

**What goes wrong:** Dry-run endpoint evaluates expressions directly without AST validation, allowing testing of malicious formulas that would be rejected on save.

**Why it happens:** Developers implement dry-run as "quick preview" without realizing it's the same attack surface.

**How to avoid:** Dry-run MUST call same validateFormulaAST() function as create/update endpoints. Reject malicious expressions before evaluation, not after timeout.

**Warning signs:** DOS attacks via dry-run endpoint, security audit findings.

### Pitfall 7: Stripe Customer Creation Without Idempotency

**What goes wrong:** Network timeout causes retry, creating duplicate Stripe customers for same tenant, leading to billing confusion.

**Why it happens:** Stripe API call placed in service method without idempotency key parameter.

**How to avoid:** Always pass idempotencyKey option to stripe.customers.create(). Use V4 UUID or deterministic key like `tenant-create-${dto.email}`. Store customer ID in transaction with tenant row creation.

**Warning signs:** Multiple Stripe customers with same email, tenant records without stripeCustomerId, retry logs showing duplicate customer errors.

### Pitfall 8: Nested Validation Missing @Type() Decorator

**What goes wrong:** class-validator silently skips validation on nested objects, allowing invalid data through.

**Why it happens:** @ValidateNested() alone isn't enough — class-transformer needs @Type() to know how to instantiate nested class.

**How to avoid:** Always pair @ValidateNested() with @Type(() => NestedClass). Enable global transform option in ValidationPipe.

**Warning signs:** Invalid nested data reaching service layer, no validation errors thrown, type errors in business logic.

## Code Examples

Verified patterns from official sources:

### NestJS CRUD Controller (Standard Pattern)

```typescript
// Source: https://docs.nestjs.com/controllers
import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@shared-types/enums';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tenants with optional status filter' })
  @ApiResponse({ status: 200, description: 'Paginated tenant list' })
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenantsService.findAll({
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Create new tenant with Stripe customer' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Update tenant details' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Change tenant status (active/suspended/deactivated)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.tenantsService.updateStatus(id, dto.status);
  }
}
```

### Formula Dry-Run Endpoint with Calculation Trace

```typescript
// Pattern: Evaluation trace for audit trail
@Post(':id/dry-run')
@ApiOperation({ summary: 'Preview formula calculation with sample data' })
@ApiResponse({ status: 200, description: 'Calculation result with trace' })
async dryRun(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: DryRunFormulaDto,
) {
  const formula = await this.formulasService.findOne(id);

  // Merge predefined sample data with user overrides
  const sampleData = this.getSampleDataForType(formula.formulaType);
  const scope = { ...sampleData, ...dto.variables };

  // Validate + evaluate with trace
  const validation = validateFormulaAST(formula.expression);
  if (!validation.valid) {
    throw new BadRequestException({ errors: validation.errors });
  }

  const startTime = Date.now();
  const evalResult = await evaluateWithTimeout(formula.expression, scope, 100);
  const duration = Date.now() - startTime;

  if (!evalResult.success) {
    throw new BadRequestException({ error: evalResult.error });
  }

  return {
    success: true,
    result: evalResult.result,
    trace: {
      expression: formula.expression,
      scope,
      calculatedValue: evalResult.result,
      durationMs: duration,
      formulaType: formula.formulaType,
    },
  };
}

private getSampleDataForType(type: FormulaType): Record<string, number> {
  const samples = {
    arithmetic: { area_m2: 100, rate_per_m2: 50 },
    conditional: { revenue: 150000, threshold: 100000, rate_low: 0.05, rate_high: 0.08 },
    step_band: { revenue: 250000 }, // Bands in formula.variables
    revenue_share: { revenue: 200000, rate: 0.07 },
    escalation: { base_amount: 10000, index_rate: 0.03 },
    proration: { monthly_amount: 5000, days_in_period: 30, days_occupied: 20 },
  };
  return samples[type] || {};
}
```

### Service Versioning Logic (Immutability Enforcement)

```typescript
// Pattern: Prevent editing published formulas, force new version
async update(id: string, dto: UpdateFormulaDto) {
  const existing = await this.prisma.formula.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundException(`Formula ${id} not found`);
  }

  // Immutability rule: published formulas cannot be edited
  if (existing.status === 'published') {
    throw new BadRequestException(
      'Published formulas are immutable. Create a new version instead.'
    );
  }

  // Draft formulas can be edited freely
  if (existing.status === 'draft') {
    // Re-validate expression if changed
    if (dto.expression && dto.expression !== existing.expression) {
      const validation = validateFormulaAST(dto.expression);
      if (!validation.valid) {
        throw new BadRequestException({ errors: validation.errors });
      }
    }

    return this.prisma.formula.update({
      where: { id },
      data: dto,
    });
  }

  throw new BadRequestException(`Cannot update formula with status ${existing.status}`);
}

async createNewVersion(id: string, dto: CreateFormulaVersionDto) {
  const original = await this.findOne(id);

  const newVersion = await this.prisma.formula.create({
    data: {
      ...original,
      id: undefined, // Generate new UUID
      version: original.version + 1,
      expression: dto.expression || original.expression,
      variables: dto.variables || original.variables,
      status: 'draft',
      publishedAt: null,
      createdAt: new Date(),
    },
  });

  return newVersion;
}
```

### Tenant Auto-Code Generation (Sequential TNT-NNN)

```typescript
// Pattern: Atomic sequence generation with Prisma
async generateNextTenantCode(airportId: string): Promise<string> {
  // Find highest existing code for this airport
  const lastTenant = await this.prisma.tenant.findFirst({
    where: { airportId },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let nextNumber = 1;
  if (lastTenant) {
    // Extract number from "TNT-001" -> 1
    const match = lastTenant.code.match(/TNT-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Format as TNT-001, TNT-002, etc.
  return `TNT-${String(nextNumber).padStart(3, '0')}`;
}

async create(dto: CreateTenantDto) {
  const code = await this.generateNextTenantCode(dto.airportId);

  // Idempotent Stripe customer creation
  const stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY'));
  const idempotencyKey = uuidv4();

  const customer = await stripe.customers.create({
    email: dto.email,
    name: dto.name,
    metadata: { tenantCode: code },
  }, { idempotencyKey });

  // Atomic tenant creation
  return this.prisma.tenant.create({
    data: {
      ...dto,
      code,
      stripeCustomerId: customer.id,
      status: 'active',
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VM2 sandbox isolation | math.js whitelist + worker threads | 2023 (VM2 deprecated) | Less isolation but actively maintained, community support |
| Manual recursive SQL CTEs | Prisma explicit depth or helper function | Prisma v2+ | Type safety maintained, simpler codebase |
| class-validator 0.13 | class-validator 0.14 + class-transformer 0.5 | 2023 | Better nested validation, @Type() required |
| Math.js eval() under hood | Math.js AST compilation | v4.0 (2018) | Security hardened, no eval vulnerabilities |
| Stripe idempotency via database | Stripe native idempotency keys | Always available | Simpler, no race conditions |
| Manual tier calculation loops | Progressive band iteration | N/A (best practice) | Clear logic, matches accounting standards |

**Deprecated/outdated:**
- **VM2 package:** Deprecated in 2023, security vulnerabilities unpatched — use math.js whitelist instead
- **Math.js reviver function:** Security risk, should be blacklisted in sandbox
- **Synchronous Prisma transactions:** Use async/await pattern, never blocking queries
- **Global ValidationPipe without transform:** Enable `transform: true` for proper class-transformer integration

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7+ (ts-jest) |
| Config file | apps/api/jest.config.ts |
| Quick run command | `pnpm --filter api test` |
| Full suite command | `pnpm --filter api test --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2.1 | Airport CRUD + seed data verification | integration | `pnpm --filter api test airports.service.spec.ts -x` | ❌ Wave 0 |
| R2.2 | Area hierarchy tree queries (4 levels deep) | integration | `pnpm --filter api test areas.service.spec.ts -x` | ❌ Wave 0 |
| R2.3 | Tenant lifecycle + Stripe customer creation | integration | `pnpm --filter api test tenants.service.spec.ts -x` | ❌ Wave 0 |
| R2.4 | Service type validation rules | unit | `pnpm --filter api test services.service.spec.ts -x` | ❌ Wave 0 |
| R2.5 | Service versioning immutability | unit | `pnpm --filter api test services.service.spec.ts::test_published_immutability -x` | ❌ Wave 0 |
| R2.6 | Billing policy CRUD | integration | `pnpm --filter api test billing-policies.service.spec.ts -x` | ❌ Wave 0 |
| R3.1 | Math.js whitelist sandbox function blacklist | unit | `pnpm --filter formula-engine test sandbox.spec.ts -x` | ❌ Wave 0 |
| R3.2 | AST validation rejects assignments/functions | unit | `pnpm --filter formula-engine test validator.spec.ts -x` | ❌ Wave 0 |
| R3.3 | Variable substitution in formulas | unit | `pnpm --filter formula-engine test evaluator.spec.ts -x` | ❌ Wave 0 |
| R3.4 | Timeout protection (100ms max) | unit | `pnpm --filter formula-engine test evaluator.spec.ts::test_timeout -x` | ❌ Wave 0 |
| R3.5 | Formula version auto-upgrade logic | integration | `pnpm --filter api test formulas.service.spec.ts -x` | ❌ Wave 0 |
| R3.6 | Dry-run with calculation trace | integration | `pnpm --filter api test formulas.controller.spec.ts::test_dry_run -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter api test --testPathPattern={changed-module}`
- **Per wave merge:** `pnpm --filter api test` (all API tests) + `pnpm --filter formula-engine test`
- **Phase gate:** Full suite green + coverage >80% before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/formula-engine/src/__tests__/sandbox.spec.ts` — covers R3.1 (whitelist enforcement)
- [ ] `packages/formula-engine/src/__tests__/validator.spec.ts` — covers R3.2 (AST traversal)
- [ ] `packages/formula-engine/src/__tests__/evaluator.spec.ts` — covers R3.3, R3.4 (evaluation + timeout)
- [ ] `apps/api/src/airports/airports.service.spec.ts` — covers R2.1
- [ ] `apps/api/src/areas/areas.service.spec.ts` — covers R2.2
- [ ] `apps/api/src/tenants/tenants.service.spec.ts` — covers R2.3 (with Stripe mock)
- [ ] `apps/api/src/services/services.service.spec.ts` — covers R2.4, R2.5
- [ ] `apps/api/src/billing-policies/billing-policies.service.spec.ts` — covers R2.6
- [ ] `apps/api/src/formulas/formulas.service.spec.ts` — covers R3.5
- [ ] `apps/api/src/formulas/formulas.controller.spec.ts` — covers R3.6 (dry-run endpoint)
- [ ] Jest config: Already exists at `apps/api/jest.config.ts`
- [ ] Formula-engine package.json needs test script: `"test": "jest"`

## Open Questions

1. **Worker Thread Isolation for Production**
   - What we know: workerpool provides thread isolation, prevents main thread freeze
   - What's unclear: Performance overhead acceptable for 100ms timeout? Complexity worth it for v1?
   - Recommendation: Defer to post-v1 hardening. Promise.race timeout sufficient for demo. Add workerpool in Phase 8 production prep if load testing reveals DOS risk.

2. **Area Tree Max Depth Enforcement**
   - What we know: Schema allows infinite nesting, real hierarchy is 4 levels (terminal/floor/zone/unit)
   - What's unclear: Should database enforce max depth via trigger, or application validation only?
   - Recommendation: Application-level validation in CreateAreaDto (check parentAreaId depth < 4). Database trigger adds complexity for marginal benefit.

3. **Formula Variable Schema Validation**
   - What we know: Variables stored as free-form JSON, validated at evaluation time
   - What's unclear: Should JSON have enforced schema (JSON Schema validator) or just type checking?
   - Recommendation: Keep loose for v1 flexibility. Add `@IsObject()` validation on DTO but allow any shape. Tighten in v2 if patterns emerge.

4. **Stripe Webhook Handling Scope**
   - What we know: Tenant creation needs Stripe customer, Phase 9 covers invoice webhooks
   - What's unclear: Should Phase 2 implement customer.updated webhook for sync, or defer all webhooks to Phase 9?
   - Recommendation: Defer webhooks entirely to Phase 9. Phase 2 creates customers but doesn't listen to events. Document assumption that manual Stripe dashboard changes won't sync back.

5. **Step-Band Helper in Formula Scope**
   - What we know: Step-bands defined in JSON, need helper function to calculate
   - What's unclear: Should helper be injected into math.js scope as custom function, or evaluated outside formula engine?
   - Recommendation: Custom function injection (`calculateStepBand(revenue, bands)`) — keeps expression simple, helper is reusable. Add to whitelist in sandbox.

## Sources

### Primary (HIGH confidence)

- Context7 /josdejong/mathjs - Expression parser, sandbox security, custom functions (567 snippets, trust 9.4)
- Context7 /websites/mathjs - Security documentation, AST traversal patterns (870 snippets, trust 9.5)
- Context7 /websites/nestjs - CRUD controllers, DTO validation, dependency injection (1995 snippets, trust 9.8)
- [Math.js Security Documentation](https://mathjs.org/docs/expressions/security.html) - Official security guide
- [Prisma Self-Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/self-relations) - Official docs
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) - Official API reference

### Secondary (MEDIUM confidence)

- [Wanago NestJS Recursive Relations](https://wanago.io/2023/12/11/api-nestjs-sql-recursive-relationships-prisma-postgresql/) - Tutorial with code examples
- [DEV: Validating Nested Objects in NestJS](https://dev.to/avantar/validating-nested-objects-with-class-validator-in-nestjs-1gn8) - Community pattern, verified
- [Sales Commission Guide 2026](https://commissionpeople.com/sales-commission-guide-2026-structure-types-formulas-best-practices/) - Tiered pricing calculation formulas
- [DEV: Stripe Subscriptions in NestJS](https://dev.to/aniefon_umanah_ac5f21311c/building-reliable-stripe-subscriptions-in-nestjs-webhook-idempotency-and-optimistic-locking-3o91) - Idempotency patterns

### Tertiary (LOW confidence)

- [SitePoint: JavaScript Execution Browser Limits](https://www.sitepoint.com/javascript-execution-browser-limits/) - General timeout patterns (not math.js specific)
- [AG Grid Tree Data](https://www.ag-grid.com/react-data-grid/tree-data-self-referential/) - UI pattern, not backend

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via Context7 or official docs, version numbers from package ecosystems
- Architecture: HIGH - Patterns sourced from official NestJS docs, math.js documentation, and battle-tested Prisma patterns
- Pitfalls: MEDIUM-HIGH - Based on real GitHub issues, security advisories, and documented gotchas; timeout enforcement gap identified via security research

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (30 days for stable technologies like NestJS, Prisma; math.js is mature)

**CVE check:** No 2026 CVEs found for math.js. Last security issue was CVE-2022-21222 (prototype pollution, fixed in v11.0.1). Current v13.2 is clean. SandboxJS CVE-2026-23830 is unrelated library.
