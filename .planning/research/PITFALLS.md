# Domain Pitfalls: Billing/Invoicing SaaS

**Domain:** Airport Non-Aeronautical Revenue Management SaaS
**Researched:** 2026-02-28
**Confidence:** MEDIUM (based on training data and domain patterns, not verified with current sources)

## Critical Pitfalls

These mistakes cause rewrites, data corruption, or financial inaccuracies requiring customer refunds.

### Pitfall 1: Decimal/Floating Point Precision Loss

**What goes wrong:**
Using JavaScript's native `number` type (IEEE 754 floating point) for financial calculations leads to precision errors:

```javascript
// BAD: 0.1 + 0.2 = 0.30000000000000004
const subtotal = 10.1;
const tax = 1.51;
const total = subtotal + tax; // 11.609999999999999
```

In a billing system with thousands of invoices, rounding errors compound. Different rounding at calculation vs display time creates reconciliation nightmares. Auditors and accountants will reject reports that don't balance to the cent.

**Why it happens:**

- Developers unfamiliar with financial software use `number` type by default
- Math appears correct in small tests but fails at scale
- PostgreSQL `NUMERIC` type doesn't protect you if calculations happen in JS

**Consequences:**

- Invoice totals don't match sum of line items (even by $0.01 → customer disputes)
- Revenue reports don't reconcile with accounting systems
- Tax calculations off by fractional cents → compliance issues
- MAG true-up calculations produce wrong results
- Loss of customer trust ("your system can't add correctly")

**Prevention:**

```typescript
// CORRECT: Use decimal library for ALL financial math
import Decimal from 'decimal.js';

// Configure globally
Decimal.set({
  precision: 20,        // Sufficient for financial calculations
  rounding: Decimal.ROUND_HALF_UP,  // Banker's rounding
  toExpPos: 9e15,
  toExpNeg: -9e15
});

// All money calculations
const subtotal = new Decimal('10.10');
const tax = new Decimal('1.51');
const total = subtotal.plus(tax); // Exact: 11.61

// Database schema
CREATE TABLE invoice_lines (
  amount NUMERIC(19, 4) NOT NULL,  -- Never FLOAT/DOUBLE
  quantity NUMERIC(10, 4),
  unit_price NUMERIC(19, 4)
);
```

**Detection:**

- Unit tests fail when comparing `toBe(11.61)` vs actual `11.609999...`
- QA finds invoice totals that don't sum correctly
- Reconciliation reports show unexplained penny differences
- Customers report invoices with fractional cent amounts

**Phase Impact:**

- **Phase 1 (Foundation):** MUST establish decimal.js usage pattern immediately
- **Phase 2 (Billing Core):** All formula engine outputs must use Decimal
- **Phase 3 (MAG Settlement):** Critical for year-end true-up accuracy

---

### Pitfall 2: Non-Idempotent Billing Runs

**What goes wrong:**
Running the same billing period twice creates duplicate invoices, duplicate Stripe charges, and customer fury:

```typescript
// BAD: No idempotency check
async function runBilling(tenantId: string, period: string) {
  const obligations = await calculateObligations(tenantId, period);
  const invoice = await createInvoice(obligations); // Creates EVERY time
  await stripe.invoices.create({ customer: tenantId, ... }); // Duplicate charge!
  return invoice;
}
```

Real-world scenarios that trigger duplicates:

- Billing cron job runs twice due to clock skew/restart
- Developer re-runs billing for testing in production
- User clicks "Generate Invoice" button twice (double-click, slow network)
- Retry logic after timeout (operation succeeded but response lost)
- BullMQ job retries after worker crash

**Why it happens:**

- Billing is modeled as a function call, not a state transition
- No unique constraint on (tenant, period) prevents duplicates
- Developers assume "billing runs once per period" (false in practice)

**Consequences:**

- Customers double-charged → refunds, support tickets, loss of trust
- Stripe invoices can't be deleted (only voided), leaving messy audit trail
- Financial reports overcounted → incorrect revenue recognition
- Reconciliation between system and Stripe becomes manual nightmare

**Prevention:**

```typescript
// CORRECT: Idempotent billing with unique constraint
// Database schema
CREATE TABLE billing_runs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, processing, completed, failed
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  stripe_invoice_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, period_start, period_end) -- Prevents duplicates
);

// Application logic
async function runBilling(tenantId: string, period: { start: Date, end: Date }) {
  const idempotencyKey = `billing_${tenantId}_${period.start}_${period.end}`;

  // Try to create billing run record
  const run = await prisma.billingRun.upsert({
    where: { idempotencyKey },
    create: {
      tenantId,
      periodStart: period.start,
      periodEnd: period.end,
      status: 'pending',
      idempotencyKey
    },
    update: {} // Already exists, return existing
  });

  // If already completed, return existing result
  if (run.status === 'completed') {
    return run; // Idempotent!
  }

  // Proceed with billing...
  await processObligations(run.id);

  // Stripe call also idempotent
  const invoice = await stripe.invoices.create({
    customer: tenantId,
    metadata: { billing_run_id: run.id }
  }, {
    idempotencyKey // Stripe's built-in protection
  });

  await prisma.billingRun.update({
    where: { id: run.id },
    data: {
      status: 'completed',
      stripeInvoiceId: invoice.id,
      completedAt: new Date()
    }
  });

  return run;
}
```

**Detection:**

- Duplicate invoices appear in Stripe dashboard for same period
- Customer receives multiple emails for same billing period
- Database query shows multiple billing_runs for same (tenant, period)
- Revenue reports show 2x expected amounts for certain periods

**Phase Impact:**

- **Phase 2 (Billing Core):** MUST implement idempotency from day one
- **Phase 3 (MAG Settlement):** True-up recalculations must be idempotent
- **Phase 4 (Admin Portal):** UI must handle "already billed" gracefully

---

### Pitfall 3: Contract Amendment State Explosion

**What goes wrong:**
Allowing mid-period amendments creates an exponential explosion of edge cases:

```
Original contract: $1000/month, Jan 1 - Dec 31
Amendment 1: $1200/month, effective Mar 15
Amendment 2: Add service X ($500/month), effective Apr 1
Amendment 3: Change to revenue share (10%), effective May 20

Billing period: May 1-31
- May 1-19: Fixed $1200 + $500 = $1700 (pro-rated 19/31)
- May 20-31: Revenue share 10% (pro-rated 12/31)

Wait, was Service X included in the revenue share?
Amendment 2 didn't specify an end date...
Do we charge $500 + 10% or just 10%?
```

Complexity multiplies:

- 3 amendments = 8 possible states
- 5 amendments = 32 states
- 10 amendments = 1024 states
- Each state needs proration logic, testing, and audit trail

**Why it happens:**

- Real-world contracts change frequently (customer demand)
- Developers model "contract is mutable" without constraints
- Business rules from legacy systems allow anything
- No one calculates the testing matrix upfront

**Consequences:**

- Billing logic becomes unmaintainable spaghetti code
- Each edge case requires hotfix → introduces new bugs
- Impossible to test all combinations
- Auditors can't verify calculations
- Support team can't explain invoices to customers
- Solo developer spends weeks debugging proration logic

**Prevention:**

```typescript
// STRATEGY 1: Amendment = New Contract (Full Period Only)
// Simplest: Amendments effective first day of next period only

// Decision documented in PROJECT.md:
// "Amendment: Next full period only — No mid-month proration for amendments"

const amendmentRules = {
  // Amendment creates new contract version
  effectiveDate: 'nextPeriodStart', // Always first day of month

  // Old contract: obligated through end of current period
  // New contract: obligated from start of next period
  // No overlap, no gaps, clean boundary
};

// Billing becomes simple
function getActiveContract(tenant: Tenant, billingDate: Date): Contract {
  return tenant.contracts
    .filter((c) => c.status === 'active')
    .filter((c) =>
      isWithinInterval(billingDate, {
        start: c.periodStart,
        end: c.periodEnd,
      }),
    )
    .sort((a, b) => b.version - a.version)[0]; // Latest version wins
}

// STRATEGY 2: If Mid-Period Required (not recommended for v1)
// Immutable contract snapshots with clear precedence rules

interface ContractSnapshot {
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  services: Service[];
  supersedes: UUID | null; // Audit trail
}

// Rule: Latest snapshot wins for overlapping dates
// Rule: No partial service additions (full contract replacement)
// Rule: Proration uses calendar days (not business days)
```

**Detection:**

- Business logic has deeply nested if/else for contract states
- Unit tests can't cover all amendment combinations
- Billing runs fail with "unexpected state" errors
- Customer invoices require manual review/adjustment
- Support tickets: "Why is my invoice different from contract?"

**Phase Impact:**

- **Phase 1 (Foundation):** Define amendment rules in data model NOW
- **Phase 2 (Billing Core):** Enforce "next period only" in contract workflow
- **Phase 5 (Polish):** If mid-period needed, requires dedicated sprint

---

### Pitfall 4: Formula Engine Injection & DoS

**What goes wrong:**
User-provided formulas can execute malicious code or hang the system:

```javascript
// BAD: Using eval() or unprotected math.js
const formula = contract.formula; // From database
const result = eval(formula); // CATASTROPHIC

// Attack vectors:
formula = 'process.exit(1)'; // Crash server
formula = 'while(true) {}'; // Infinite loop
formula = "require('fs').readFileSync('/etc/passwd')"; // Data theft
formula = "global.constructor.constructor('return process')().exit()"; // Escape sandbox
```

Even "safe" libraries like math.js have had sandbox escapes in the past.

**Why it happens:**

- Flexibility requirement: "Business users need to define custom formulas"
- Developers use math.js with default config (allows function definitions)
- No timeout protection for formula evaluation
- Formula validation happens at runtime, not at definition time

**Consequences:**

- Server crashes during billing run (DoS)
- Infinite loops consume 100% CPU, block billing queue
- Sandbox escapes → full server compromise
- Formula injection in metadata reads sensitive data
- Billing fails for ALL tenants (not just attacker)

**Prevention:**

```typescript
// CORRECT: Hardened math.js sandbox
import { create, all } from 'mathjs';

// Create restricted instance
const math = create({
  ...all,
  // REMOVE dangerous functions
  import: undefined,
  createUnit: undefined,
  evaluate: undefined,
  parse: undefined,
  compile: undefined,
  simplify: undefined,
  derivative: undefined,
  rationalize: undefined,
});

// Whitelist-only approach
const ALLOWED_FUNCTIONS = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'max',
  'min',
  'round',
  'floor',
  'ceil',
  'abs',
  'sqrt',
  'pow',
  'sum',
  'mean',
  'median',
]);

function validateFormula(formula: string): void {
  // Parse to AST
  const node = math.parse(formula);

  // Validate all function calls
  node.traverse((node: any) => {
    if (node.type === 'FunctionNode') {
      if (!ALLOWED_FUNCTIONS.has(node.fn.name)) {
        throw new Error(`Function '${node.fn.name}' not allowed`);
      }
    }
    // Block assignments
    if (node.type === 'AssignmentNode') {
      throw new Error('Assignments not allowed in formulas');
    }
  });
}

// Timeout protection
function evaluateFormula(formula: string, scope: object): Decimal {
  validateFormula(formula); // Static validation

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000); // 1s max

  try {
    // Compile once, reuse (performance)
    const compiled = math.compile(formula);
    const result = compiled.evaluate(scope);

    clearTimeout(timeout);
    return new Decimal(result.toString());
  } catch (err) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new Error('Formula execution timeout (max 1s)');
    }
    throw err;
  }
}

// Formula versioning (immutability)
interface FormulaVersion {
  id: UUID;
  serviceId: UUID;
  version: number;
  expression: string;
  validatedAt: Date;
  createdBy: UUID;
  // Once validated and used, NEVER modified
}
```

**Detection:**

- Billing runs timeout after 5+ minutes (normal: <1min)
- CPU spikes to 100% during billing
- Server crashes with "out of memory" during formula eval
- Security audit flags `eval()` or unrestricted `math.evaluate()`
- Penetration test successfully injects malicious formula

**Phase Impact:**

- **Phase 2 (Billing Core):** Sandbox hardening is CRITICAL before any formula use
- **Phase 3 (MAG Settlement):** Complex formulas increase attack surface
- **Phase 4 (Admin Portal):** UI must validate formulas on definition, not just runtime

---

### Pitfall 5: Multi-Currency Conversion Timing Ambiguity

**What goes wrong:**
When to convert? What rate to use? Different choices produce different amounts:

```typescript
// Scenario: Tenant's contract in EUR, airport's reporting currency is TRY
// Revenue share: 10% of monthly sales
// Sales: €10,000
// Exchange rate on invoice date: 1 EUR = 35 TRY
// Exchange rate on payment date: 1 EUR = 36 TRY

// Approach A: Convert individual line items
const revShareEUR = new Decimal('10000').times('0.10'); // €1,000
const revShareTRY = revShareEUR.times('35'); // ₺35,000
// Invoice: ₺35,000
// Payment received: €1,000 = ₺36,000 (customer paid in EUR)
// Difference: ₺1,000 (who bears FX risk?)

// Approach B: Convert after aggregation
const revShareEUR = new Decimal('10000').times('0.10'); // €1,000
// Invoice: €1,000 (customer pays in contract currency)
// Convert for reporting: €1,000 × 36 = ₺36,000
// But contract said "10% of TRY-equivalent sales"...

// Edge case: Amendment changes currency mid-year
// MAG guarantee: "€50,000 annual minimum"
// But monthly invoices in TRY...
// True-up calculation: Convert each month's TRY to EUR? Use average rate? Year-end rate?
```

**Why it happens:**

- Business requirements vague on FX risk allocation
- Multi-currency added late without architectural planning
- Rate source not specified (ECB, manual, bank feed)
- Stripe handles multi-currency differently than accounting expects

**Consequences:**

- Revenue reports don't reconcile with accounting
- MAG true-up calculations disputed by customers
- FX gains/losses not properly tracked
- Audit failures (can't explain how amounts derived)
- Inconsistent behavior between invoice generation and reporting

**Prevention:**

```typescript
// STRATEGY: Contract Currency = Source of Truth

// Principle 1: All obligations in contract's native currency
interface Contract {
  currency: 'EUR' | 'USD' | 'TRY';
  // All amounts in this contract use this currency
}

// Principle 2: Convert only for reporting, never for billing
interface InvoiceLine {
  amountCurrency: string;        // EUR (from contract)
  amount: Decimal;                // 1000.00
  reportingCurrency: string;      // TRY (airport's currency)
  reportingAmount: Decimal;       // 35000.00
  exchangeRate: Decimal;          // 35.0
  exchangeRateSource: string;     // 'ECB_2026_05_31'
  exchangeRateDate: Date;         // 2026-05-31
}

// Principle 3: Rate snapshot at obligation calculation time
async function calculateObligation(contract: Contract, period: Period) {
  const rate = await getExchangeRate(
    contract.currency,
    airport.reportingCurrency,
    period.end // Lock rate at period end
  );

  return {
    amount: calculatedAmount, // In contract currency
    reportingAmount: calculatedAmount.times(rate),
    exchangeRate: rate,
    exchangeRateDate: period.end
  };
}

// Principle 4: Document FX risk allocation
const FX_POLICY = {
  // Customer pays in contract currency → customer bears FX risk
  invoiceCurrency: 'contract.currency',

  // Airport reports in TRY → airport bears reporting FX risk
  reportingConversion: 'period_end_rate',

  // MAG true-up: Convert each month at that month's rate, sum in contract currency
  magTrueUpConversion: 'monthly_period_end_rates'
};

// Database schema
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(19, 8) NOT NULL,
  effective_date DATE NOT NULL,
  source VARCHAR(50) NOT NULL, -- 'ECB', 'MANUAL', 'TCMB'
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (from_currency, to_currency, effective_date, source)
);
```

**Detection:**

- Reports in different currencies show different revenue totals (after conversion)
- Customers question MAG true-up amounts
- Stripe invoice amounts don't match internal calculations
- Currency conversion audit trail missing
- FX gains/losses not balanced in accounting

**Phase Impact:**

- **Phase 1 (Foundation):** Define FX policy and rate source NOW
- **Phase 2 (Billing Core):** Implement rate snapshot at obligation time
- **Phase 3 (MAG Settlement):** True-up FX conversion critical
- **Phase 4 (Reporting):** Multi-currency reports need clear labels

---

### Pitfall 6: Stripe Webhook Event Ordering & Replay

**What goes wrong:**
Webhooks arrive out of order, duplicated, or missed entirely:

```typescript
// Events generated (Stripe side):
// 1. invoice.created (t=100ms)
// 2. invoice.finalized (t=200ms)
// 3. invoice.payment_succeeded (t=300ms)

// Events received (your server):
// - invoice.payment_succeeded (t=305ms, fast network)
// - invoice.created (t=350ms, slow retry)
// - invoice.finalized (t=400ms, retry after timeout)

// BAD: State machine assumes ordering
async function handleWebhook(event: StripeEvent) {
  switch (event.type) {
    case 'invoice.created':
      await db.invoice.create({ status: 'draft' });
      break;
    case 'invoice.finalized':
      await db.invoice.update({ status: 'finalized' }); // Runs BEFORE created!
      break;
    case 'invoice.payment_succeeded':
      await db.invoice.update({ status: 'paid' }); // Runs FIRST!
      break;
  }
}

// State machine breaks: paid → draft → finalized (nonsense)
```

Additional webhook pitfalls:

- Same event delivered twice (Stripe retry after timeout)
- Webhook endpoint downtime → events missed forever
- Events from test mode mixed with live mode
- Old events replayed during Stripe API issues

**Why it happens:**

- Network latency varies per request
- Stripe retries failed webhooks (up to 3 days)
- Developers assume HTTP request order = event order
- Event log isn't treated as source of truth

**Consequences:**

- Invoice status incorrect in database
- Payment recorded before invoice exists → foreign key error
- Duplicate payment processing
- Customers see "payment failed" when payment succeeded
- Manual reconciliation required between Stripe and DB

**Prevention:**

```typescript
// CORRECT: Idempotent, event-sourced webhook handling

// Database schema
CREATE TABLE stripe_events (
  id VARCHAR(255) PRIMARY KEY, -- Stripe event ID (evt_xxx)
  type VARCHAR(100) NOT NULL,
  api_version VARCHAR(20),
  created_at_stripe TIMESTAMPTZ NOT NULL, -- Event creation time from Stripe
  received_at TIMESTAMPTZ NOT NULL,       -- When we received it
  processed_at TIMESTAMPTZ,
  data JSONB NOT NULL,
  livemode BOOLEAN NOT NULL,
  -- Idempotency: Same event ID can only be processed once
);

CREATE INDEX idx_stripe_events_created ON stripe_events(created_at_stripe);
CREATE INDEX idx_stripe_events_processed ON stripe_events(processed_at) WHERE processed_at IS NULL;

// Webhook handler
async function handleStripeWebhook(payload: string, signature: string) {
  // 1. Verify signature (prevent spoofing)
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    webhookSecret
  );

  // 2. Store event (idempotent insert)
  const stored = await prisma.stripeEvent.upsert({
    where: { id: event.id },
    create: {
      id: event.id,
      type: event.type,
      apiVersion: event.api_version,
      createdAtStripe: new Date(event.created * 1000),
      receivedAt: new Date(),
      data: event.data,
      livemode: event.livemode
    },
    update: {
      receivedAt: new Date() // Update received time if duplicate
    }
  });

  // 3. If already processed, return success (idempotent)
  if (stored.processedAt) {
    return { received: true, processed: false, reason: 'duplicate' };
  }

  // 4. Process event with version check
  try {
    await processEvent(event);

    // 5. Mark as processed
    await prisma.stripeEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() }
    });

    return { received: true, processed: true };
  } catch (err) {
    // Log error but return 200 (don't trigger Stripe retry)
    logger.error('Webhook processing failed', { eventId: event.id, error: err });
    throw err; // Or return 500 to trigger retry
  }
}

// Event processor uses Stripe timestamp for ordering
async function processEvent(event: StripeEvent) {
  const invoice = event.data.object as Stripe.Invoice;

  // Fetch current state from Stripe (source of truth)
  const currentInvoice = await stripe.invoices.retrieve(invoice.id);

  // Update to Stripe's current state (ignore event ordering)
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      stripeInvoiceId: invoice.id,
      status: currentInvoice.status,
      amountDue: currentInvoice.amount_due,
      // ... map all fields from CURRENT state
    },
    update: {
      status: currentInvoice.status,
      amountDue: currentInvoice.amount_due,
      paidAt: currentInvoice.status === 'paid'
        ? new Date(currentInvoice.status_transitions.paid_at * 1000)
        : null
    }
  });
}

// Background job: Replay missed events
async function syncStripeEvents() {
  const lastEvent = await prisma.stripeEvent.findFirst({
    orderBy: { createdAtStripe: 'desc' }
  });

  const events = await stripe.events.list({
    created: { gt: lastEvent?.createdAtStripe ?? 0 },
    limit: 100
  });

  for (const event of events.data) {
    await handleStripeWebhook(JSON.stringify(event), /* skip signature */);
  }
}
```

**Detection:**

- Database invoice status doesn't match Stripe dashboard
- Webhook handler logs show events out of order
- Unique constraint violations on stripe_events.id
- Customers report payment status incorrect
- Manual reconciliation finds missing payments

**Phase Impact:**

- **Phase 2 (Billing Core):** Event storage and idempotency critical
- **Phase 3 (Payment Tracking):** Sync job prevents missed payments
- **Phase 4 (Admin Portal):** UI should show Stripe as source of truth

---

## Moderate Pitfalls

These cause bugs, support burden, or technical debt but don't require rewrites.

### Pitfall 7: Time Zone Confusion in Billing Periods

**What goes wrong:**

```typescript
// Airport timezone: Europe/Istanbul (UTC+3)
// Server timezone: UTC
// Developer local timezone: America/New_York (UTC-5)

// Contract: "Monthly billing on last day of month"
// May 2026: 31 days
// Istanbul: May 31, 2026 23:59:59 +03:00
// UTC:      May 31, 2026 20:59:59 +00:00
// NY:       May 31, 2026 15:59:59 -05:00

// Billing cron runs at UTC 00:00:00 (Jun 1 UTC)
// Is May billing period closed? Depends on timezone!
```

**Prevention:**

- Store all dates in UTC, convert for display only
- Use `date` type (not `timestamp`) for billing periods (no timezone)
- Airport configuration includes timezone setting
- Billing logic uses `startOfDay` / `endOfDay` in airport timezone

```typescript
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

const airport = { timezone: 'Europe/Istanbul' };
const periodEnd = new Date('2026-05-31'); // Date only, no time

// Convert to UTC midnight in airport timezone
const periodEndUTC = zonedTimeToUtc(
  `${periodEnd.toISOString().split('T')[0]}T23:59:59`,
  airport.timezone,
);

// Billing runs after this UTC timestamp
if (now > periodEndUTC) {
  runBilling();
}
```

---

### Pitfall 8: MAG Proration for Partial Months

**What goes wrong:**

```typescript
// Contract: $12,000 annual MAG ($1,000/month)
// Start date: Mar 15, 2026 (mid-month)
// March billing: 17 days of service

// Option A: Full month MAG ($1,000)
// Unfair to tenant (didn't operate full month)

// Option B: Prorated MAG ($1,000 × 17/31 = $548)
// But MAG is ANNUAL guarantee, not monthly
// Prorating monthly MAG defeats the purpose

// Option C: Prorate annual MAG ($12,000 × 290/365 = $9,534)
// Spread across remaining months: $9,534 / 10 months = $953/month
// Billing logic explosion (every contract has different MAG/month)
```

**Prevention:**

- Document MAG proration policy clearly in contract terms
- Recommended: No mid-month contract starts (align to period boundaries)
- If mid-month required: Prorate annual MAG, recalculate monthly threshold
- Store `effectiveMAGPerMonth` on contract (not derived)

---

### Pitfall 9: Audit Trail Incompleteness

**What goes wrong:**

```typescript
// Customer: "Why is May invoice $1,234.56?"
// Support: *checks database*
// invoice_lines.amount = 1234.56 ✓
// formula = "revenue * 0.10" ✓
// revenue_declaration.amount = 12345.60 ✓

// But... revenue was declared on June 2 (after billing period)
// Was it backdated? Amended? Imported from old system?
// Formula version: Was it 10% or 12% at billing time?
// Contract: Was there an amendment we're missing?

// Audit trail doesn't answer: "How did we get this number?"
```

**Prevention:**

```typescript
// Complete audit trail schema
CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL,

  -- WHAT was charged
  description TEXT NOT NULL,
  amount NUMERIC(19, 4) NOT NULL,

  -- WHERE it came from (immutable references)
  obligation_id UUID NOT NULL, -- Links to obligation
  contract_snapshot_id UUID NOT NULL, -- Contract state at billing time
  formula_version_id UUID NOT NULL, -- Exact formula used

  -- WHEN it was calculated
  calculated_at TIMESTAMPTZ NOT NULL,

  -- HOW it was calculated (reproducible)
  calculation_inputs JSONB NOT NULL, -- { revenue: 12345.60, rate: 0.10 }
  calculation_metadata JSONB, -- { exchange_rate: 35.0, meter_reading: 1234 }

  -- WHO triggered it
  created_by UUID, -- Admin user or 'SYSTEM'

  -- Traceability
  line_hash VARCHAR(64) UNIQUE NOT NULL -- Duplicate detection
);

// Generate deterministic hash
function calculateLineHash(line: InvoiceLineInput): string {
  const hashInput = JSON.stringify({
    tenantId: line.tenantId,
    periodStart: line.periodStart,
    periodEnd: line.periodEnd,
    obligationId: line.obligationId,
    amount: line.amount.toString(),
    calculationInputs: line.calculationInputs
  }, Object.keys(line).sort()); // Deterministic key order

  return crypto.createHash('sha256').update(hashInput).digest('hex');
}
```

**Detection:**

- Customers dispute invoices and you can't explain the calculation
- Auditors request "proof of calculation" and you can't provide it
- Support team escalates every billing question to engineering
- You need to manually recalculate invoices to verify

---

### Pitfall 10: Scope Creep: Multi-Airport Before Single-Airport

**What goes wrong:**

```typescript
// Day 1: "Architecture supports multi-airport"
// Week 2: "Let's add tenant-to-airport assignment"
// Week 4: "Need airport-level user permissions"
// Week 6: "Currency per airport... wait, what if tenant spans airports?"
// Week 8: "Airport hierarchy? Parent company consolidation?"
// Week 10: "Still no working demo"

// Meanwhile, competitor ships single-airport MVP and signs 3 customers
```

**Why it happens:**

- Developer has domain expertise, sees "obvious" future needs
- Technical perfectionism: "If we don't build it right now, we'll have to refactor"
- Fear of "painting into a corner" architecturally
- No product manager to say "not now"

**Consequences:**

- MVP timeline slips from 12 weeks to 24+ weeks
- Complexity increases testing burden (solo dev can't keep up)
- Demo requires explaining "multi-airport" when customer only has one
- Opportunity cost: Features that actually close deals don't get built

**Prevention:**

```typescript
// SCOPE DISCIPLINE for v1

// INCLUDE (demo-critical):
✓ Single airport configuration (hardcoded if needed)
✓ Multi-tenant support (multiple customers in one airport)
✓ Contract/billing/invoicing for ONE airport

// DEFER (architecture-ready, feature-gated):
✗ Airport switching UI
✗ Airport-level permissions
✗ Multi-airport tenant assignment
✗ Consolidated reporting across airports
✗ Airport hierarchy/groups

// Implementation: Feature flag pattern
interface Airport {
  id: UUID;
  name: string;
  // ... other fields
}

// v1: Single airport constant
export const DEMO_AIRPORT: Airport = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'İzmir Adnan Menderes Airport',
  currency: 'TRY',
  timezone: 'Europe/Istanbul'
};

// All queries hardcode airport
async function getTenants() {
  return prisma.tenant.findMany({
    where: { airportId: DEMO_AIRPORT.id }
  });
}

// v2: Query parameter
async function getTenants(airportId: UUID) {
  return prisma.tenant.findMany({
    where: { airportId }
  });
}

// Database schema: Multi-airport ready, but unused
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  airport_id UUID NOT NULL, -- FK exists, always same value in v1
  name TEXT NOT NULL,
  ...
);

// Skip building: Airport management UI, airport selector dropdown, etc.
```

**Detection:**

- Backlog has 15 "multi-airport" tickets, 0 completed
- Demo meeting: Customer asks "what's this airport dropdown for?"
- Timeline review: "Why did this take 3 weeks?" → "Multi-airport support"
- Codebase: Abstractions for features no one uses

**Phase Impact:**

- **Phase 1-4:** Hardcode single airport, skip multi-airport UI entirely
- **Phase 5:** Add multi-airport ONLY if customer demands it

---

## Minor Pitfalls

These cause annoyance or code smell but are easily fixed.

### Pitfall 11: BullMQ Job Retry Explosion

**What goes wrong:**

```typescript
// Billing job fails (Stripe API timeout)
// BullMQ retries: Attempt 2, 3, 4... 10
// Each retry creates new Stripe invoice (forgot idempotency key)
// Customer has 10 duplicate invoices
```

**Prevention:**

- Configure max retries: `attempts: 3`
- Use exponential backoff: `backoff: { type: 'exponential', delay: 1000 }`
- Idempotency key in job data
- Dead letter queue for failed jobs (manual review)

---

### Pitfall 12: Missing Index on Tenant Queries

**What goes wrong:**

```sql
-- Billing run queries all obligations for tenant
SELECT * FROM obligations
WHERE tenant_id = '...'
  AND period_start >= '2026-05-01'
  AND period_end <= '2026-05-31';

-- Without index: Full table scan (slow with 100K+ obligations)
```

**Prevention:**

```sql
CREATE INDEX idx_obligations_tenant_period
  ON obligations(tenant_id, period_start, period_end);

CREATE INDEX idx_invoice_lines_obligation
  ON invoice_lines(obligation_id);

CREATE INDEX idx_billing_runs_status
  ON billing_runs(status) WHERE status != 'completed';
```

---

### Pitfall 13: Hardcoded Formula Constants

**What goes wrong:**

```typescript
// Formula: "revenue * 0.10" (10% revenue share)
// Customer: "We negotiated 12%, please update"
// Developer: Must change formula string, re-validate, re-deploy
// Better: "revenue * rate" where rate is configurable
```

**Prevention:**

```typescript
// Formula uses variables
formula = 'revenue * rate';

// Variables stored in contract
contract.formulaVariables = {
  rate: new Decimal('0.10'),
};

// Amendment can change variables without formula change
```

---

### Pitfall 14: Email Notification Spam

**What goes wrong:**

```typescript
// Billing run processes 50 tenants
// Each generates invoice → 50 emails sent immediately
// Email provider rate limit: 10/minute
// 40 emails bounce, customers don't get invoices
```

**Prevention:**

- Queue emails (BullMQ job)
- Batch sending with rate limiting
- Digest option: "Daily invoice summary" instead of per-invoice
- Retry logic for bounced emails

---

## Phase-Specific Warnings

| Phase Topic                     | Likely Pitfall                | Mitigation                               | Detection                                      |
| ------------------------------- | ----------------------------- | ---------------------------------------- | ---------------------------------------------- |
| **Phase 1: Foundation**         | Using `number` for money      | Establish decimal.js pattern in first PR | Unit test: `expect(0.1 + 0.2).toBe(0.3)` fails |
| **Phase 2: Billing Core**       | Non-idempotent billing        | Unique constraint (tenant, period)       | Duplicate invoices in DB                       |
| **Phase 2: Formula Engine**     | Sandbox escape                | Whitelist functions, AST validation      | Security audit flags `eval()`                  |
| **Phase 3: MAG Settlement**     | FX rate timing ambiguity      | Document rate snapshot policy            | Revenue reports don't reconcile                |
| **Phase 3: MAG True-up**        | Proration edge cases          | Defer mid-month starts to v2             | Complex if/else in billing logic               |
| **Phase 4: Stripe Integration** | Webhook ordering assumptions  | Event sourcing pattern                   | Payment status incorrect                       |
| **Phase 4: Admin Portal**       | Scope creep: Multi-airport UI | Hardcode single airport constant         | Demo has unused features                       |
| **Phase 5: Testing**            | Missing indexes               | EXPLAIN ANALYZE all queries              | Slow billing runs (>1min)                      |

---

## Solo Developer Specific Warnings

### Warning 1: Over-Engineering for Scale You Don't Have

**Trap:** "This needs to handle 1M invoices/month" (you have 0 customers)

**Reality check:**

- 100 tenants × 12 invoices/year = 1,200 invoices (easily handled by PostgreSQL)
- Premature optimization wastes time on problems you don't have
- Better: Ship fast, profile later

**Mitigation:**

- Benchmark with realistic data (1K invoices, not 1M)
- Use standard patterns (indexes, connection pooling) without heroics
- Monitor query times; optimize only when >1s

---

### Warning 2: Perfectionism Paralysis

**Trap:** "This formula engine isn't production-ready, I need to add [10 more features]"

**Reality check:**

- "Good enough for demo" is good enough for v1
- Customers judge on UI and workflow, not code elegance
- Technical debt is cheaper than missed market opportunity

**Mitigation:**

- Time-box features: "If not done in 2 days, defer to v2"
- Focus on happy path (90% of use cases)
- Document known limitations (better than delayed ship)

---

### Warning 3: Test Coverage Obsession

**Trap:** "I need 90% test coverage before shipping"

**Reality check:**

- 90% coverage ≠ 90% confidence (tests can be shallow)
- Manual testing catches UI bugs that unit tests miss
- Time spent on tests = time not spent on features

**Mitigation:**

- Test critical paths: Billing calculation, invoice generation, Stripe integration
- Skip testing obvious CRUD (getAll, getById)
- E2E test: "Create contract → run billing → verify invoice" (covers 80% of logic)

---

## Confidence Assessment

| Area                     | Confidence | Notes                                                             |
| ------------------------ | ---------- | ----------------------------------------------------------------- |
| Financial precision      | HIGH       | Standard practice in financial software, well-documented          |
| Idempotency              | HIGH       | Common pattern in payment systems, Stripe docs cover this         |
| Formula engine security  | MEDIUM     | Based on math.js best practices, but new vulnerabilities emerge   |
| Multi-currency           | MEDIUM     | General patterns apply, but airport-specific edge cases may exist |
| Stripe webhooks          | HIGH       | Stripe docs + common failure modes well-known                     |
| State machine complexity | HIGH       | Universal problem in billing systems                              |
| Solo dev scope creep     | HIGH       | Pattern recognition from many projects                            |

## Sources

**Note:** Web search tools were unavailable during research. The above findings are based on:

1. **Training data** (financial software development patterns, billing system architecture)
2. **Stripe official documentation patterns** (webhook handling, idempotency, known from training)
3. **Math.js security considerations** (known vulnerabilities, sandbox patterns)
4. **PostgreSQL best practices** (NUMERIC type for money, indexing strategies)
5. **Domain expertise patterns** (billing system anti-patterns, state machine explosion)

**Confidence level: MEDIUM overall** — Core principles are sound and widely applicable, but specific library versions (math.js 2026, Stripe API changes) and new edge cases may exist. Recommend validating:

- Math.js current sandbox escape vulnerabilities (check CVE database)
- Stripe webhook best practices (current documentation, 2026)
- Decimal.js vs alternatives (currency.js, big.js, dinero.js)

**Verification needed before implementation:**

- [ ] Math.js sandbox hardening (check latest security advisories)
- [ ] Stripe webhook event ordering guarantees (official docs)
- [ ] PostgreSQL NUMERIC precision limits for financial calculations
- [ ] Decimal.js rounding modes for Turkish tax compliance

---

**Recommendation for roadmap:**
Prioritize pitfalls #1 (precision), #2 (idempotency), #4 (formula security) in Phase 1-2. These are foundational and expensive to retrofit. Defer #10 (multi-airport) entirely until customer demand proven.
