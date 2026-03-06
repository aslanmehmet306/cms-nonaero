---
phase: 05-billing-invoice
plan: 01
subsystem: billing
tags: [bullmq, bull-board, state-machine, billing-run, nestjs, redis, queue]

# Dependency graph
requires:
  - phase: 04-obligation-declaration
    provides: "Obligations with status=ready, formula evaluation, settlement calculations"
provides:
  - "BillingModule with BullMQ async billing pipeline"
  - "10-state billing run machine with validated transitions"
  - "BillingService for run creation, scoping, snapshot, approve/reject/cancel"
  - "BillingRunProcessor (WorkerHost) for async pipeline execution"
  - "Bull Board dashboard at /admin/queues"
  - "BillingController with REST endpoints (POST 202, GET, PATCH)"
affects: [05-billing-invoice, 06-admin-ui]

# Tech tracking
tech-stack:
  added: ["@nestjs/bullmq", "bullmq", "@bull-board/nestjs", "@bull-board/api", "@bull-board/express", "@nestjs-modules/mailer", "nodemailer", "handlebars"]
  patterns: ["BullMQ processor extending WorkerHost", "State machine with validated transitions", "Contract snapshot JSONB freeze", "Concurrency enforcement via findFirst+notIn", "Progress events via EventEmitter2"]

key-files:
  created:
    - apps/api/src/billing/billing.module.ts
    - apps/api/src/billing/billing.service.ts
    - apps/api/src/billing/billing.controller.ts
    - apps/api/src/billing/billing-run.processor.ts
    - apps/api/src/billing/billing-run.state-machine.ts
    - apps/api/src/billing/billing.service.spec.ts
    - apps/api/src/billing/dto/create-billing-run.dto.ts
    - apps/api/src/billing/dto/approve-billing-run.dto.ts
    - apps/api/src/billing/events/billing-run-progress.event.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - apps/api/src/config/env.validation.ts
    - docker-compose.yml
    - apps/api/nest-cli.json

key-decisions:
  - "BullModule.forRoot uses connection config (host/port) not the existing REDIS_CLIENT ioredis instance — BullMQ creates its own connections"
  - "Bull Board route /admin/queues excluded from /api/v1 global prefix"
  - "rawBody enabled in NestFactory.create for future Stripe webhook verification"
  - "Concurrency enforcement via findFirst with status notIn terminal statuses"
  - "Contract snapshot captures full contract+services+areas as JSONB at billing time"
  - "Delta mode excludes obligations with non-null invoiceLogId"
  - "Mailpit added to docker-compose for local email testing in later plans"

patterns-established:
  - "BullMQ processor pattern: extend WorkerHost, @Processor decorator, process(job) method"
  - "State machine pattern: transitions map + validateTransition function + isTerminal check"
  - "Billing progress events: BillingRunProgressEvent with phase/progress/message"
  - "202 Accepted pattern: POST creates resource and enqueues async job"

requirements-completed: [R8.1, R8.2, R8.5, R8.6, R8.7, R8.8]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 5 Plan 1: Billing Orchestrator Summary

**BullMQ-based billing pipeline with 10-state machine, concurrency enforcement, contract snapshot, and Bull Board monitoring dashboard**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T20:49:12Z
- **Completed:** 2026-03-05T20:54:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 14

## Accomplishments
- BillingModule with BullMQ queue registration for billing-run and invoice-generation queues
- 10-state billing run machine covering all BillingRunStatus values with validated transitions
- BillingService with createBillingRun (R8.7 concurrency enforcement), scopeObligations (full/delta), createContractSnapshot (JSONB freeze), approve/reject/cancel workflows
- BillingRunProcessor extending WorkerHost for async pipeline: initiated->scoping->calculating->draft_ready
- Bull Board dashboard at /admin/queues with ExpressAdapter
- 13 new tests (294 total), TypeScript builds clean

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for billing service** - `d41ce6c` (test)
2. **Task 1 (GREEN): BillingModule with BullMQ pipeline** - `34939a0` (feat)

_TDD task: RED commit (failing tests) followed by GREEN commit (implementation)_

## Files Created/Modified
- `apps/api/src/billing/billing.module.ts` - BillingModule with BullMQ queue registration and Bull Board
- `apps/api/src/billing/billing.service.ts` - Billing orchestration: create run, scope obligations, snapshot, approve/reject/cancel
- `apps/api/src/billing/billing.controller.ts` - REST endpoints: POST 202, GET list/detail, PATCH approve/reject/cancel
- `apps/api/src/billing/billing-run.processor.ts` - BullMQ processor extending WorkerHost for async pipeline
- `apps/api/src/billing/billing-run.state-machine.ts` - 10-state transition map with validation
- `apps/api/src/billing/billing.service.spec.ts` - 13 unit tests for billing service
- `apps/api/src/billing/dto/create-billing-run.dto.ts` - DTO with validation for billing run creation
- `apps/api/src/billing/dto/approve-billing-run.dto.ts` - DTO for approval with approvedBy UUID
- `apps/api/src/billing/events/billing-run-progress.event.ts` - Progress event for SSE consumers
- `apps/api/src/app.module.ts` - Added BullModule.forRoot, BullBoardModule.forRoot, BillingModule
- `apps/api/src/main.ts` - rawBody enabled, /admin/queues excluded from global prefix
- `apps/api/src/config/env.validation.ts` - Added REDIS_HOST/PORT, SMTP_HOST/PORT/FROM, STRIPE_WEBHOOK_SECRET
- `docker-compose.yml` - Added Mailpit service for local email capture
- `apps/api/nest-cli.json` - Added compiler assets for .hbs email templates

## Decisions Made
- BullModule.forRoot uses connection config (host/port) not the existing REDIS_CLIENT ioredis instance — BullMQ manages its own Redis connections
- Bull Board route /admin/queues excluded from /api/v1 global prefix alongside health endpoints
- rawBody enabled in NestFactory.create for future Stripe webhook signature verification (plan 05-03)
- Concurrency enforcement via findFirst where status NOT IN terminal statuses (not a unique DB constraint)
- Contract snapshot captures full contract+services+areas as JSONB at billing time for audit trail
- Delta mode scope excludes obligations with non-null invoiceLogId (already invoiced)
- Mailpit added to docker-compose for local SMTP testing in notification plan (05-04)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- BillingService exported from BillingModule for use by SSE progress endpoint (05-02)
- BillingRunProgressEvent ready for SSE consumption (05-02)
- invoice-generation queue registered and on Bull Board, ready for Stripe processor (05-03)
- Mailpit in docker-compose, SMTP env vars in validation, ready for notifications (05-04)
- rawBody enabled for Stripe webhook verification (05-03)

---
*Phase: 05-billing-invoice*
*Completed: 2026-03-05*
