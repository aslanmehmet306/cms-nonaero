---
phase: 05-billing-invoice
plan: 03
subsystem: billing
tags: [stripe, invoices, webhooks, bullmq, idempotency, provider-pattern, event-deduplication]

# Dependency graph
requires:
  - phase: 05-billing-invoice/05-01
    provides: BillingModule with BullMQ pipeline, state machine, billing service
  - phase: 05-billing-invoice/05-02
    provides: SSE progress, partial cancel, re-run flows
provides:
  - InvoicesModule with Stripe invoice generation provider
  - Provider-agnostic InvoiceProvider interface with INVOICE_PROVIDER injection token
  - Stripe 3-step invoice flow (draft -> line items -> finalize) with idempotency keys
  - WebhookController and WebhookService for Stripe event processing
  - Event deduplication via WebhookEventLog
  - InvoiceGenerationProcessor (BullMQ) wired to billing approval
  - InvoicesController with read-only GET endpoints
affects: [05-billing-invoice/05-04, admin-ui]

# Tech tracking
tech-stack:
  added: [stripe-sdk, invoice-provider-pattern]
  patterns: [provider-agnostic adapter via injection token, idempotency key pattern per R9.5, webhook raw body signature verification, event deduplication via unique stripeEventId]

key-files:
  created:
    - apps/api/src/invoices/invoices.module.ts
    - apps/api/src/invoices/invoices.controller.ts
    - apps/api/src/invoices/invoices.service.ts
    - apps/api/src/invoices/invoices.service.spec.ts
    - apps/api/src/invoices/providers/invoice-provider.interface.ts
    - apps/api/src/invoices/providers/stripe-invoice.provider.ts
    - apps/api/src/invoices/providers/stripe-invoice.provider.spec.ts
    - apps/api/src/invoices/providers/erp-invoice.provider.ts
    - apps/api/src/invoices/webhook.controller.ts
    - apps/api/src/invoices/webhook.service.ts
    - apps/api/src/invoices/webhook.service.spec.ts
    - apps/api/src/invoices/invoice-generation.processor.ts
  modified:
    - apps/api/src/billing/billing.service.ts
    - apps/api/src/billing/billing.service.spec.ts
    - apps/api/src/app.module.ts

key-decisions:
  - "InvoiceProvider interface uses INVOICE_PROVIDER injection token for swappable Stripe/ERP/mock providers"
  - "Idempotency keys follow pattern {billingRunId}_{chargeType}_{tenantId} with _create/_item_N suffixes for Stripe API calls"
  - "Amounts converted to smallest currency unit via DecimalHelper.multiply(amount, 100).toNumber() then Math.round()"
  - "Webhook endpoint @Public with raw body signature verification — Stripe cannot send JWT tokens"
  - "Event deduplication via WebhookEventLog.stripeEventId unique constraint; processed flag prevents reprocessing"
  - "Out-of-order webhook events handled gracefully — missing InvoiceLog logged and skipped, not thrown"
  - "BillingService.approveBillingRun enqueues invoice-generation job after status transition"

patterns-established:
  - "Provider adapter pattern: interface + injection token + module-level useClass binding"
  - "Webhook deduplication: upsert on receive -> dispatch -> mark processed; idempotent by stripeEventId"
  - "Stripe 3-step invoice flow: createDraft -> addLineItems -> finalize; each call has own idempotency key suffix"
  - "Obligation grouping: chargeType_tenantId composite key for invoice aggregation"

requirements-completed: [R9.1, R9.2, R9.3, R9.4, R9.5, R9.6, R9.7]

# Metrics
duration: 7min
completed: 2026-03-06
---

# Phase 5 Plan 3: Stripe Invoice Generation Summary

**Provider-agnostic Stripe invoice generation with 3-step flow, idempotency keys, webhook event deduplication, and BullMQ-wired billing approval pipeline**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T21:06:18Z
- **Completed:** 2026-03-05T21:13:30Z
- **Tasks:** 2 (both TDD: RED + GREEN)
- **Files modified:** 15

## Accomplishments
- InvoicesModule with Stripe implementation of provider-agnostic InvoiceProvider interface and ERP stub
- Stripe 3-step invoice flow (create draft, add line items, finalize) with per-call idempotency keys following R9.5 pattern
- Webhook handler at POST /webhooks/stripe with raw body signature verification, event deduplication via WebhookEventLog, and status dispatch for paid/past_due/voided/finalized/sent events
- Invoice generation processor wired to billing approval flow via BullMQ queue
- 22 new tests across 3 test suites (10 InvoicesService + 5 StripeInvoiceProvider + 7 WebhookService)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for invoice service and stripe provider** - `34427b7` (test)
2. **Task 1 (GREEN): InvoicesModule with Stripe provider, invoice generation, webhook handler** - `fe8a2c6` (feat)
3. **Task 2: Webhook service tests for event deduplication and status dispatch** - `4d94926` (test)

_TDD tasks: RED commit (failing tests) followed by GREEN commit (implementation + webhook tests)_

## Files Created/Modified
- `apps/api/src/invoices/invoices.module.ts` - InvoicesModule with INVOICE_PROVIDER token binding to StripeInvoiceProvider
- `apps/api/src/invoices/invoices.controller.ts` - GET list/detail endpoints for InvoiceLogs with role-based access
- `apps/api/src/invoices/invoices.service.ts` - Invoice generation: group obligations by chargeType+tenantId, call provider, create InvoiceLog
- `apps/api/src/invoices/invoices.service.spec.ts` - 10 tests: grouping, idempotency, amount conversion, status updates, partial failure
- `apps/api/src/invoices/providers/invoice-provider.interface.ts` - INVOICE_PROVIDER token + InvoiceProvider interface + CreateInvoiceParams/InvoiceLineItem/ExternalInvoice types
- `apps/api/src/invoices/providers/stripe-invoice.provider.ts` - Stripe SDK implementation: createDraftInvoice, addLineItems, finalizeInvoice, voidInvoice
- `apps/api/src/invoices/providers/stripe-invoice.provider.spec.ts` - 5 tests: Stripe API calls, idempotency keys, currency lowercase
- `apps/api/src/invoices/providers/erp-invoice.provider.ts` - ERP stub throwing NotImplementedException (future integration point)
- `apps/api/src/invoices/webhook.controller.ts` - POST /webhooks/stripe with @Public, raw body signature verification, always returns 200
- `apps/api/src/invoices/webhook.service.ts` - Webhook event verification, deduplication via WebhookEventLog, status dispatch
- `apps/api/src/invoices/webhook.service.spec.ts` - 7 tests: status updates, deduplication, graceful unknown invoice handling
- `apps/api/src/invoices/invoice-generation.processor.ts` - BullMQ processor: invoicing -> completed/partial with progress events
- `apps/api/src/billing/billing.service.ts` - Added invoice-generation queue injection, enqueue after approval
- `apps/api/src/billing/billing.service.spec.ts` - Added invoice-generation queue mock to fix regression
- `apps/api/src/app.module.ts` - Registered InvoicesModule

## Decisions Made
- InvoiceProvider interface uses INVOICE_PROVIDER injection token for swappable implementations (Stripe active, ERP stub, mock possible)
- Idempotency keys follow R9.5 pattern: `{billingRunId}_{chargeType}_{tenantId}` with `_create` and `_item_N` suffixes for Stripe API calls
- Amounts converted from Decimal (TRY) to smallest currency unit (kurus) via `DecimalHelper.multiply(amount, 100).toNumber()` then `Math.round()` for integer constraint
- Webhook endpoint marked @Public since Stripe cannot send JWT tokens; raw body signature verification provides authentication
- Event deduplication via WebhookEventLog.stripeEventId unique constraint; `processed` boolean flag prevents reprocessing
- Out-of-order webhook events handled gracefully: missing InvoiceLog is logged and skipped (not thrown), supporting eventual consistency
- BillingService.approveBillingRun now enqueues invoice-generation job with exponential backoff (3 attempts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed billing.service.spec.ts missing invoice-generation queue mock**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Adding @InjectQueue('invoice-generation') to BillingService broke existing billing tests (21 tests failed — DI could not resolve the queue token)
- **Fix:** Added `{ provide: getQueueToken('invoice-generation'), useValue: invoiceQueue }` to billing.service.spec.ts
- **Files modified:** apps/api/src/billing/billing.service.spec.ts
- **Verification:** All 21 billing tests pass again
- **Committed in:** fe8a2c6 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** Necessary fix for regression caused by adding invoice queue injection to BillingService. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Stripe keys are already validated via env.validation.ts (added in 05-01).

## Next Phase Readiness
- InvoicesService exported from InvoicesModule for downstream use
- EventEmitter2 emits invoice.paid and invoice.payment_failed events for notification listeners (05-04)
- WebhookController ready for Stripe webhook configuration
- Invoice generation pipeline complete: approval -> queue -> generate -> complete/partial
- All 22 invoice/webhook tests pass, build compiles cleanly

## Self-Check: PASSED

- All 12 created files verified on disk
- Commit 34427b7 (Task 1 RED) verified in git log
- Commit fe8a2c6 (Task 1 GREEN) verified in git log
- Commit 4d94926 (Task 2) verified in git log
- Build compiles cleanly
- 22 invoice/webhook/stripe tests pass

---
*Phase: 05-billing-invoice*
*Completed: 2026-03-06*
