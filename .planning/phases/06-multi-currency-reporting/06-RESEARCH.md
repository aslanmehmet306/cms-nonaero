# Phase 6: Multi-Currency & Reporting - Research

**Researched:** 2026-03-06
**Domain:** Multi-currency exchange rate management, financial reporting, audit trail drill-down
**Confidence:** HIGH

## Summary

Phase 6 adds two complementary capabilities to the existing billing infrastructure: (1) an ExchangeRate management module for manual rate entry with effective dates, and currency conversion for reporting-only display; (2) a ReportsModule providing revenue summary dashboards, aging reports, and audit trail drill-down endpoints. Both build directly on existing Prisma models (Obligation, InvoiceLog, AuditLog, Contract) and the established DecimalHelper pattern.

The currency infrastructure is simpler than it appears -- contracts already carry a `currency` field, obligations already store `currency`, and Stripe already handles multi-currency natively (currency per invoice). What is missing is: (a) an ExchangeRate table with manual rate entry, (b) a lookup service to find the effective rate for a given date, and (c) reporting endpoints that convert amounts to a reporting currency using period-end snapshot rates. No changes to the billing pipeline are needed.

The reporting side is query-heavy with no new domain models. Revenue summaries use Prisma `groupBy` with `_sum` aggregation on Obligation and InvoiceLog. Aging reports use raw SQL (`$queryRaw`) for CASE-based bucket assignment (30/60/90 days). Audit trail drill-down already has endpoints (`GET /audit/entity/:entityType/:entityId`) but needs a unified "entity timeline" endpoint that combines audit entries with obligation traces.

**Primary recommendation:** Create 3 plans: (1) ExchangeRate schema + CRUD + rate lookup service, (2) Reporting endpoints (revenue summary, aging, KPIs), (3) Audit trail drill-down + currency conversion display layer.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R10.1 | Contract currency assignment (TRY, EUR, USD) | Already implemented -- Contract.magCurrency and Obligation.currency exist. Validation needed on obligation creation. |
| R10.2 | Exchange rate table with manual input (source, effective_date, from/to currency) | New ExchangeRate model + CRUD endpoints + ExchangeRateService with rate lookup |
| R10.3 | Obligation calculated in contract currency (source of truth) | Already implemented -- obligations store amount in contract currency |
| R10.4 | Reporting conversion at period-end rate (display only, not for billing) | ExchangeRateService.convert() + ReportsService.convertToReportingCurrency() |
| R10.5 | Stripe handles multi-currency invoicing natively | Already implemented -- invoice provider passes currency per invoice |
| R12.1 | Dashboard revenue summary by tenant, by service type | ReportsService with Prisma groupBy + _sum aggregation endpoints |
| R12.7 | Aging report (30/60/90 days overdue) | Raw SQL ($queryRaw) aging bucket query on InvoiceLog.dueDate |
| R12.8 | Audit trail drill-down (full entity change logs) | Enhanced AuditService with entity timeline endpoint combining audit + obligation traces |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | ^5.0.0 | ORM for ExchangeRate model + reporting queries | Already in use, groupBy + $queryRaw for reporting |
| decimal.js | ^10.0.0 | Exchange rate arithmetic (rate * amount) | Already in use via DecimalHelper pattern |
| class-validator | ^0.14.0 | DTO validation for rate input, report filters | Already in use across all modules |
| class-transformer | ^0.5.0 | Query parameter transformation | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/swagger | ^7.0.0 | OpenAPI docs for new endpoints | All new controllers |
| nestjs-cls | ^4.0.0 | Request-scoped airportId for reporting | Already globally configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma groupBy for revenue summary | Raw SQL $queryRaw | Use Prisma groupBy first; fall back to $queryRaw only for aging report (CASE buckets) |
| Manual exchange rates | API integration (ECB, TCMB) | Out of scope for v1 -- requirements specify manual input only |
| Separate reporting database | Same PostgreSQL | Demo scale does not justify read replicas or OLAP DB |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
  exchange-rates/
    exchange-rates.controller.ts    # CRUD + rate lookup endpoint
    exchange-rates.service.ts       # Rate management + lookup logic
    exchange-rates.module.ts
    dto/
      create-exchange-rate.dto.ts
      query-exchange-rates.dto.ts
    exchange-rates.service.spec.ts
  reports/
    reports.controller.ts           # Dashboard, aging, revenue summary endpoints
    reports.service.ts              # Aggregation queries + currency conversion
    reports.module.ts
    dto/
      revenue-summary-query.dto.ts
      aging-report-query.dto.ts
      dashboard-query.dto.ts
    reports.service.spec.ts
```

### Pattern 1: Exchange Rate Effective Date Lookup
**What:** Find the most recent exchange rate for a currency pair on or before a given date.
**When to use:** Every time a reporting conversion is needed (period-end snapshots).
**Example:**
```typescript
// ExchangeRateService.getRate()
async getRate(
  fromCurrency: string,
  toCurrency: string,
  effectiveDate: Date,
): Promise<{ rate: Decimal; source: string; effectiveDate: Date }> {
  // Same currency = rate 1.0
  if (fromCurrency === toCurrency) {
    return { rate: new Decimal(1), source: 'identity', effectiveDate };
  }

  // Find most recent rate on or before effectiveDate
  const exchangeRate = await this.prisma.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency,
      effectiveDate: { lte: effectiveDate },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  if (!exchangeRate) {
    throw new NotFoundException(
      `No exchange rate found for ${fromCurrency}/${toCurrency} on or before ${effectiveDate.toISOString()}`,
    );
  }

  return {
    rate: new Decimal(exchangeRate.rate.toString()),
    source: exchangeRate.source,
    effectiveDate: exchangeRate.effectiveDate,
  };
}
```

### Pattern 2: Revenue Summary with Prisma groupBy
**What:** Aggregate obligation amounts by tenant or service type using Prisma's groupBy.
**When to use:** Dashboard revenue summary endpoints.
**Example:**
```typescript
// Revenue by tenant
const byTenant = await this.prisma.obligation.groupBy({
  by: ['tenantId', 'currency'],
  where: {
    airportId,
    periodStart: { gte: periodFrom },
    periodEnd: { lte: periodTo },
    status: { in: ['ready', 'invoiced', 'settled'] },
  },
  _sum: { amount: true },
  _count: { id: true },
});

// Revenue by service type (chargeType)
const byService = await this.prisma.obligation.groupBy({
  by: ['chargeType', 'currency'],
  where: {
    airportId,
    periodStart: { gte: periodFrom },
    periodEnd: { lte: periodTo },
    status: { in: ['ready', 'invoiced', 'settled'] },
  },
  _sum: { amount: true },
  _count: { id: true },
});
```

### Pattern 3: Aging Report via Raw SQL
**What:** Bucket overdue invoices into 30/60/90+ day categories using CASE statements.
**When to use:** Aging report endpoint -- Prisma groupBy cannot express CASE-based bucket assignment.
**Example:**
```typescript
interface AgingBucket {
  bucket: string;
  count: bigint;
  total_amount: Decimal;
  currency: string;
}

const aging = await this.prisma.$queryRaw<AgingBucket[]>`
  SELECT
    CASE
      WHEN CURRENT_DATE - due_date BETWEEN 1 AND 30 THEN '1-30'
      WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN '31-60'
      WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN '61-90'
      WHEN CURRENT_DATE - due_date > 90 THEN '90+'
      ELSE 'current'
    END AS bucket,
    COUNT(*) AS count,
    SUM(amount_total) AS total_amount,
    currency
  FROM invoice_log
  WHERE airport_id = ${airportId}
    AND status NOT IN ('paid', 'voided')
    AND due_date IS NOT NULL
  GROUP BY bucket, currency
  ORDER BY bucket
`;
```

### Pattern 4: KPI Calculations
**What:** Total revenue, outstanding invoices, collection rate as single endpoint.
**When to use:** Dashboard top-level metrics.
**Example:**
```typescript
// Parallel queries for efficiency
const [totalRevenue, outstandingInvoices, paidInvoices] = await Promise.all([
  this.prisma.obligation.aggregate({
    where: { airportId, status: { in: ['invoiced', 'settled'] } },
    _sum: { amount: true },
  }),
  this.prisma.invoiceLog.aggregate({
    where: { airportId, status: { in: ['finalized', 'sent', 'past_due'] } },
    _sum: { amountTotal: true },
    _count: true,
  }),
  this.prisma.invoiceLog.aggregate({
    where: { airportId, status: 'paid' },
    _sum: { amountTotal: true },
    _count: true,
  }),
]);

const collectionRate = paidTotal.isZero()
  ? new Decimal(0)
  : DecimalHelper.divide(paidTotal, DecimalHelper.add(paidTotal, outstandingTotal));
```

### Anti-Patterns to Avoid
- **Converting amounts for billing:** Exchange rate conversion is DISPLAY ONLY. Never modify obligation.amount or invoiceLog.amountTotal with converted values. The original contract currency amount is always the source of truth.
- **Fetching all obligations for reporting:** Use Prisma groupBy and aggregate, not findMany followed by JS-side reduction. This pushes computation to PostgreSQL.
- **Real-time exchange rate APIs in v1:** Requirements specify manual input only. Do not add API integrations (ECB, TCMB) -- that is v2 scope (R16).
- **Storing converted amounts:** Do not add reportingAmount columns to existing tables. Conversion happens at query time using the period-end rate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aggregation queries | JS-side reduce over findMany | Prisma groupBy / aggregate / $queryRaw | DB-level aggregation is 5-10x faster, handles large datasets |
| Aging bucket assignment | Application-level date math | PostgreSQL CASE + date arithmetic via $queryRaw | One round-trip, no N+1, handles timezone correctly |
| Currency conversion math | Custom float arithmetic | DecimalHelper.multiply(amount, rate) | Existing pattern, avoids floating-point errors |
| Exchange rate effective date lookup | Custom binary search | Prisma findFirst with orderBy desc + lte filter | Database handles this efficiently with index |
| Pagination on reports | Custom offset calculation | Existing pagination pattern (skip/take/count) | Consistent with all other modules |

**Key insight:** This phase introduces no new architectural concepts. It is a query-and-display layer over existing data. The exchange rate table is the only new Prisma model. Everything else is aggregation queries and DTO responses.

## Common Pitfalls

### Pitfall 1: Decimal Aggregation Returns Null for Empty Groups
**What goes wrong:** Prisma `_sum` on Decimal fields returns `null` when no rows match the WHERE clause, not `0`.
**Why it happens:** SQL SUM() over an empty set returns NULL, and Prisma passes this through.
**How to avoid:** Always use `?? new Decimal(0)` when reading aggregation results. Wrap in a helper:
```typescript
const sum = new Decimal(result._sum.amount?.toString() ?? '0');
```
**Warning signs:** Dashboard shows NaN or crashes on empty periods.

### Pitfall 2: Exchange Rate Not Found for Date
**What goes wrong:** Report query fails because no exchange rate exists for the requested period-end date.
**Why it happens:** Admin hasn't entered rates for every date. Rate lookup needs "most recent on or before" semantics, not exact date match.
**How to avoid:** Use `findFirst` with `effectiveDate: { lte: targetDate }` and `orderBy: { effectiveDate: 'desc' }`. Return a clear 404 with "no rate found for X/Y before date Z" message.
**Warning signs:** Reports silently show zero or fail for EUR/USD contracts.

### Pitfall 3: Currency Mismatch in Grouped Aggregation
**What goes wrong:** Summing amounts across different currencies produces meaningless totals.
**Why it happens:** Obligations have different currencies (TRY, EUR, USD). A naive SUM ignores currency.
**How to avoid:** Always include `currency` in the `by` clause of groupBy. Return separate totals per currency, or convert to reporting currency using exchange rates before summing.
**Warning signs:** Dashboard shows "Total Revenue: 150,000" mixing TRY and EUR.

### Pitfall 4: BigInt from Raw SQL COUNT
**What goes wrong:** TypeScript errors when trying to use COUNT(*) result as number.
**Why it happens:** PostgreSQL COUNT returns bigint. Prisma $queryRaw returns JavaScript BigInt, not number.
**How to avoid:** Cast in SQL (`COUNT(*)::int`) or convert in TypeScript (`Number(row.count)`).
**Warning signs:** `TypeError: Cannot convert a BigInt value to a number` at runtime.

### Pitfall 5: Aging Report Timezone Drift
**What goes wrong:** Invoice due dates show in wrong aging bucket at month boundaries.
**Why it happens:** PostgreSQL `CURRENT_DATE` uses server timezone. If dates stored as @db.Date they are date-only (no timezone), but CURRENT_DATE comparison depends on server timezone setting.
**How to avoid:** Use explicit date in the query parameter rather than CURRENT_DATE:
```typescript
const today = new Date(); // application-level date
const aging = await this.prisma.$queryRaw`
  ... WHERE ${today}::date - due_date BETWEEN 1 AND 30 ...
`;
```
**Warning signs:** Aging buckets shift at midnight depending on server location.

### Pitfall 6: Unique Constraint on Exchange Rate
**What goes wrong:** Admin enters two rates for the same currency pair on the same date from the same source.
**Why it happens:** No unique constraint on (fromCurrency, toCurrency, effectiveDate, source).
**How to avoid:** Add `@@unique([fromCurrency, toCurrency, effectiveDate, source])` to ExchangeRate model. Use upsert for rate updates.
**Warning signs:** Duplicate rates cause ambiguous lookups.

## Code Examples

### ExchangeRate Prisma Model
```prisma
// Source: PITFALLS.md research + project conventions
model ExchangeRate {
  id              String   @id @default(uuid())
  airportId       String   @map("airport_id")
  fromCurrency    String   @map("from_currency")    // EUR, USD
  toCurrency      String   @map("to_currency")      // TRY (reporting currency)
  rate            Decimal  @db.Decimal(19, 8)        // High precision for FX rates
  effectiveDate   DateTime @map("effective_date") @db.Date
  source          String                             // 'MANUAL', 'TCMB', 'ECB'
  notes           String?
  createdBy       String   @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")

  @@unique([fromCurrency, toCurrency, effectiveDate, source])
  @@index([fromCurrency, toCurrency, effectiveDate])
  @@map("exchange_rate")
}
```

### Currency Conversion Helper
```typescript
// ReportsService helper for display-only conversion
async convertToReportingCurrency(
  amount: Decimal,
  fromCurrency: string,
  reportingCurrency: string,
  periodEnd: Date,
): Promise<{ convertedAmount: Decimal; rate: Decimal; rateDate: Date }> {
  if (fromCurrency === reportingCurrency) {
    return { convertedAmount: amount, rate: new Decimal(1), rateDate: periodEnd };
  }

  const { rate, effectiveDate } = await this.exchangeRateService.getRate(
    fromCurrency,
    reportingCurrency,
    periodEnd,
  );

  const convertedAmount = DecimalHelper.roundMoney(
    DecimalHelper.multiply(amount, rate),
  );

  return { convertedAmount, rate, rateDate: effectiveDate };
}
```

### Dashboard KPI Response Shape
```typescript
// GET /reports/dashboard?airportId=xxx&periodFrom=2026-01-01&periodTo=2026-12-31
interface DashboardResponse {
  kpis: {
    totalRevenue: { amount: string; currency: string }[];    // per currency
    outstandingInvoices: { amount: string; currency: string; count: number }[];
    collectionRate: number;  // percentage 0-100
    activeContracts: number;
    activeTenants: number;
  };
  revenueByTenant: Array<{
    tenantId: string;
    tenantName: string;
    amount: string;
    currency: string;
    obligationCount: number;
  }>;
  revenueByServiceType: Array<{
    chargeType: string;
    amount: string;
    currency: string;
    obligationCount: number;
  }>;
}
```

### Aging Report Response Shape
```typescript
// GET /reports/aging?airportId=xxx
interface AgingReportResponse {
  buckets: Array<{
    bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
    count: number;
    totalAmount: string;
    currency: string;
    invoices: Array<{
      id: string;
      tenantName: string;
      invoiceNumber: string;
      amountTotal: string;
      currency: string;
      dueDate: string;
      daysOverdue: number;
    }>;
  }>;
  summary: {
    totalOverdue: string;
    totalCurrent: string;
    currency: string;
  };
}
```

### Audit Trail Drill-Down Pattern
```typescript
// GET /reports/entity-timeline/:entityType/:entityId
// Combines audit log entries with obligation calculation traces
async getEntityTimeline(entityType: string, entityId: string) {
  const [auditEntries, obligation] = await Promise.all([
    this.auditService.findByEntity(entityType, entityId),
    entityType === 'Obligation'
      ? this.prisma.obligation.findUnique({
          where: { id: entityId },
          select: { calculationTrace: true, status: true, amount: true },
        })
      : null,
  ]);

  return {
    entityType,
    entityId,
    timeline: auditEntries.map((entry) => ({
      timestamp: entry.createdAt,
      action: entry.action,
      actor: entry.actor,
      changes: this.diffStates(entry.previousState, entry.newState),
    })),
    calculationTrace: obligation?.calculationTrace ?? null,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store reporting amounts in DB columns | Convert at query time using period-end rate | Project convention from PITFALLS.md | No schema changes to Obligation/InvoiceLog needed |
| Real-time FX API for rates | Manual rate entry table | v1 requirement (R10.2) | Simpler, no external dependency, admin-controlled |
| Application-level aggregation | Prisma groupBy + $queryRaw | Prisma 5.x stable | DB-level aggregation scales better |
| Custom reporting framework | Simple aggregation endpoints | This project | No BI tools needed for demo -- endpoints return JSON for frontend consumption |

**Deprecated/outdated:**
- nestjs-cashify: Community wrapper for currency conversion that uses external APIs. Not applicable here since requirements specify manual rates only.

## Open Questions

1. **Reporting currency default**
   - What we know: Airport has `defaultCurrency: 'TRY'`. All reporting conversion targets TRY.
   - What's unclear: Should users be able to choose a different reporting currency per report?
   - Recommendation: Default to airport.defaultCurrency (TRY). Allow optional `reportingCurrency` query parameter but default to TRY. Simple to implement.

2. **Exchange rate precision**
   - What we know: PITFALLS.md suggests Decimal(19,8) for rates. Currency amounts use Decimal(15,2).
   - What's unclear: Is 8 decimal places sufficient for TRY/EUR (rate ~35.0)?
   - Recommendation: Use Decimal(19,8) as suggested. TRY/EUR at 35.12345678 gives sub-cent precision on any practical amount.

3. **Aging report scope -- invoices vs obligations**
   - What we know: R12.7 says "aging report (30/60/90 days overdue)". InvoiceLog has dueDate and status.
   - What's unclear: Should aging be based on InvoiceLog.dueDate (invoice-level) or Obligation.dueDate (obligation-level)?
   - Recommendation: Use InvoiceLog.dueDate since invoices are what tenants actually pay. Obligations are internal. Fall back to obligation-level only if no invoices exist yet.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/api/prisma/schema.prisma` -- full model inventory, field types, relations
- Existing codebase: `apps/api/src/obligations/obligations.service.ts` -- aggregation patterns, currency handling
- Existing codebase: `apps/api/src/invoices/invoices.service.ts` -- invoice grouping, currency per invoice
- Existing codebase: `apps/api/src/audit/audit.service.ts` -- existing audit trail with entity drill-down
- Existing codebase: `apps/api/src/settlement/settlement.service.ts` -- DecimalHelper usage patterns
- Existing codebase: `apps/api/src/common/utils/decimal-helper.ts` -- financial math utility
- [Prisma Aggregation Docs](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing) -- groupBy, _sum, having, where
- [Prisma Raw SQL Docs](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql) -- $queryRaw, typed results, parameter safety
- [Stripe Multi-Currency Invoicing](https://docs.stripe.com/invoicing/multi-currency-customers) -- currency per invoice, filtering by currency
- `.planning/research/PITFALLS.md` lines 490-560 -- ExchangeRate schema design, FX policy, rate snapshot pattern

### Secondary (MEDIUM confidence)
- [Prisma vs Raw SQL Performance](https://medium.com/javarevisited/prisma-vs-raw-sql-i-measured-query-performance-for-30-days-b97c0ed5aa7d) -- raw SQL 5-6x faster for complex aggregations
- [Prisma Deep Dive Handbook 2025](https://dev.to/mihir_bhadak/prisma-deep-dive-handbook-2025-from-zero-to-expert-1761) -- groupBy patterns

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all existing dependencies
- Architecture: HIGH -- patterns directly derived from existing codebase (obligations, invoices, audit modules)
- ExchangeRate design: HIGH -- validated against PITFALLS.md research and standard FX patterns
- Reporting queries: HIGH -- Prisma groupBy and $queryRaw are well-documented, tested APIs
- Aging report: MEDIUM -- raw SQL pattern is standard but needs validation against actual InvoiceLog data shape
- Pitfalls: HIGH -- all pitfalls observed from codebase analysis (null aggregations, BigInt, timezone)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, no fast-moving dependencies)
