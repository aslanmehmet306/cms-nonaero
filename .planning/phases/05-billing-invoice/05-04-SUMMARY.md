---
phase: 05-billing-invoice
plan: 04
subsystem: notifications
tags: [nestjs, handlebars, sse, email, mailer, event-driven, turkish-i18n]

# Dependency graph
requires:
  - phase: 05-billing-invoice/05-03
    provides: InvoicesModule, WebhookService emitting invoice.paid and invoice.payment_failed events
  - phase: 05-billing-invoice/05-01
    provides: BillingModule with BullMQ pipeline and billing.completed event
provides:
  - NotificationsModule with email + in-app notification dispatch
  - 7 Turkish email templates (cutoff-approaching, declaration-missing, invoice-created, payment-received, payment-failed, invoice-overdue, contract-expiring)
  - SSE real-time push at GET /notifications/stream with 5-min timeout
  - Polling fallback at GET /notifications/poll with since parameter
  - Event-driven notification creation from billing/invoice events
  - Severity mapping for all 9 NotificationType values
  - Notification bell API (unread-count, mark-read, mark-all-read)
  - Demo seed data (BillingRun + 3 Notification records)
affects: [admin-ui, tenant-portal]

# Tech tracking
tech-stack:
  added: ["@nestjs-modules/mailer (already installed)", "HandlebarsAdapter for .hbs template rendering"]
  patterns: ["Event-driven notification pipeline: billing events -> listener -> notify -> email+SSE", "SSE with 5-min timeout via rxjs timer+takeUntil", "Severity mapping via const Record<NotificationType, severity>", "Template mapping: NotificationType -> .hbs template name"]

key-files:
  created:
    - apps/api/src/notifications/notifications.module.ts
    - apps/api/src/notifications/notifications.service.ts
    - apps/api/src/notifications/notifications.controller.ts
    - apps/api/src/notifications/notifications.listener.ts
    - apps/api/src/notifications/email/email.service.ts
    - apps/api/src/notifications/email/templates/layouts/main.hbs
    - apps/api/src/notifications/email/templates/cutoff-approaching.hbs
    - apps/api/src/notifications/email/templates/declaration-missing.hbs
    - apps/api/src/notifications/email/templates/invoice-created.hbs
    - apps/api/src/notifications/email/templates/payment-received.hbs
    - apps/api/src/notifications/email/templates/payment-failed.hbs
    - apps/api/src/notifications/email/templates/invoice-overdue.hbs
    - apps/api/src/notifications/email/templates/contract-expiring.hbs
    - apps/api/src/notifications/sse/notification-sse.controller.ts
    - apps/api/src/notifications/notifications.service.spec.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/prisma/seed.ts

key-decisions:
  - "MailerModule.forRootAsync with Mailpit transport (localhost:1025, ignoreTLS) for local dev"
  - "SSE endpoint @Public() since EventSource cannot send Authorization headers"
  - "5-minute SSE connection timeout via rxjs timer+takeUntil to prevent leaks"
  - "TEMPLATE_MAP returns undefined for billing_run_completed and mag_shortfall (in-app only, no email template)"
  - "SUBJECT_MAP provides Turkish subject lines for all notification types"
  - "EmailService wraps MailerService for consistent error handling and logging"

patterns-established:
  - "Notification dispatch pattern: create DB record first, then dispatch channel (email/SSE), update sentAt/failedAt"
  - "Event listener pattern: @OnEvent handler queries related data, constructs notify() params"
  - "Turkish email template pattern: .hbs files with handlebars variables, shared layout via layouts/main.hbs"

requirements-completed: [R11.1, R11.2, R11.3]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 5 Plan 4: Notifications Summary

**Notification system with 7 Turkish email templates, SSE push, polling fallback, event-driven wiring from billing/invoice events, and severity mapping for notification bell**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T21:17:42Z
- **Completed:** 2026-03-05T21:23:39Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- NotificationsModule with full email + in-app dispatch pipeline
- 7 Turkish .hbs email templates for all billing lifecycle events
- SSE endpoint for real-time notification push with 5-min timeout
- Event listeners wiring invoice.paid, invoice.payment_failed, billing.completed to notifications
- Severity mapping (info/warning/error) for all 9 NotificationType values
- 12 new tests (339 total across 22 suites), build compiles cleanly
- Seed data: demo BillingRun + 3 Notification records

## Task Commits

Each task was committed atomically:

1. **Task 1: NotificationsModule with email service, 7 Turkish templates, SSE push, and event listener**
   - `f9d46a4` (test: add failing tests — RED phase)
   - `1ba3669` (feat: full implementation — GREEN phase)

2. **Task 2: Seed data for billing demo + final AppModule wiring verification** - `a91801d` (feat)

## Files Created/Modified

- `apps/api/src/notifications/notifications.module.ts` - Module with MailerModule, controllers, providers
- `apps/api/src/notifications/notifications.service.ts` - Core service: notify(), severity mapping, findAll, markAsRead
- `apps/api/src/notifications/notifications.controller.ts` - REST endpoints: list, poll, unread-count, mark-read
- `apps/api/src/notifications/notifications.listener.ts` - @OnEvent handlers for invoice.paid, payment_failed, billing.completed
- `apps/api/src/notifications/email/email.service.ts` - MailerService wrapper with template rendering
- `apps/api/src/notifications/email/templates/layouts/main.hbs` - Shared email layout (Turkish header/footer)
- `apps/api/src/notifications/email/templates/cutoff-approaching.hbs` - Declaration cutoff reminder
- `apps/api/src/notifications/email/templates/declaration-missing.hbs` - Missing declaration warning
- `apps/api/src/notifications/email/templates/invoice-created.hbs` - Invoice creation notice with payment link
- `apps/api/src/notifications/email/templates/payment-received.hbs` - Payment confirmation
- `apps/api/src/notifications/email/templates/payment-failed.hbs` - Payment failure alert with retry link
- `apps/api/src/notifications/email/templates/invoice-overdue.hbs` - Overdue notice with days count
- `apps/api/src/notifications/email/templates/contract-expiring.hbs` - Contract expiration notice
- `apps/api/src/notifications/sse/notification-sse.controller.ts` - SSE endpoint with tenant filter
- `apps/api/src/notifications/notifications.service.spec.ts` - 12 unit tests
- `apps/api/src/app.module.ts` - Added NotificationsModule import
- `apps/api/prisma/seed.ts` - Added Phase 5 demo data (BillingRun + Notifications)

## Decisions Made

- MailerModule uses Mailpit transport (localhost:1025, ignoreTLS=true) for local dev
- SSE endpoint marked @Public() since EventSource cannot send Authorization headers
- 5-minute SSE connection timeout via rxjs timer+takeUntil prevents connection leaks
- billing_run_completed and mag_shortfall have no email template (in-app only)
- Turkish SUBJECT_MAP provides default subject lines for all notification types
- EmailService wraps MailerService for consistent error handling and logging

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma JSON type for metadata field**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `Record<string, unknown>` not assignable to Prisma's `NullableJsonNullValueInput | InputJsonValue`
- **Fix:** Cast metadata as `any` for Prisma create data
- **Files modified:** apps/api/src/notifications/notifications.service.ts
- **Verification:** All 12 tests pass
- **Committed in:** 1ba3669 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed EmailService test DI mock**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** MailerService injection token not matching 'MAILER_SERVICE' string
- **Fix:** Used dynamic import to get actual MailerService class as DI token
- **Files modified:** apps/api/src/notifications/notifications.service.spec.ts
- **Verification:** EmailService test passes with correct mock injection
- **Committed in:** 1ba3669 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both were type/DI compatibility issues, expected in NestJS+Prisma. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations.

## User Setup Required

None - no external service configuration required. Mailpit is already in docker-compose from 05-01.

## Next Phase Readiness

- Phase 5 is now fully complete (4/4 plans done)
- All billing-to-notification pipeline wired: obligation -> billing run -> invoice -> payment -> notification
- 339 tests pass across 22 suites
- Build compiles cleanly with .hbs templates in dist/
- Ready for Phase 6 (Admin UI) or production deployment

---
*Phase: 05-billing-invoice*
*Completed: 2026-03-06*
