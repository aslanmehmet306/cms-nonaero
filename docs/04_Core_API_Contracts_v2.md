# 🔌 CORE API CONTRACTS
## Stripe Integration & Internal REST APIs

**Version:** v3.0 (Post-Review Edition)
**Last Updated:** 2026-02-28
**Framework:** NestJS + TypeScript
**Base URL:** `https://api.airport-revenue.com`
**Review Status:** Tenant-level billing ops, delta run, declaration validation added

---

## 1. AUTHENTICATION

### Admin Portal Auth
```
POST /api/v1/auth/admin/login
Body: { "email": "admin@adb.airport", "password": "..." }
Response: { "access_token": "...", "refresh_token": "...", "expires_in": 900 }

POST /api/v1/auth/admin/refresh
Body: { "refresh_token": "..." }
Response: { "access_token": "...", "expires_in": 900 }
```

### Tenant Portal Auth (Separate Domain)
```
POST /api/v1/auth/tenant/login
Body: { "email": "user@dutyfree.com", "password": "...", "tenant_code": "TNT-001" }
Response: { "access_token": "...", "refresh_token": "...", "tenant_id": "...", "expires_in": 1800 }
```

### JWT Payload
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "commercial_manager",
  "airport_id": "adb-uuid",
  "tenant_id": null,         // null for admin, set for tenant users
  "iat": 1709136000,
  "exp": 1709136900
}
```

---

## 2. STRIPE INTEGRATION APIs

### 2.1 Customer (Tenant) Sync

**Trigger:** Tenant oluşturulduğunda otomatik.

```
Platform → Stripe:
POST https://api.stripe.com/v1/customers
{
  "name": "Aegean Duty Free",
  "email": "billing@aegeandutyfree.com",
  "metadata": {
    "airport_id": "ADB",
    "tenant_id": "TNT-001",
    "tax_id": "TR1234567890"
  },
  "preferred_locales": ["tr"],
  "currency": "try"
}

Response → Platform stores: tenant.stripe_customer_id = "cus_Abc123"
```

### 2.2 Invoice Creation (Per Charge Type)

**Trigger:** Billing Run approved → BullMQ stripe-invoice queue.

```
Step 1: Create Invoice
POST https://api.stripe.com/v1/invoices
Idempotency-Key: "BR-2026-03-001_base_rent_TNT-001"
{
  "customer": "cus_Abc123",
  "collection_method": "send_invoice",
  "days_until_due": 30,
  "currency": "try",
  "auto_advance": true,
  "metadata": {
    "airport_id": "ADB",
    "billing_run_id": "BR-2026-03-001",
    "contract_id": "CTR-2026-001",
    "contract_version": "3",
    "charge_type": "base_rent",
    "period": "2026-03"
  }
}

Step 2: Add Line Items (per obligation)
POST https://api.stripe.com/v1/invoiceitems
{
  "customer": "cus_Abc123",
  "invoice": "in_1Abc...",
  "amount": 4500000,
  "currency": "try",
  "description": "Base Rent - INT-G-DF-001 (300 m²) - March 2026",
  "metadata": {
    "obligation_id": "OBL-2026-03-001",
    "service_id": "SVC-RENT-001",
    "formula_version": "2",
    "area_code": "INT-G-DF-001"
  }
}

Step 3: Finalize
POST https://api.stripe.com/v1/invoices/{id}/finalize
```

### 2.3 Credit Note (Phase 2)
```
POST https://api.stripe.com/v1/credit_notes
{
  "invoice": "in_1Abc...",
  "lines": [{ "type": "invoice_line_item", "invoice_line_item": "il_1Xyz...", "amount": 200000 }],
  "reason": "order_change",
  "metadata": { "adjustment_reason": "late_declaration_correction" }
}
```

---

## 3. WEBHOOK HANDLER

### Endpoint
```
POST /api/v1/webhooks/stripe

Security:
  - Stripe-Signature header verification (HMAC SHA-256)
  - Timestamp check (reject >5 min old)
  - Event ID deduplication (webhook_event_log table)
```

### Event Processing Map
| Stripe Event | Platform Action | Obligation Update |
|-------------|-----------------|-------------------|
| `invoice.finalized` | Log, mark issued, email tenant | — |
| `invoice.sent` | Log delivery | — |
| `invoice.paid` | Settlement ledger update | → `settled` |
| `invoice.payment_failed` | Alert tenant + finance, retry queue | — |
| `invoice.overdue` | Alert tenant + finance | — |
| `invoice.voided` | Mark void | → revert to `ready` |

### Idempotent Processing Flow
```
1. Receive event
2. Verify Stripe signature
3. Check webhook_event_log for event_id
4. If exists → return 200 (already processed)
5. Process event within DB transaction
6. Insert event_id into webhook_event_log
7. Return 200
8. On failure → return 500 → Stripe retries (3 days, increasing intervals)
```

---

## 4. INTERNAL REST APIs

### 4.1 Airport & Area

```
GET    /api/v1/airports                        List airports
GET    /api/v1/airports/:id                    Get airport
GET    /api/v1/airports/:id/areas              Area hierarchy (tree)
POST   /api/v1/areas                           Create area
GET    /api/v1/areas/:id                       Get area
PUT    /api/v1/areas/:id                       Update area
GET    /api/v1/areas/:id/children              Get child areas
```

### 4.2 Service Definition

```
POST   /api/v1/services                        Create service
GET    /api/v1/services                        List services (?status=published)
GET    /api/v1/services/:id                    Get service
PUT    /api/v1/services/:id                    Update (draft only)
POST   /api/v1/services/:id/publish            Publish → immutable
POST   /api/v1/services/:id/deprecate          Deprecate
GET    /api/v1/services/:id/versions           Version history
```

### 4.3 Formula

```
POST   /api/v1/formulas                        Create formula
GET    /api/v1/formulas                        List formulas
GET    /api/v1/formulas/:id                    Get formula
PUT    /api/v1/formulas/:id                    Update (draft only)
POST   /api/v1/formulas/:id/publish            Publish

POST   /api/v1/formulas/:id/evaluate           Dry-run test
Body: {
  "variables": {
    "area_m2": 300,
    "rate_per_m2": 150,
    "days_in_period": 31,
    "days_in_year": 365
  }
}
Response: {
  "result": 3821.92,
  "trace": [
    { "step": "area_m2 * rate_per_m2", "result": 45000 },
    { "step": "45000 * days_in_period", "result": 1395000 },
    { "step": "1395000 / 365", "result": 3821.92 }
  ],
  "execution_time_ms": 2
}
```

### 4.4 Contract

```
POST   /api/v1/contracts                       Create contract
GET    /api/v1/contracts                       List (?status=active&tenant_id=...)
GET    /api/v1/contracts/:id                   Get contract (with areas, services, MAG)
PUT    /api/v1/contracts/:id                   Update (draft only)
POST   /api/v1/contracts/:id/submit            Submit for review
POST   /api/v1/contracts/:id/approve           Approve (requires different user)
POST   /api/v1/contracts/:id/publish           Publish → ⚡ triggers obligation schedule
POST   /api/v1/contracts/:id/amend             Create amendment → new draft version
Body: {
  "amendment_type": "rate_change",             // rate_change | area_change | service_change | term_extension
  "effective_from": "2026-04-01",              // her zaman sonraki tam period başı
  "reason": "Annual rate adjustment"
}

POST   /api/v1/contracts/:id/suspend           Suspend
POST   /api/v1/contracts/:id/resume            Resume from suspended
POST   /api/v1/contracts/:id/terminate         Terminate
Body: {
  "termination_date": "2026-06-30",
  "reason": "Tenant vacated premises"
}

GET    /api/v1/contracts/:id/obligations       List obligation schedule
GET    /api/v1/contracts/:id/settlement        Settlement status (MAG)
```

### 4.5 Obligation

```
GET    /api/v1/obligations                     List (filterable)
       ?status=ready&charge_type=base_rent&period=2026-03&tenant_id=...
GET    /api/v1/obligations/:id                 Get with full trace
PUT    /api/v1/obligations/:id/hold            Put on hold
PUT    /api/v1/obligations/:id/release         Release from hold
GET    /api/v1/obligations/schedule            Future obligation schedule (forecasting)
       ?contract_id=...&from=2026-03&to=2026-12
GET    /api/v1/obligations/missing-declarations Missing declarations report
       ?period=2026-03
```

### 4.6 Declaration (Tenant Portal)

```
POST   /api/v1/declarations                    Create declaration
GET    /api/v1/declarations                    List (?tenant_id=...&period=2026-03)
GET    /api/v1/declarations/:id                Get declaration with lines + attachments
PUT    /api/v1/declarations/:id                Update (draft only)
POST   /api/v1/declarations/:id/submit         Submit for validation
POST   /api/v1/declarations/upload             Excel bulk upload
       Content-Type: multipart/form-data
       Response: { "declaration_id": "...", "lines_parsed": 15, "validation_errors": [] }

// === NEW: Declaration Attachments ===
POST   /api/v1/declarations/:id/attachments    Upload evidence (POS report, Z report)
       Content-Type: multipart/form-data
       Body: { "file": <binary>, "file_type": "pos_report" }
GET    /api/v1/declarations/:id/attachments    List attachments
DELETE /api/v1/declarations/:id/attachments/:aid  Remove attachment (draft only)

// === Declaration Validation Rules (auto-applied on submit) ===
// - Negatif grossAmount → REJECT
// - Önceki aya göre %50+ sapma → WARNING (flag, submit izni var)
// - Boş gün kontrolü (31 günlük ayda <20 gün veri) → WARNING
// - Duplicate period + tenant + category → REJECT
// - Sıfır grossAmount → WARNING
// - Currency mismatch (TRY dışı) → REJECT (Phase 1)
// - grossAmount = KDV dahil brüt satış tutarı
```

### 4.7 Billing Run

```
POST   /api/v1/billing-runs                    Create & queue billing run
Body: {
  "run_type": "scheduled",
  "run_mode": "full",                          // "full" | "delta"
  "period_start": "2026-03-01",
  "period_end": "2026-03-31",
  "filters": {
    "charge_types": ["base_rent", "revenue_share"],
    "tenant_ids": null,                        // null = tümü, ["TNT-001"] = tekil
    "zone_codes": null
  },
  "previous_run_id": null                      // delta mode ise referans run
}
Response: {
  "id": "BR-2026-03-001",
  "status": "initiated",
  "run_mode": "full",
  "contract_snapshot_taken": true,
  "job_id": "bull-job-123"
}

GET    /api/v1/billing-runs                    List runs
GET    /api/v1/billing-runs/:id                Get run status & summary
GET    /api/v1/billing-runs/:id/preview        Draft preview (only when draft_ready)
Response: {
  "summary": {
    "total_obligations": 12,
    "total_amount": 245000.00,
    "invoices_to_create": 8,
    "run_mode": "full",
    "by_charge_type": {
      "base_rent": { "count": 5, "amount": 95000 },
      "revenue_share": { "count": 3, "amount": 150000 }
    },
    "by_tenant": {
      "TNT-001": { "count": 2, "amount": 69000 },
      "TNT-002": { "count": 3, "amount": 45000 }
    },
    "skipped": {
      "missing_declaration": 2,
      "on_hold": 1
    }
  },
  "lines": [...]
}

POST   /api/v1/billing-runs/:id/approve        Approve → triggers Stripe invoicing
POST   /api/v1/billing-runs/:id/reject         Reject
POST   /api/v1/billing-runs/:id/retry          Retry failed invoices
GET    /api/v1/billing-runs/:id/invoices       List invoices in run

// === NEW: Tenant-Level Cancel (partial cancel) ===
POST   /api/v1/billing-runs/:id/cancel         Cancel entire run or specific tenants
Body: {
  "tenant_ids": ["TNT-001", "TNT-002"],       // null = cancel entire run
  "reason": "Incorrect declaration data"
}
Response: {
  "cancelled_obligations": 4,
  "cancelled_invoices": 2,
  "remaining_active_obligations": 8
}

// === Re-Run Policy ===
// Eğer period için önceki run CANCELLED ise → run_mode: "full" ile yeni run
// Eğer period için önceki run COMPLETED ise → run_mode: "delta" ile sadece yeni obligations
```

### 4.8 Settlement

```
GET    /api/v1/settlements                     List settlement entries
GET    /api/v1/settlements/:id                 Get detail
GET    /api/v1/settlements/mag-status          MAG accrual per contract
       ?contract_id=...&fiscal_year=2026
Response: {
  "contract_id": "CTR-2026-001",
  "annual_mag": 1200000,
  "ytd_revenue_share": 850000,
  "ytd_mag_accrued": 1000000,
  "shortfall_ytd": 150000,
  "months_remaining": 2,
  "projected_year_end": "shortfall"
}
```

### 4.9 Billing Policy

```
POST   /api/v1/billing-policies                Create policy
GET    /api/v1/billing-policies                List (active + history)
GET    /api/v1/billing-policies/:id            Get policy
POST   /api/v1/billing-policies/:id/approve    Approve → publish
```

### 4.10 Notification

```
GET    /api/v1/notifications                   List (current user, paginated)
       ?read=false&type=alert
PUT    /api/v1/notifications/:id/read          Mark as read
PUT    /api/v1/notifications/read-all          Mark all as read
GET    /api/v1/notifications/unread-count      Badge count
```

### 4.11 Audit

```
GET    /api/v1/audit/invoice/:invoiceId        Full trace for invoice
GET    /api/v1/audit/obligation/:obligationId   Full trace for obligation
GET    /api/v1/audit/contract/:contractId       Contract history
GET    /api/v1/audit/billing-run/:runId         Billing run trace
```

### 4.12 Tenant Management

```
POST   /api/v1/tenants                         Create tenant (+ Stripe Customer sync)
GET    /api/v1/tenants                         List tenants
GET    /api/v1/tenants/:id                     Get tenant
PUT    /api/v1/tenants/:id                     Update tenant
POST   /api/v1/tenants/:id/suspend             Suspend
POST   /api/v1/tenants/:id/activate            Reactivate
```

---

## 5. COMMON API CONVENTIONS

### Pagination
```
GET /api/v1/obligations?page=1&per_page=25&sort=-created_at

Response:
{
  "data": [...],
  "meta": {
    "page": 1,
    "per_page": 25,
    "total": 142,
    "total_pages": 6
  }
}
```

### Error Format
```json
{
  "statusCode": 409,
  "error": "OBLIGATION_ALREADY_INVOICED",
  "message": "Obligation OBL-2026-03-001 has already been invoiced",
  "details": {
    "obligation_id": "OBL-2026-03-001",
    "invoice_id": "in_1Abc..."
  }
}
```

### Idempotency
```
POST requests: Idempotency-Key header supported
Stripe calls: key = "{billing_run_id}_{charge_type}_{tenant_id}"
Webhook processing: event_id deduplication
```

### Rate Limiting
```
Admin API: 100 req/min per user
Tenant API: 30 req/min per user
Webhook endpoint: 200 req/min (Stripe)
```
