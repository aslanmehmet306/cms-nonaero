# Phase 5: Billing & Invoice - Research

**Researched:** 2026-03-05
**Domain:** Async billing orchestration, Stripe invoicing, webhooks, email notifications, SSE real-time updates
**Confidence:** HIGH

## Summary

Phase 5 is the most complex phase in the project, spanning three distinct domains: (1) async billing orchestration via BullMQ with a 10-state machine, (2) Stripe invoice generation with a provider-agnostic adapter, webhook handling, and event deduplication, and (3) notifications with 7 Turkish email templates plus in-app SSE. The existing codebase already has Redis (ioredis ^5), Stripe SDK (^17.3), EventEmitter2, and a Prisma schema with BillingRun, InvoiceLog, WebhookEventLog, and Notification models fully defined. The Prisma schema also includes all required enums (BillingRunStatus, InvoiceStatus, InvoiceProvider, NotificationType, NotificationChannel). This means no schema migration is needed -- the schema is complete from Phase 1.

The BullMQ integration uses `@nestjs/bullmq` v11, which provides `BullModule.forRoot()` / `BullModule.registerQueue()` and the `WorkerHost` + `@Processor` pattern. The existing global `RedisModule` provides an ioredis client via the `REDIS_CLIENT` token, but BullMQ requires its own connection configuration (BullMQ creates separate connections for queues and workers). The billing run orchestrator will add jobs to a `billing-run` queue, and a `BillingRunProcessor` extending `WorkerHost` will execute the 10-state pipeline.

For Stripe, the tenant model already stores `stripeCustomerId` (populated at tenant creation via the TenantsService). The 3-step invoice flow (create draft -> add line items -> finalize) maps directly to Stripe's API. Idempotency keys use the pattern `{billing_run_id}_{charge_type}_{tenant_id}` per R9.5. Webhook signature verification requires raw body access, which NestJS supports natively via `rawBody: true` in `NestFactory.create()` options. The WebhookEventLog model provides event deduplication via the `stripeEventId` unique constraint.

**Primary recommendation:** Split this phase into 4 plans across 3 waves: Wave 1 builds the BullMQ billing orchestrator + SSE progress (core async engine). Wave 2 adds Stripe invoice adapter + webhook handler (provider layer). Wave 3 adds email notification service + in-app notifications. This ordering ensures the billing run pipeline works end-to-end before connecting external services.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R8.1 | BullMQ async queue orchestrator | @nestjs/bullmq v11 with WorkerHost pattern, BullModule.forRoot with Redis connection |
| R8.2 | Tenant-level granularity (single or multi-tenant billing) | BillingRun.filters JSONB stores tenant IDs; scoping phase queries obligations per tenant |
| R8.3 | Partial cancel -- cancel specific tenants without affecting others | Per-tenant tracking in job data; cancel sets tenant obligations to cancelled, others continue |
| R8.4 | Re-run policy: cancelled -> full rerun, completed -> delta only | BillingRunMode enum (full/delta) + previousRunId chain in schema |
| R8.5 | Contract snapshot creation at run start (JSONB copy) | BillingRun.contractSnapshot JSONB column already in schema |
| R8.6 | 10 billing run states | BillingRunStatus enum fully defined in shared-types |
| R8.7 | Concurrency rule: max 1 active run per airport + period | Prisma unique constraint or findFirst check before job creation |
| R8.8 | Bull Board queue monitoring UI at /admin/queues | @bull-board/nestjs v6 + @bull-board/api + @bull-board/express, BullMQAdapter |
| R8.9 | SSE progress updates to admin UI during run | NestJS @Sse() decorator with Observable<MessageEvent>, EventEmitter2 bridge |
| R9.1 | Invoice generation from billing run results | Stripe adapter creates draft -> adds line items -> finalizes |
| R9.2 | Provider-agnostic InvoiceProvider interface | Interface with createInvoice/addLineItems/finalizeInvoice, Stripe implements, ERP stub |
| R9.3 | Stripe invoice: create -> add line items -> finalize (3-step) | stripe.invoices.create + stripe.invoiceItems.create + stripe.invoices.finalizeInvoice |
| R9.4 | Stripe customer per tenant (not per contract) | Tenant.stripeCustomerId already populated by TenantsService |
| R9.5 | Idempotency key pattern | Stripe SDK idempotencyKey option on each API call |
| R9.6 | Webhook handler with event deduplication | WebhookEventLog model with stripeEventId unique, stripe.webhooks.constructEvent for verification |
| R9.7 | Invoice grouping per charge_type per tenant per period | InvoiceLog model has chargeType + tenantId + billingRunId fields |
| R11.1 | Email notifications: 7 Turkish templates | @nestjs-modules/mailer v2 with HandlebarsAdapter, .hbs template files |
| R11.2 | In-app notifications via SSE with 30s polling fallback | Notification model + SSE endpoint + GET polling endpoint |
| R11.3 | Notification bell with severity levels | NotificationType enum maps to severity (info/warning/error) |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/bullmq | ^11.0.4 | BullMQ integration for NestJS | Official NestJS package; provides BullModule, @Processor, WorkerHost pattern; supports NestJS ^10 |
| bullmq | ^5.70.2 | Redis-based job queue engine | Industry standard for Node.js queues; rate limiting, retries, concurrency, events; replaces Bull |
| stripe | ^17.3.0 | Stripe API client (already installed) | Already in project; apiVersion '2025-02-24.acacia' set in TenantsService; auto-retry, TypeScript |
| @bull-board/nestjs | ^6.20.3 | Bull Board NestJS module | Official NestJS integration for Bull Board dashboard; provides BullBoardModule |
| @bull-board/api | ^6.20.3 | Bull Board core API | Required peer dependency for bull-board; provides BullMQAdapter |
| @bull-board/express | ^6.20.3 | Bull Board Express adapter | Required for Express-based NestJS; provides ExpressAdapter for route mounting |
| @nestjs-modules/mailer | ^2.0.2 | Email sending with templates | NestJS-native module built on nodemailer; HandlebarsAdapter for .hbs templates; peer dep >=7 works with NestJS 10 |
| nodemailer | ^8.0.1 | SMTP email transport | Underlying transport for @nestjs-modules/mailer; handles SMTP connections |
| handlebars | ^4.7.8 | Email template engine | Chosen over EJS/Pug for logic-less templates with Turkish i18n; partial support for shared layouts |

### Already Installed (No New Install Needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| ioredis | ^5.0.0 | Redis client | Already used by RedisModule; BullMQ manages its own connections but uses same Redis server |
| stripe | ^17.3.0 | Stripe SDK | Already used by TenantsService for customer creation |
| @nestjs/event-emitter | ^2.0.0 | Event bus | EventEmitter2 used for SSE bridge; already registered globally in AppModule |
| rxjs | ^7.0.0 | Reactive extensions | Used for SSE Observable<MessageEvent> pattern; already a NestJS core dependency |
| decimal.js | ^10.0.0 | Financial precision | DecimalHelper used for all amount calculations in billing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @nestjs-modules/mailer | Direct nodemailer + handlebars | More boilerplate; mailer module handles DI, template resolution, config injection cleanly |
| BullMQ | Agenda.js / pg-boss | BullMQ is Redis-based (already have Redis), Agenda needs MongoDB, pg-boss adds PG load |
| Handlebars | EJS / Pug | Handlebars is logic-less (good for i18n templates), EJS allows JS injection, Pug needs whitespace-sensitive syntax |
| @bull-board/nestjs | Custom admin UI | Bull Board is battle-tested, free, handles all queue states; building custom is waste of time |

**Installation:**

```bash
pnpm --filter api add @nestjs/bullmq bullmq @bull-board/nestjs @bull-board/api @bull-board/express @nestjs-modules/mailer nodemailer handlebars
pnpm --filter api add -D @types/nodemailer
```

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/
  billing/
    billing.module.ts              # BullModule.registerQueue, BullBoardModule.forFeature
    billing.controller.ts          # POST /billing-runs, PATCH /:id/approve|reject|cancel
    billing.service.ts             # Orchestration: create run, add job to queue
    billing-run.processor.ts       # @Processor('billing-run') extends WorkerHost
    billing-run.state-machine.ts   # 10-state transition map + validation
    dto/
      create-billing-run.dto.ts
      cancel-tenant.dto.ts
    events/
      billing-run-progress.event.ts
  invoices/
    invoices.module.ts
    invoices.controller.ts         # GET /invoices, webhook POST /webhooks/stripe
    invoices.service.ts            # Creates InvoiceLog records, delegates to provider
    providers/
      invoice-provider.interface.ts  # Abstract InvoiceProvider contract
      stripe-invoice.provider.ts     # Stripe implementation
      erp-invoice.provider.ts        # Stub for future ERP
    webhook.service.ts             # Stripe event verification + dedup + dispatch
  notifications/
    notifications.module.ts
    notifications.controller.ts    # GET /notifications, SSE endpoint, PATCH mark-read
    notifications.service.ts       # Create notification, send email, emit SSE
    email/
      email.service.ts             # MailerService wrapper with template resolution
      templates/
        cutoff-approaching.hbs
        declaration-missing.hbs
        invoice-created.hbs
        payment-received.hbs
        payment-failed.hbs
        invoice-overdue.hbs
        contract-expiring.hbs
        layouts/
          main.hbs                 # Shared email layout
    sse/
      sse.gateway.ts               # SSE endpoint with EventEmitter2 bridge
```

### Pattern 1: BullMQ Processor (WorkerHost)

**What:** Async job processing via queue with state transitions
**When to use:** Any long-running operation that should not block HTTP request
**Example:**

```typescript
// Source: @nestjs/bullmq official docs + BullMQ docs
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('billing-run', { concurrency: 1 }) // 1 job at a time for billing
export class BillingRunProcessor extends WorkerHost {
  constructor(
    private readonly billingService: BillingService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<BillingRunJobData>): Promise<BillingRunResult> {
    const { billingRunId } = job.data;

    // Phase 1: Scoping
    await this.billingService.transitionRun(billingRunId, 'scoping');
    const obligations = await this.billingService.scopeObligations(billingRunId);
    job.updateProgress(20);
    this.eventEmitter.emit('billing.progress', { billingRunId, phase: 'scoping', progress: 20 });

    // Phase 2: Calculating
    await this.billingService.transitionRun(billingRunId, 'calculating');
    await this.billingService.calculateObligations(billingRunId, obligations);
    job.updateProgress(50);

    // Phase 3: Draft ready (waits for approval)
    await this.billingService.transitionRun(billingRunId, 'draft_ready');
    // Job completes here; approval triggers separate invoicing job
    return { billingRunId, obligationCount: obligations.length };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Billing run job ${job.id} failed: ${error.message}`);
  }
}
```

### Pattern 2: Provider-Agnostic Invoice Interface

**What:** Abstract interface allowing Stripe swap with ERP or mock
**When to use:** Any external service integration that may change providers
**Example:**

```typescript
// Source: Standard adapter pattern
export interface InvoiceProvider {
  createDraftInvoice(params: CreateInvoiceParams): Promise<ExternalInvoice>;
  addLineItems(invoiceId: string, items: InvoiceLineItem[]): Promise<void>;
  finalizeInvoice(invoiceId: string): Promise<FinalizedInvoice>;
  voidInvoice(invoiceId: string): Promise<void>;
}

export interface CreateInvoiceParams {
  customerId: string;       // Stripe customer ID from tenant
  currency: string;         // TRY, EUR, USD
  dueDate: Date;
  metadata: Record<string, string>;
  idempotencyKey: string;   // {billingRunId}_{chargeType}_{tenantId}
}

export interface InvoiceLineItem {
  description: string;
  amount: number;           // In smallest currency unit (kurus for TRY)
  currency: string;
  metadata: Record<string, string>;
}

// Stripe implementation
@Injectable()
export class StripeInvoiceProvider implements InvoiceProvider {
  async createDraftInvoice(params: CreateInvoiceParams): Promise<ExternalInvoice> {
    const invoice = await this.stripe.invoices.create(
      {
        customer: params.customerId,
        currency: params.currency.toLowerCase(),
        collection_method: 'send_invoice',
        days_until_due: 30,
        metadata: params.metadata,
      },
      { idempotencyKey: params.idempotencyKey },
    );
    return { externalId: invoice.id, status: invoice.status };
  }
}
```

### Pattern 3: SSE with EventEmitter2 Bridge

**What:** Server-Sent Events fed by internal EventEmitter2 events
**When to use:** Real-time progress updates from background jobs to browser
**Example:**

```typescript
// Source: NestJS SSE docs + EventEmitter2 pattern
import { Controller, Sse, Param } from '@nestjs/common';
import { Observable, fromEvent, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('billing-runs')
export class BillingController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Sse(':id/progress')
  @Public()  // SSE endpoints typically bypass JWT (use query token instead)
  progress(@Param('id') billingRunId: string): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, 'billing.progress').pipe(
      filter((event: any) => event.billingRunId === billingRunId),
      map((event: any) => ({
        data: JSON.stringify(event),
      }) as MessageEvent),
    );
  }
}
```

### Pattern 4: Stripe Webhook with Event Deduplication

**What:** Webhook endpoint with raw body verification and idempotent event processing
**When to use:** Receiving and processing Stripe webhook events
**Example:**

```typescript
// Source: Stripe docs + NestJS rawBody pattern
// main.ts: Enable rawBody
const app = await NestFactory.create(AppModule, { rawBody: true });

// Controller
@Controller('webhooks')
export class WebhookController {
  @Post('stripe')
  @Public()  // Webhooks cannot have JWT
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const event = this.stripe.webhooks.constructEvent(
      req.rawBody,       // Buffer from NestJS rawBody option
      signature,
      this.webhookSecret,
    );

    // Deduplication: check if already processed
    const existing = await this.prisma.webhookEventLog.findUnique({
      where: { stripeEventId: event.id },
    });
    if (existing?.processed) return { received: true };

    // Upsert event log
    await this.prisma.webhookEventLog.upsert({
      where: { stripeEventId: event.id },
      create: { stripeEventId: event.id, eventType: event.type, payload: event.data },
      update: {},
    });

    // Dispatch to handler
    await this.webhookService.dispatch(event);

    // Mark processed
    await this.prisma.webhookEventLog.update({
      where: { stripeEventId: event.id },
      data: { processed: true, processedAt: new Date() },
    });

    return { received: true };
  }
}
```

### Anti-Patterns to Avoid

- **Synchronous billing in HTTP request:** Never run the billing pipeline in a controller. Always enqueue a BullMQ job and return 202 Accepted.
- **Shared Redis connection for BullMQ:** BullMQ creates its own ioredis connections (it needs separate connections for queue and worker). Do NOT pass the existing `REDIS_CLIENT` ioredis instance. Instead, pass connection config (host/port) to `BullModule.forRoot()`.
- **Parsing body before webhook verification:** If `express.json()` runs before the webhook route, signature verification fails. Use NestJS `rawBody: true` option instead of disabling bodyParser.
- **Polling for billing run status:** Use SSE for real-time progress. Polling wastes resources and adds latency.
- **Catching all webhook errors silently:** Always return 200 to Stripe for received events (even if processing fails) but log errors. Returning non-200 causes Stripe to retry exponentially.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retries | Custom Redis pub/sub queue | BullMQ via @nestjs/bullmq | Job persistence, dead letter queues, retries with backoff, concurrency control, monitoring |
| Queue dashboard | Custom admin page for job status | @bull-board/nestjs | Real-time job monitoring, retry/remove actions, queue pause/resume, job data inspection |
| Email template rendering | String concatenation or template literals | Handlebars via @nestjs-modules/mailer | Partials/layouts, XSS escaping, i18n helpers, preview capability |
| Stripe webhook verification | Manual HMAC computation | stripe.webhooks.constructEvent() | Handles signature timing attacks, multiple signatures, replay protection |
| SSE connection management | Custom event stream with keep-alive | NestJS @Sse() + rxjs Observable | Handles connection lifecycle, auto-reconnect hints, proper content-type headers |
| Idempotent API calls | Custom retry-with-dedup logic | Stripe SDK idempotencyKey option | Stripe handles dedup server-side; client just provides a stable key per logical operation |

**Key insight:** This phase integrates 3 external systems (Redis/BullMQ, Stripe, SMTP). Every one has a well-maintained NestJS integration. Hand-rolling any of these connections wastes time and introduces subtle bugs (connection pooling, retry logic, signature verification).

## Common Pitfalls

### Pitfall 1: BullMQ Connection vs ioredis Sharing

**What goes wrong:** Passing an existing ioredis client to BullMQ causes "connection in subscriber mode" errors or silent job loss.
**Why it happens:** BullMQ requires separate connections for Queue (commands) and Worker (blocking BRPOPLPUSH). An ioredis client already used for pub/sub or other blocking ops conflicts.
**How to avoid:** Configure `BullModule.forRoot()` with connection host/port config, NOT an ioredis instance. BullMQ creates its own connections internally.
**Warning signs:** Jobs added to queue but never processed; "Connection is closed" errors in worker.

```typescript
// CORRECT: Pass connection config
BullModule.forRoot({
  connection: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
  },
})

// WRONG: Pass existing ioredis instance
BullModule.forRoot({ connection: existingRedisClient }) // DO NOT DO THIS
```

### Pitfall 2: Stripe Webhook Raw Body

**What goes wrong:** `stripe.webhooks.constructEvent()` throws "No signatures found matching the expected signature."
**Why it happens:** NestJS default body parser converts the raw Buffer to a JSON object before the webhook handler runs. Stripe needs the raw bytes for HMAC verification.
**How to avoid:** Enable `rawBody: true` in `NestFactory.create()` options. Access via `req.rawBody` (Buffer). Do NOT disable bodyParser entirely (that breaks all other routes).
**Warning signs:** Webhook endpoint returns 400/500 on every Stripe request; signature verification error in logs.

```typescript
// main.ts
const app = await NestFactory.create(AppModule, { rawBody: true });
// This makes req.rawBody available on ALL requests as a Buffer
// Normal JSON parsing still works for all other endpoints
```

### Pitfall 3: Stripe Invoice Amounts in Smallest Currency Unit

**What goes wrong:** Invoice shows 100x or 0.01x the expected amount.
**Why it happens:** Stripe expects amounts in the smallest currency unit (cents for USD, kurus for TRY). If you pass 150.00 (meaning 150 TRY), Stripe interprets it as 150 kurus = 1.50 TRY.
**How to avoid:** Convert Decimal amounts to integer smallest-unit before sending to Stripe. For TRY: multiply by 100. Use `DecimalHelper.multiply(amount, 100).toNumber()` and pass as integer.
**Warning signs:** Invoices show unexpectedly small or large amounts; amounts differ between InvoiceLog and Stripe dashboard.

```typescript
// Convert TRY 150.50 to 15050 kurus
const amountInSmallestUnit = DecimalHelper.multiply(obligationAmount, 100).toNumber();
// Stripe call
await stripe.invoiceItems.create({
  customer: customerId,
  amount: Math.round(amountInSmallestUnit), // Must be integer
  currency: 'try',
});
```

### Pitfall 4: SSE Connection Leaks

**What goes wrong:** Server runs out of file descriptors; memory grows over time.
**Why it happens:** SSE connections are long-lived. Clients that disconnect (browser close, navigation) may not trigger proper cleanup. EventEmitter listeners accumulate.
**How to avoid:** Use rxjs `takeUntil` with a subject that completes on disconnect. Set reasonable timeout (5 minutes max for billing runs). Use `finalize` operator to clean up EventEmitter subscription.
**Warning signs:** Increasing memory usage over time; "too many open files" errors; EventEmitter memory leak warnings.

### Pitfall 5: Concurrent Billing Runs for Same Airport+Period

**What goes wrong:** Two billing runs process the same obligations simultaneously, creating duplicate invoices.
**Why it happens:** Race condition between check-and-create if using application-level locking.
**How to avoid:** Database-level uniqueness. Before creating a BillingRun, check for any existing run with status NOT IN ('completed', 'cancelled', 'rejected') for the same airport+period. Use a Prisma transaction with serializable isolation or a SELECT FOR UPDATE pattern.
**Warning signs:** Duplicate InvoiceLog entries; Stripe idempotency key collisions; double-charged tenants.

### Pitfall 6: Webhook Event Ordering

**What goes wrong:** `invoice.paid` arrives before `invoice.finalized`, causing "invoice not found" errors.
**Why it happens:** Stripe does not guarantee webhook event delivery order.
**How to avoid:** Design webhook handlers to be idempotent and order-independent. If an event references an invoice not yet in InvoiceLog, create a placeholder record. Use upsert pattern for all webhook updates.
**Warning signs:** Intermittent "not found" errors in webhook handler; events marked as failed that succeed on retry.

### Pitfall 7: Email Template Asset Path in Production

**What goes wrong:** Templates not found after `nest build`; "ENOENT: no such file or directory" for .hbs files.
**Why it happens:** TypeScript compilation (tsc) ignores non-.ts files. Template files (.hbs) are not copied to `dist/` directory.
**How to avoid:** Add templates to `nest-cli.json` assets array with `watchAssets: true`. Alternatively, use `path.join(__dirname, 'templates')` and configure the NestJS compiler options.
**Warning signs:** Email sending works in dev (ts-node) but fails in production build.

```json
// nest-cli.json
{
  "compilerOptions": {
    "assets": [
      { "include": "notifications/email/templates/**/*.hbs", "watchAssets": true }
    ]
  }
}
```

## Code Examples

### BullMQ Module Registration

```typescript
// Source: @nestjs/bullmq docs
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'billing-run' }),
    BullModule.registerQueue({ name: 'invoice-generation' }),
  ],
})
export class BillingModule {}
```

### Bull Board Setup

```typescript
// Source: @bull-board/nestjs docs
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

// In AppModule or a dedicated AdminModule:
BullBoardModule.forRoot({
  route: '/admin/queues',  // R8.8
  adapter: ExpressAdapter,
}),

// In BillingModule:
BullBoardModule.forFeature({
  name: 'billing-run',
  adapter: BullMQAdapter,
}),
BullBoardModule.forFeature({
  name: 'invoice-generation',
  adapter: BullMQAdapter,
}),
```

### Stripe 3-Step Invoice Flow

```typescript
// Source: Stripe API docs (invoices/create, invoiceItems/create, invoices/finalizeInvoice)
async createInvoiceForTenant(
  billingRunId: string,
  tenantId: string,
  chargeType: ChargeType,
  obligations: Obligation[],
): Promise<InvoiceLog> {
  const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const idempotencyKey = `${billingRunId}_${chargeType}_${tenantId}`;

  // Step 1: Create draft invoice
  const invoice = await this.stripe.invoices.create(
    {
      customer: tenant.stripeCustomerId,
      currency: obligations[0].currency.toLowerCase(),
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: { billingRunId, chargeType, tenantId },
    },
    { idempotencyKey: `${idempotencyKey}_create` },
  );

  // Step 2: Add line items (one per obligation)
  for (const obligation of obligations) {
    const amountKurus = DecimalHelper.multiply(obligation.amount, 100).toNumber();
    await this.stripe.invoiceItems.create(
      {
        customer: tenant.stripeCustomerId,
        invoice: invoice.id,
        amount: Math.round(amountKurus),
        currency: obligation.currency.toLowerCase(),
        description: `${obligation.chargeType} - ${obligation.periodStart.toISOString().slice(0, 7)}`,
        metadata: { obligationId: obligation.id },
      },
      { idempotencyKey: `${idempotencyKey}_item_${obligation.id}` },
    );
  }

  // Step 3: Finalize
  const finalized = await this.stripe.invoices.finalizeInvoice(invoice.id);

  // Step 4: Create InvoiceLog record
  return this.prisma.invoiceLog.create({
    data: {
      airportId: tenant.airportId,
      billingRunId,
      tenantId,
      chargeType,
      stripeInvoiceId: finalized.id,
      stripeInvoiceNumber: finalized.number,
      stripeHostedUrl: finalized.hosted_invoice_url,
      stripePdfUrl: finalized.invoice_pdf,
      status: InvoiceStatus.finalized,
      amountTotal: DecimalHelper.roundMoney(
        obligations.reduce((sum, o) => DecimalHelper.add(sum, o.amount), new Decimal(0)),
      ),
      currency: obligations[0].currency,
      dueDate: new Date(finalized.due_date * 1000),
      idempotencyKey,
    },
  });
}
```

### Email Template (Turkish)

```handlebars
{{!-- templates/invoice-created.hbs --}}
{{> header}}
<div style="padding: 20px; font-family: Arial, sans-serif;">
  <h2>Fatura Olusturuldu</h2>
  <p>Sayin {{tenantName}},</p>
  <p>
    {{periodLabel}} donemi icin <strong>{{chargeTypeLabel}}</strong>
    faturaniz olusturulmustur.
  </p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">Fatura No</td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{invoiceNumber}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">Tutar</td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{currency}} {{amount}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">Son Odeme Tarihi</td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{dueDate}}</td>
    </tr>
  </table>
  <a href="{{hostedUrl}}" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
    Faturayi Goruntule
  </a>
</div>
{{> footer}}
```

### Notification Service Pattern

```typescript
// Source: NestJS event-driven pattern
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async notify(params: {
    airportId: string;
    tenantId?: string;
    userId?: string;
    type: NotificationType;
    channel: NotificationChannel;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    emailContext?: Record<string, unknown>;
  }): Promise<void> {
    // Create in-app notification record
    const notification = await this.prisma.notification.create({
      data: {
        airportId: params.airportId,
        tenantId: params.tenantId,
        userId: params.userId,
        type: params.type,
        channel: params.channel,
        title: params.title,
        body: params.body,
        metadata: params.metadata,
      },
    });

    // SSE push for in-app channel
    if (params.channel === NotificationChannel.in_app || params.channel === NotificationChannel.both) {
      this.eventEmitter.emit('notification.created', { notification });
    }

    // Email for email channel
    if (params.channel === NotificationChannel.email || params.channel === NotificationChannel.both) {
      await this.sendEmail(params);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @nestjs/bull (Bull v3) | @nestjs/bullmq (BullMQ v5) | NestJS 10 (2023) | BullMQ is faster, has better TypeScript support, sandboxed workers, flow dependencies |
| Bull @Process() decorator per job name | WorkerHost.process() with switch statement | @nestjs/bullmq v10+ | Cannot use @Process for named jobs; must handle in single process method |
| body-parser disable + custom middleware | NestJS rawBody: true option | NestJS 10.2+ | Built-in rawBody support without disabling bodyParser; cleaner webhook handling |
| stripe.webhooks.constructEvent (sync) | stripe.webhooks.constructEventAsync (async) | stripe-node v13+ | Async version available but sync still works; both are valid |
| @nestjs-modules/mailer v1 | @nestjs-modules/mailer v2 | 2023 | Peer deps updated; still works with NestJS 10 despite npm showing 2-year publish |

**Deprecated/outdated:**
- `@Process('jobName')` decorator: Does NOT work with @nestjs/bullmq. Use switch in `process()` method.
- `@InjectQueue()` with `Queue.process()`: BullMQ separates Queue (adding jobs) from Worker (processing). The processor is a separate class.
- Disabling bodyParser for webhook raw body: Use `rawBody: true` instead. The old approach breaks all other JSON endpoints.

## 10-State Billing Run Machine

```
initiated ──> scoping ──> calculating ──> draft_ready ──> approved ──> invoicing ──> completed
                                              │                              │
                                              ├──> rejected                  └──> partial
                                              │
initiated ──────────────────────────────────> cancelled (at any non-terminal state)

Terminal states: completed, partial, rejected, cancelled
```

**Transition Rules:**

| From | To | Trigger |
|------|----|---------|
| initiated | scoping | Job starts processing |
| scoping | calculating | All obligations scoped |
| calculating | draft_ready | All calculations done |
| draft_ready | approved | Admin approves run |
| draft_ready | rejected | Admin rejects run |
| approved | invoicing | Invoicing job starts |
| invoicing | completed | All invoices created |
| invoicing | partial | Some invoices failed |
| any non-terminal | cancelled | Admin cancels run |

**Partial Cancel (R8.3):** A billing run tracks per-tenant status in `filters.tenantStatus` JSONB. Cancelling a tenant sets that tenant's status to cancelled and their obligations back to `ready`. The billing run itself remains in its current state unless ALL tenants are cancelled, in which case it transitions to `cancelled`.

**Re-run Policy (R8.4):**
- Cancelled run: Create new run with `runMode: full`, `previousRunId` pointing to cancelled run
- Completed run: Create new run with `runMode: delta`, query only obligations NOT already invoiced

## Open Questions

1. **SMTP Configuration for Demo**
   - What we know: Email templates need an SMTP transport. For demo, we can use a local SMTP service like Mailhog/Mailpit or a test SMTP provider.
   - What's unclear: Whether to include Mailpit in docker-compose for local dev.
   - Recommendation: Add Mailpit to docker-compose.yml (port 1025 SMTP, port 8025 web UI). Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` env vars. Mailpit captures all emails for local testing without needing real SMTP credentials.

2. **Bull Board Authentication**
   - What we know: Bull Board at /admin/queues should be admin-only.
   - What's unclear: Whether to use NestJS guards or Bull Board's built-in middleware option.
   - Recommendation: Use Bull Board's middleware option to add a simple auth check that verifies JWT from cookie or query parameter. This keeps it decoupled from NestJS guards which don't apply to Bull Board's Express adapter routes.

3. **SSE Auth for Billing Progress**
   - What we know: SSE endpoints are standard HTTP GET. The browser's `EventSource` API does not support custom headers (no Authorization header).
   - What's unclear: How to authenticate SSE connections.
   - Recommendation: Accept JWT as query parameter (`?token=xxx`) on the SSE endpoint. Validate token in the controller before returning the Observable. Mark the endpoint as `@Public()` to bypass global guards, and do manual token validation.

## Suggested Plan Breakdown

Based on the complexity and dependencies, Phase 5 should have **4 plans across 3 waves**:

### Wave 1: Core Billing Engine

**Plan 05-01: BullMQ Billing Orchestrator + Bull Board**
- Requirements: R8.1, R8.2, R8.5, R8.6, R8.7, R8.8
- Install @nestjs/bullmq, bullmq, @bull-board/*, Mailpit in docker-compose
- BillingModule with queue registration
- BillingRunProcessor with 10-state machine (initiated through draft_ready)
- Concurrency check (max 1 per airport+period)
- Contract snapshot at run start
- Bull Board at /admin/queues
- BillingService: create run, scope obligations, calculate
- ~15 tests

**Plan 05-02: SSE Progress + Partial Cancel + Re-run**
- Requirements: R8.3, R8.4, R8.9
- SSE endpoint for billing run progress
- EventEmitter2 bridge from processor to SSE
- Partial cancel (per-tenant cancellation)
- Re-run policy (full vs delta)
- ~10 tests

### Wave 2: Stripe Integration

**Plan 05-03: Stripe Invoice Provider + Webhooks**
- Requirements: R9.1, R9.2, R9.3, R9.4, R9.5, R9.6, R9.7
- rawBody: true in main.ts
- InvoiceProvider interface + StripeInvoiceProvider + ERPStubProvider
- InvoicesModule with create/finalize flow
- Invoice grouping per charge_type per tenant per period
- Idempotency keys per R9.5
- Webhook controller with signature verification
- Event deduplication via WebhookEventLog
- Invoice status updates (paid, failed, overdue)
- Wire invoicing phase into BillingRunProcessor (approved -> invoicing -> completed)
- ~15 tests

### Wave 3: Notifications

**Plan 05-04: Email + In-App Notifications**
- Requirements: R11.1, R11.2, R11.3
- @nestjs-modules/mailer with HandlebarsAdapter
- 7 Turkish email templates (.hbs files)
- NotificationsModule with email + in-app dispatch
- SSE endpoint for in-app notifications (notification bell)
- GET /notifications with pagination + mark-read
- Polling fallback endpoint
- Severity mapping (NotificationType -> info/warning/error)
- Wire notifications into billing events (invoice created, payment received/failed)
- Seed data for demo notifications
- AppModule registration of all new modules
- ~10 tests

**Wave Execution Order:**
- Wave 1: [05-01] -> [05-02] (sequential, 05-02 depends on billing run existing)
- Wave 2: [05-03] (depends on 05-01 billing run + 05-02 re-run)
- Wave 3: [05-04] (depends on 05-03 invoice events)

**Total estimated tests:** ~50 new tests (bringing project total to ~330)

## Sources

### Primary (HIGH confidence)
- @nestjs/bullmq npm registry: v11.0.4, peer deps NestJS ^10 || ^11, bullmq ^3-5
- BullMQ official docs: https://docs.bullmq.io/guide/nestjs
- NestJS official docs: https://docs.nestjs.com/techniques/queues
- NestJS SSE docs: https://docs.nestjs.com/techniques/server-sent-events
- Stripe API reference: https://docs.stripe.com/api/invoices/create, https://docs.stripe.com/api/invoiceitems/create
- Stripe invoicing integration: https://docs.stripe.com/invoicing/integration
- Stripe webhook signature: https://docs.stripe.com/webhooks/signature
- Stripe invoice events: https://docs.stripe.com/api/events/types
- NestJS raw body docs: https://docs.nestjs.com/faq/raw-body
- @bull-board/nestjs npm: v6.20.3
- @nestjs-modules/mailer npm: v2.0.2, peer deps NestJS >=7

### Secondary (MEDIUM confidence)
- NestJS BullMQ tutorial (DEV Community): https://dev.to/railsstudent/queuing-jobs-in-nestjs-using-nestjsbullmq-package-55c1
- Bull Board NestJS guide (NashTech): https://blog.nashtechglobal.com/mastering-bullmq-in-nestjs-bull-board-setup-and-best-practices-part-2/
- NestJS Stripe raw body blog: https://manuel-heidrich.dev/blog/how-to-access-the-raw-body-of-a-stripe-webhook-request-in-nestjs/
- Stripe Webhooks guide: https://www.magicbell.com/blog/stripe-webhooks-guide

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or npm registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm view with exact versions and peer dependency compatibility
- Architecture: HIGH - Patterns based on official NestJS docs and existing codebase conventions (module/service/controller/spec)
- Pitfalls: HIGH - Stripe webhook raw body and BullMQ connection issues are well-documented; verified against multiple sources
- State machine: HIGH - BillingRunStatus enum already exists in shared-types; transitions match R8.6 requirements
- Email: MEDIUM - @nestjs-modules/mailer v2 works with NestJS 10 but npm shows 2-year-old publish; may need fallback to direct nodemailer if issues arise

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable ecosystem, 30-day validity)
