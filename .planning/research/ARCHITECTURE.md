# Architecture Patterns: Billing/Invoicing SaaS

**Domain:** Airport Non-Aeronautical Revenue Management SaaS
**Researched:** 2026-02-28
**Confidence:** MEDIUM (based on training data + domain patterns, not verified with current sources)

## Research Context & Limitations

**IMPORTANT:** This research was conducted without access to Context7 or web search tools due to permission restrictions. All findings are based on:
- Training data knowledge (cutoff: January 2025)
- General billing SaaS architecture patterns
- Project-specific requirements from PROJECT.md
- Domain reasoning about complex pricing/billing systems

**Confidence Level: MEDIUM** — Patterns described are well-established in the industry, but specific library recommendations and current best practices (2026) could not be verified against live sources.

## Recommended Architecture

### High-Level Pattern: **Modular Monolith with Domain Boundaries**

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway Layer                        │
│                     (NestJS Controllers/Guards)                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┬─────────────────┐
        │               │               │                 │
┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐ ┌────────▼────────┐
│   Contract   │ │ Obligation │ │   Billing  │ │     Invoice     │
│    Domain    │ │   Domain   │ │   Domain   │ │     Domain      │
│              │ │            │ │            │ │                 │
│ • Lifecycle  │ │ • Schedule │ │ • Run Mgmt │ │ • Generation    │
│ • Validation │ │ • Formula  │ │ • Queue    │ │ • Stripe Adapt  │
│ • Versioning │ │ • Calc Eng │ │ • State    │ │ • Email         │
└──────────────┘ └────────────┘ └────────────┘ └─────────────────┘
        │               │               │                 │
        └───────────────┴───────────────┴─────────────────┘
                        │
        ┌───────────────┼───────────────────────┐
        │               │                       │
┌───────▼──────┐ ┌─────▼──────┐        ┌──────▼───────┐
│  PostgreSQL  │ │   Redis    │        │   BullMQ     │
│              │ │            │        │              │
│ • Tenant DB  │ │ • Cache    │        │ • Job Queue  │
│ • JSONB Meta │ │ • Sessions │        │ • Async Work │
└──────────────┘ └────────────┘        └──────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Cross-Cutting Concerns                       │
│                                                                  │
│  • Multi-Tenant Context (airport_id + tenant_id filtering)      │
│  • Audit Trail (entity changes, calculation lineage)            │
│  • Event Bus (domain events for cross-module communication)     │
│  • Formula Sandbox (math.js with whitelist)                     │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale for Modular Monolith:**
- **Solo developer context:** Microservices add operational complexity (deployment, monitoring, service discovery) that's unjustified without a team
- **Shared transaction boundaries:** Contract → Obligation generation needs ACID guarantees
- **Simpler debugging:** Single process, unified logs, synchronous stack traces
- **Future extraction path:** Domain modules can be extracted to services later if scale demands it
- **NestJS native support:** Module system provides logical boundaries without network overhead

**When to reconsider:** When team size > 5 developers, or when billing runs exceed 1-hour duration and need horizontal scaling.

## Core Component Boundaries

### 1. Contract Domain

**Responsibility:** Manage contract lifecycle and enforce business rules

**Owns:**
- Contract entities (draft → published → active → amended/terminated)
- Contract versioning (amendments create new versions, old versions archived)
- Service definitions (rent, revenue share, utility, service charge)
- Formula definitions (stored as expression strings, validated on save)
- Area/unit allocation (which tenant occupies which space)

**Communicates With:**
- **Obligation Domain:** Triggers obligation schedule generation on contract publish
- **Billing Domain:** Provides contract snapshots for deterministic billing
- **Audit Domain:** Logs all state transitions and amendments

**Data Model:**
```typescript
Contract {
  id, airport_id, tenant_id, status, version,
  effective_from, effective_to,
  services: Service[], // rent, revenue_share, utility, etc.
  snapshot_at_billing: JSONB // frozen copy when billing run starts
}

Service {
  id, contract_id, service_type, formula_expression,
  unit_of_measure, billing_frequency, currency
}
```

**Key Patterns:**
- **State Machine:** Use state machine library (e.g., XState or simple enum-based) to enforce valid transitions
- **Event Sourcing Lite:** Emit `ContractPublished`, `ContractAmended` events (not full event sourcing, just domain events)
- **Immutability:** Published contracts are immutable; amendments create new versions

---

### 2. Obligation Domain

**Responsibility:** Schedule and calculate charges based on contracts

**Owns:**
- Obligation schedule (monthly/quarterly/annual recurring items)
- Formula evaluation engine (math.js sandbox)
- Calculation inputs (revenue declarations, meter readings, indices)
- Proration logic (for mid-period contract starts)
- MAG settlement logic (monthly higher-of, year-end true-up)

**Communicates With:**
- **Contract Domain:** Reads contract services to generate obligations
- **Billing Domain:** Provides calculated obligation amounts for invoicing
- **Revenue Declaration Module:** Ingests tenant-submitted revenue data
- **Meter Reading Module:** Ingests utility consumption data

**Data Model:**
```typescript
Obligation {
  id, contract_id, service_id, airport_id, tenant_id,
  period_start, period_end, billing_frequency,
  formula_snapshot: string, // frozen at obligation creation
  calculation_inputs: JSONB, // variables for formula
  calculated_amount: Decimal,
  currency, status, line_hash // for deduplication
}

RevenueDeclaration {
  id, tenant_id, airport_id, period_month,
  gross_revenue: Decimal, currency, uploaded_by, uploaded_at
}

MeterReading {
  id, meter_id, reading_date, value, unit
}
```

**Key Patterns:**
- **Formula Sandbox:** Use math.js with `evaluate()` in a restricted scope (whitelist allowed functions, no access to process/fs)
- **Determinism:** Store formula + inputs in obligation record so recalculation yields same result
- **Deduplication:** Hash contract_id + service_id + period to detect duplicates (line_hash)
- **Temporal Validity:** Query obligations by period_start/period_end ranges

---

### 3. Billing Domain

**Responsibility:** Orchestrate billing runs and manage billing state

**Owns:**
- Billing run entities (tracks run status, progress, errors)
- Tenant-level granularity (run all tenants, or specific tenant for delta re-run)
- Contract snapshot creation (freeze contract state at run start)
- Job queue integration (BullMQ for async processing)
- State machine (pending → running → completed/failed)

**Communicates With:**
- **Obligation Domain:** Fetches calculated obligations for the billing period
- **Invoice Domain:** Triggers invoice generation after obligations are finalized
- **BullMQ:** Enqueues billing jobs, handles retries, tracks progress
- **Notification Domain:** Sends progress updates (SSE) to admin UI

**Data Model:**
```typescript
BillingRun {
  id, airport_id, billing_period_month, status,
  tenant_filter: string[], // null = all tenants, or [tenant_id1, tenant_id2]
  started_at, completed_at, failed_at, error_message,
  total_tenants, processed_tenants, total_invoices
}

BillingRunLine {
  id, billing_run_id, tenant_id, obligation_id,
  amount, currency, status, error
}
```

**Key Patterns:**
- **Queue-Based Orchestration:**
  ```
  BillingRunController → BillingRunService.start()
                      → BullMQ.enqueue(billing-run-job, { run_id })
                      → BillingWorker.process()
                         → For each tenant:
                            - Create contract snapshot
                            - Fetch obligations for period
                            - Trigger invoice generation
                            - Update run progress
  ```
- **Idempotency:** Billing run can be re-executed; uses line_hash to skip already-processed obligations
- **Progress Tracking:** Store per-tenant status in BillingRunLine table
- **Delta Re-run:** Filter by tenant_id to re-run specific tenants without touching others

---

### 4. Invoice Domain

**Responsibility:** Generate invoices and integrate with payment providers

**Owns:**
- Invoice entities (line items, totals, status)
- Provider-agnostic adapter pattern (Stripe now, ERP later)
- Invoice PDF generation (optional for v1, Stripe handles this)
- Payment status synchronization
- Email notifications (invoice created, payment received)

**Communicates With:**
- **Billing Domain:** Receives billing run results
- **Stripe API:** Creates Stripe invoices via adapter
- **Email Service:** Sends invoice notifications
- **Audit Domain:** Logs invoice creation and payment events

**Data Model:**
```typescript
Invoice {
  id, airport_id, tenant_id, billing_run_id,
  invoice_number, invoice_date, due_date,
  subtotal, tax, total, currency, status,
  stripe_invoice_id, stripe_hosted_url,
  paid_at, sent_at
}

InvoiceLineItem {
  id, invoice_id, obligation_id,
  description, quantity, unit_price, amount, currency
}

// Adapter pattern
interface InvoiceProvider {
  createInvoice(invoice: Invoice, lineItems: InvoiceLineItem[]): Promise<ProviderInvoice>
  getInvoiceStatus(providerId: string): Promise<InvoiceStatus>
  voidInvoice(providerId: string): Promise<void>
}

StripeInvoiceAdapter implements InvoiceProvider {
  // Stripe-specific implementation
}
```

**Key Patterns:**
- **Adapter Pattern:** Abstract provider interface allows switching from Stripe to ERP without changing domain logic
- **Webhook Integration:** Stripe sends payment status webhooks → update invoice.status
- **Async Email:** Use BullMQ to send emails (don't block invoice creation)
- **Idempotency Keys:** Use invoice.id as Stripe idempotency key to prevent duplicate charges

---

### 5. Formula Engine (Cross-Cutting)

**Responsibility:** Safely evaluate pricing formulas

**Owns:**
- Expression parsing and validation
- Sandboxed execution environment
- Variable substitution
- Error handling for invalid expressions

**Integration:**
- **Library:** math.js (`evaluate()` method)
- **Sandbox:** Create isolated scope with only allowed variables/functions
- **Validation:** Parse formula on save, reject invalid syntax before contract publish

**Example:**
```typescript
// Formula definition (stored in Service)
formula: "base_rent * (1 + index_rate/100) * area_sqm"

// Evaluation context (from Obligation)
context = {
  base_rent: 100,
  index_rate: 5.2,
  area_sqm: 250
}

// Execution
import { evaluate } from 'mathjs'
const result = evaluate(formula, context) // 26300

// Security: whitelist scope
const scope = {
  ...context,
  // No access to Math, process, require, etc.
}
```

**Key Patterns:**
- **Whitelist Approach:** Only inject known variables (base_rent, area_sqm, etc.), reject attempts to access globals
- **Formula Versioning:** Store formula snapshot in obligation so changes to service definition don't affect past calculations
- **Validation on Save:** Test-evaluate formula with dummy data before allowing contract publish

---

### 6. Multi-Tenant Data Isolation

**Responsibility:** Ensure airport-level and tenant-level data separation

**Owns:**
- Row-Level Security (RLS) policies in PostgreSQL
- Tenant context injection (NestJS middleware)
- Query filtering by airport_id/tenant_id

**Patterns:**
```typescript
// NestJS Guard extracts tenant context from JWT
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const user = request.user // from JWT
    request.tenantContext = {
      airport_id: user.airport_id,
      tenant_id: user.tenant_id, // null for airport admins
      role: user.role
    }
    return true
  }
}

// Repository automatically filters by tenant context
class ContractRepository {
  async find(tenantContext: TenantContext) {
    return db.contract.findMany({
      where: {
        airport_id: tenantContext.airport_id,
        // Optionally filter by tenant_id if user is tenant role
        ...(tenantContext.tenant_id && { tenant_id: tenantContext.tenant_id })
      }
    })
  }
}

// PostgreSQL RLS (defense in depth)
CREATE POLICY tenant_isolation ON contracts
  USING (airport_id = current_setting('app.airport_id')::uuid);
```

**Key Patterns:**
- **Request-Level Context:** Extract tenant context early (middleware/guard), propagate through service layers
- **Repository Pattern:** Centralize filtering logic in repositories to avoid scattered WHERE clauses
- **Defense in Depth:** Application-level filtering + database-level RLS
- **Testing:** Use separate test databases or seed data with distinct airport_id values

---

## Data Flow Patterns

### 1. Contract Publish → Obligation Generation

```
User publishes contract
    ↓
ContractController.publish()
    ↓
ContractService.validateAndPublish()
    ↓ (transaction)
    ├─→ Update contract.status = 'published'
    ├─→ Emit ContractPublished event
    └─→ Commit
    ↓
ObligationService (event listener)
    ↓
For each service in contract:
    Calculate schedule (monthly/quarterly/annual)
    Create Obligation records
    Store formula snapshot
```

**Key Considerations:**
- **Transactional Boundary:** Contract status update + event emit in same transaction
- **Event-Driven:** Use NestJS EventEmitter or simple pub/sub to decouple domains
- **Synchronous vs Async:** For MVP, synchronous obligation generation is fine (< 1s for most contracts). Switch to async if contract has 100+ services.

---

### 2. Billing Run Execution

```
Admin triggers billing run for month M
    ↓
BillingController.start({ period_month: 'YYYY-MM' })
    ↓
BillingService.createRun()
    ↓ (transaction)
    ├─→ Create BillingRun record (status = 'pending')
    └─→ Commit
    ↓
BullMQ.add('billing-run', { run_id })
    ↓
BillingWorker.process(job)
    ↓
Update BillingRun.status = 'running'
    ↓
For each tenant:
    ↓
    ├─→ Create contract snapshot (JSONB copy)
    ├─→ Fetch obligations for period M
    ├─→ For each obligation:
    │       ├─→ Evaluate formula (if not already calculated)
    │       ├─→ Check line_hash (skip if duplicate)
    │       └─→ Store calculated amount
    ├─→ Group obligations by tenant
    ├─→ Trigger InvoiceService.create()
    └─→ Update BillingRunLine (status, amounts)
    ↓
Update BillingRun.status = 'completed'
    ↓
Emit BillingRunCompleted event
    ↓
NotificationService sends email to admin
```

**Key Considerations:**
- **Job Granularity:** One job per billing run (not per tenant). Tenant loop inside worker for transactional atomicity.
- **Progress Updates:** Use Redis pub/sub or SSE to stream progress to UI
- **Error Handling:** Log errors in BillingRunLine.error, mark run as 'partial' if some tenants fail
- **Retry Logic:** BullMQ handles retries; use exponential backoff for transient errors

---

### 3. Invoice Generation → Stripe

```
BillingWorker triggers invoice creation
    ↓
InvoiceService.create({ tenant_id, obligations[] })
    ↓ (transaction)
    ├─→ Create Invoice record (status = 'draft')
    ├─→ Create InvoiceLineItem records (one per obligation)
    ├─→ Calculate totals
    └─→ Commit
    ↓
StripeAdapter.createInvoice(invoice)
    ↓
Stripe API: Create customer (if not exists)
            Add invoice items
            Finalize invoice
    ↓
Update Invoice.stripe_invoice_id, .stripe_hosted_url
    ↓
Update Invoice.status = 'sent'
    ↓
BullMQ.add('send-invoice-email', { invoice_id })
    ↓
EmailWorker sends notification to tenant
```

**Key Considerations:**
- **Stripe Customer Mapping:** One Stripe customer per tenant (not per contract)
- **Idempotency:** Use invoice.id as Stripe idempotency key
- **Webhook Handling:** Separate controller for Stripe webhooks → updates invoice.status on payment
- **Currency:** Pass invoice.currency to Stripe (multi-currency support built-in)

---

### 4. Revenue Declaration Ingestion

```
Admin uploads CSV with revenue data
    ↓
RevenueDeclarationController.upload()
    ↓
Parse CSV (validate: tenant_id exists, period is valid, amount > 0)
    ↓ (transaction)
    For each row:
        ├─→ Create RevenueDeclaration record
        └─→ Update Obligation.calculation_inputs (if obligation already exists)
    ↓
Emit RevenueDeclarationUploaded event
    ↓
ObligationService recalculates MAG obligations for affected tenants
```

**Key Considerations:**
- **Validation:** Check tenant existence, period validity, currency match before insert
- **Upsert Logic:** If declaration for tenant+period already exists, update (not insert)
- **MAG Settlement:** Revenue share and MAG obligations depend on revenue declarations; recalculation triggered by event
- **Audit:** Store uploaded_by, uploaded_at for traceability

---

## Event-Driven State Machines

### Contract State Machine

```
draft ──publish()──> published ──activate()──> active
                                                  │
                                      ┌───────────┴────────────┐
                                      │                        │
                              amend() ▼                  terminate() ▼
                                  amended               terminated
                                      │
                         (creates new version, old → archived)
```

**Transitions:**
- `draft → published`: Validate formula syntax, area assignments
- `published → active`: Effective date reached (cron job checks daily)
- `active → amended`: Create new contract version, old version archived
- `active → terminated`: Set effective_to, stop generating obligations

**Events Emitted:**
- `ContractPublished` → triggers obligation schedule generation
- `ContractActivated` → no immediate action (informational)
- `ContractAmended` → triggers delta obligation generation for new terms
- `ContractTerminated` → triggers cleanup (cancel future obligations)

---

### Billing Run State Machine

```
pending ──start()──> running ──complete()──> completed
                        │
                        └──fail()──> failed
                                      │
                        ┌─────────────┘
                        │
                   retry()──> running
```

**Transitions:**
- `pending → running`: BullMQ job starts
- `running → completed`: All tenants processed successfully
- `running → failed`: Unrecoverable error (e.g., database down)
- `failed → running`: Manual retry by admin

**Events Emitted:**
- `BillingRunStarted` → logs event
- `BillingRunCompleted` → sends email to admin, updates dashboard
- `BillingRunFailed` → sends alert email to admin

---

### Obligation State Machine

```
scheduled ──calculate()──> calculated ──invoice()──> invoiced
                              │
                         recalculate() (if inputs change)
                              │
                              └──> calculated (updated amount)
```

**Transitions:**
- `scheduled → calculated`: Formula evaluated, amount stored
- `calculated → invoiced`: Included in billing run, invoice created
- `calculated → calculated`: Revenue declaration updated, recalculation triggered

**Events Emitted:**
- `ObligationCalculated` → logs calculation lineage (formula + inputs)
- `ObligationInvoiced` → locks obligation (no further recalculation)

---

## Suggested Build Order (Dependency Analysis)

### Phase 1: Foundation (no dependencies)
1. **Database schema** (Prisma migrations)
2. **Multi-tenant context** (NestJS guard + middleware)
3. **Audit trail module** (logs all entity changes)

### Phase 2: Master Data (depends on Phase 1)
4. **Airport/area hierarchy** (terminal > floor > zone > unit)
5. **Tenant management** (with Stripe customer sync)
6. **Service definitions** (rent, revenue share, utility types)

### Phase 3: Contract Domain (depends on Phase 2)
7. **Contract CRUD** (draft/publish/amend/terminate state machine)
8. **Formula engine** (math.js sandbox + validation)
9. **Contract versioning** (amendment creates new version)

### Phase 4: Obligation Domain (depends on Phase 3)
10. **Obligation schedule generation** (triggered by contract publish)
11. **Revenue declaration module** (CSV upload)
12. **Meter reading module** (manual entry for v1)
13. **MAG settlement logic** (monthly higher-of + year-end true-up)
14. **Proration logic** (mid-period contract starts)

### Phase 5: Billing Domain (depends on Phase 4)
15. **BullMQ setup** (Redis queue configuration)
16. **Billing run orchestration** (run creation, worker processing)
17. **Contract snapshot** (JSONB freeze at run start)
18. **Progress tracking** (SSE for real-time updates)

### Phase 6: Invoice Domain (depends on Phase 5)
19. **Invoice generation** (from billing run results)
20. **Stripe adapter** (invoice creation, payment sync)
21. **Webhook handling** (payment status updates)
22. **Email notifications** (async via BullMQ)

### Phase 7: Admin UI (depends on all)
23. **Dashboard** (KPIs, recent activity)
24. **Contract management** (CRUD + state transitions)
25. **Billing operations** (trigger runs, view progress)
26. **Invoice list** (view, resend, void)

**Rationale:**
- **Bottom-up dependencies:** Can't build contracts without tenants, can't build billing without obligations
- **Formula engine early:** Needed for contract validation before publish
- **Async infrastructure mid-phase:** BullMQ needed before billing runs, but not for contract/obligation setup
- **UI last:** Backend API can be tested with Postman/curl while UI is in progress

**Parallel Work Opportunities (solo developer still valuable for context switching):**
- Phase 2 (master data) modules are independent (airport, tenant, service can be built in any order)
- Phase 4 (obligation) modules: Revenue declaration and meter reading are independent
- Phase 7 (UI): Dashboard and contract UI can be built in parallel if API is ready

---

## Scalability Considerations

| Concern | At 10 Airports, 100 Tenants | At 100 Airports, 1K Tenants | At 1K Airports, 10K Tenants |
|---------|------------------------------|------------------------------|-----------------------------|
| **Database** | Single PostgreSQL instance (Supabase/Railway free tier) | Vertical scaling (4-8 vCPU, 16-32GB RAM) | Read replicas for reports; consider partitioning by airport_id |
| **Billing Runs** | Synchronous (< 1 min) | BullMQ with 2-4 workers (< 10 min) | BullMQ with 10+ workers; consider per-airport queue sharding |
| **Formula Evaluation** | In-process math.js | Same (CPU-bound, not I/O) | Consider V8 isolates for true sandboxing (Cloudflare Workers pattern) |
| **File Storage** | Local filesystem (revenue CSVs) | S3-compatible (Supabase Storage) | Same; add CDN for invoice PDFs |
| **Multi-Tenant Isolation** | Row-level filtering | Same + RLS policies | Consider schema-per-airport for large tenants (rare) |
| **Caching** | Redis for sessions only | Add Redis cache for contract/obligation lookups | Same; consider separate cache per airport |

**When to Extract Microservices:**
- **Billing Worker:** If billing runs > 1 hour, extract to dedicated service with horizontal scaling
- **Formula Engine:** If formula evaluation becomes CPU bottleneck, extract to FaaS (AWS Lambda, Cloudflare Workers)
- **Invoice Provider:** If ERP integration requires VPN/firewall, extract to separate service in private network

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Billing Run as Cron Job
**What:** Run billing as a cron job that queries all tenants and generates invoices synchronously.
**Why bad:**
- No progress tracking (all-or-nothing)
- Hard to retry failed tenants (must re-run entire batch)
- Blocks server if run is long
- No visibility into errors

**Instead:** Use queue-based orchestration (BullMQ) with per-tenant granularity and progress tracking.

---

### Anti-Pattern 2: Storing Calculated Amounts Without Lineage
**What:** Store obligation.amount but not the formula/inputs used to calculate it.
**Why bad:**
- Can't reproduce calculation (audit nightmare)
- Can't debug why tenant was charged X
- Can't recalculate if formula changes (no snapshot)

**Instead:** Store formula snapshot + calculation inputs in obligation record (JSONB). Include line_hash for deduplication.

---

### Anti-Pattern 3: Tenant-Scoped Database (Schema Per Tenant)
**What:** Create separate PostgreSQL schema for each tenant.
**Why bad:**
- Migration complexity (run migrations × N tenants)
- Connection pool exhaustion (PostgreSQL has max_connections limit)
- Hard to query across tenants (reporting)
- Overkill for airport SaaS (tenants don't need full isolation)

**Instead:** Use row-level filtering with airport_id + tenant_id columns. Add RLS policies for defense in depth.

---

### Anti-Pattern 4: Hard-Coded Stripe Logic in Invoice Domain
**What:** Directly call Stripe SDK in InvoiceService without abstraction.
**Why bad:**
- Impossible to switch to ERP integration later (vendor lock-in)
- Hard to test (can't mock Stripe API easily)
- Couples domain logic to infrastructure

**Instead:** Use adapter pattern (`InvoiceProvider` interface). Inject `StripeAdapter` for v1, swap with `ErpAdapter` for v2.

---

### Anti-Pattern 5: Mutable Published Contracts
**What:** Allow editing contract.formula after contract is published.
**Why bad:**
- Past billing runs become non-reproducible (formula changed)
- Audit trail breaks (can't prove what was billed)
- Disputes impossible to resolve (no snapshot of original terms)

**Instead:** Published contracts are immutable. Amendments create new contract version (old version archived). Obligation stores formula snapshot.

---

### Anti-Pattern 6: Global Formula Scope
**What:** Allow formulas to access global variables (Math, process, require, etc.).
**Why bad:**
- Security risk (code injection: `process.exit()`, `require('fs').writeFile()`)
- Non-determinism (Math.random() makes billing irreproducible)
- Debugging nightmare (formulas have side effects)

**Instead:** Use math.js with whitelisted scope. Only inject known variables (base_rent, area_sqm, etc.). Reject attempts to access globals.

---

### Anti-Pattern 7: Ignoring Currency in Calculations
**What:** Store all amounts as numbers without currency metadata.
**Why bad:**
- Can't mix currencies in reports (100 TRY + 100 EUR = 200 what?)
- Exchange rate application unclear (when to convert?)
- Multi-currency invoices broken

**Instead:** Store currency alongside every monetary amount. Use Decimal type (not float). Convert at display time, never in database.

---

## Open Questions for Phase-Specific Research

1. **Formula Engine Sandboxing:**
   - Is math.js sandbox sufficient for production? (LOW confidence)
   - Should we use V8 isolates (isolated-vm) for true sandboxing? (needs performance benchmarking)
   - How to handle formula timeout (infinite loops)?

2. **BullMQ vs Alternatives:**
   - Is BullMQ the best queue for NestJS + Redis? (MEDIUM confidence, but not verified with 2026 sources)
   - Should we consider PostgreSQL-based queue (pgBoss) to reduce dependencies?

3. **Multi-Tenant RLS in Prisma:**
   - Does Prisma support PostgreSQL RLS policies natively? (LOW confidence — need to verify with Prisma docs)
   - Should we use raw SQL for RLS or middleware?

4. **Invoice Provider Abstraction:**
   - What's the minimal interface for ERP integration? (needs discovery with target ERPs)
   - Should we support multiple providers simultaneously (Stripe + ERP)?

5. **Event Bus:**
   - Is NestJS EventEmitter sufficient, or should we use external bus (RabbitMQ, Kafka)? (MEDIUM confidence — EventEmitter is fine for monolith, but needs verification)

6. **Decimal Precision:**
   - Should we use Prisma Decimal type or PostgreSQL NUMERIC? (need to verify Prisma support)
   - How to handle rounding in multi-step calculations (MAG settlement)?

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Modular Monolith vs Microservices | **HIGH** | Well-established pattern for solo developers; training data + domain reasoning |
| Contract → Obligation → Billing → Invoice Pipeline | **HIGH** | Standard billing domain model; verified against project requirements |
| Queue-Based Billing Orchestration (BullMQ) | **MEDIUM** | BullMQ is a common choice for NestJS, but not verified with 2026 sources |
| Provider-Agnostic Adapter Pattern | **HIGH** | Classic adapter pattern; widely used for payment integrations |
| Multi-Tenant Data Isolation | **MEDIUM** | Row-level filtering is standard, but RLS + Prisma interaction not verified |
| Formula Engine (math.js) | **MEDIUM** | math.js is popular, but sandboxing details need verification with current docs |
| Event-Driven State Machines | **HIGH** | Standard domain modeling pattern; no library dependency |
| Suggested Build Order | **HIGH** | Based on dependency analysis of project requirements |

---

## Sources

**IMPORTANT:** This research was conducted without access to web search or Context7 due to permission restrictions. All findings are based on:

- **Training data** (cutoff: January 2025) — general knowledge of billing SaaS architecture patterns
- **Domain reasoning** — applying standard software architecture patterns to the billing domain
- **Project requirements** — from `.planning/PROJECT.md`

**No external sources were consulted.** Recommendations should be validated against:
- Official NestJS documentation (2026)
- BullMQ documentation (2026)
- Prisma documentation (especially RLS support)
- math.js security best practices
- Stripe API documentation (invoice creation, multi-currency)

**Confidence Level: MEDIUM** — Patterns described are industry-standard, but specific library versions, API changes, and current best practices (2026) could not be verified.

---

## Next Steps for Roadmap

Based on this architecture research, the roadmap should:

1. **Phase 1 (Foundation):** Focus on multi-tenant context, database schema, audit trail
2. **Phase 2 (Master Data):** Build tenant/airport/service management (no dependencies)
3. **Phase 3 (Contract Domain):** Implement contract lifecycle + formula engine (depends on master data)
4. **Phase 4 (Obligation Domain):** Build obligation scheduling + calculation (depends on contracts)
5. **Phase 5 (Billing Orchestration):** Add BullMQ + billing runs (depends on obligations)
6. **Phase 6 (Invoice Integration):** Stripe adapter + webhooks (depends on billing)
7. **Phase 7 (Admin UI):** Build frontend (depends on all APIs)

**Critical Path:** Contract → Obligation → Billing → Invoice (must be sequential)
**Parallel Opportunities:** Master data modules, UI components (if API is ready)
**Research Flags:** Formula engine sandboxing (Phase 3), BullMQ performance (Phase 5), Prisma RLS (Phase 1)
