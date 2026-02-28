# Technology Stack

**Project:** Airport Non-Aeronautical Revenue Management Platform
**Researched:** 2026-02-28
**Overall Confidence:** MEDIUM (training data as of Jan 2025, needs version verification with npm/official docs)

## Executive Summary

The proposed stack (NestJS + React 18 + PostgreSQL + Prisma + BullMQ + Stripe) is **VALIDATED** for building a billing/invoicing SaaS with multi-currency support and async billing runs. This is a production-proven combination for financial platforms requiring deterministic calculations, audit trails, and async job processing.

**Critical additions identified:**
- **Decimal.js** (not dinero.js) for currency-agnostic financial calculations
- **@bull-board/nestjs** for queue monitoring UI
- **Puppeteer** for PDF generation (battle-tested for invoices)
- **ExcelJS** for Excel report generation
- **class-validator + class-transformer** for request validation (NestJS standard)

**Key validation:** Multi-currency billing with formula-based pricing is best handled by separating concerns: Decimal.js for precision arithmetic, math.js for formula evaluation, Prisma for ACID transactions.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **NestJS** | 10.x | Backend API framework | VALIDATED. Enterprise-grade Node.js framework with built-in dependency injection, module architecture, decorator-based routing. Excellent for domain-driven design patterns needed for billing systems. Native support for BullMQ, Prisma, validation. |
| **React** | 18.x | Frontend UI framework | VALIDATED. Concurrent rendering features improve UX for real-time billing status updates (via SSE). Server Components not needed for admin portal. |
| **TypeScript** | 5.x | Type system | REQUIRED. Financial calculations demand compile-time type safety. Shared types between monorepo packages eliminate API contract drift. |
| **Turborepo** | 2.x | Monorepo build system | VALIDATED for NestJS + React. Fast incremental builds, shared ESLint/TypeScript configs, task orchestration. Better than Nx for this stack size (2-3 packages). |

**Confidence:** HIGH (standard enterprise stack, widely documented)

---

### Database & ORM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 15.x or 16.x | Primary database | VALIDATED. ACID compliance critical for billing (obligation generation must be atomic). JSONB for formula snapshots, excellent Prisma support, native DECIMAL type for monetary values. |
| **Prisma** | 5.x | ORM & migrations | VALIDATED. Type-safe query builder prevents runtime errors in financial calculations. Schema-first migrations enable audit trail (obligation → formula → contract). Transaction support for billing run atomicity. Native Decimal type mapping. |
| **Redis** | 7.x | Cache & queue store | VALIDATED. BullMQ backend, session store, pub/sub for SSE notifications. Minimal cache usage (billing must be deterministic, not cached). |

**PostgreSQL vs Alternatives:**
- MySQL: Lacks robust JSONB, weaker transaction isolation
- MongoDB: No ACID across collections, unsuitable for financial data
- CockroachDB: Overkill for single-airport v1, adds operational complexity

**Prisma vs Alternatives:**
- TypeORM: Weaker type safety, decorator-heavy (verbose for complex queries)
- Drizzle: Newer, smaller ecosystem, less NestJS integration
- Knex: No type safety, raw SQL error-prone for financial calculations

**Confidence:** HIGH (standard combination for financial SaaS)

---

### Queue & Background Jobs

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **BullMQ** | 5.x | Async job queue | VALIDATED. Redis-backed, supports job priority, retry with exponential backoff, delayed jobs (for scheduled billing runs). Better than Bull (deprecated) or Agenda (MongoDB-dependent). |
| **@nestjs/bullmq** | 10.x | NestJS integration | Official NestJS wrapper for BullMQ. Decorator-based processors, dependency injection for queue services. |
| **@bull-board/nestjs** | 5.x | Queue monitoring UI | CRITICAL ADDITION. Web UI for monitoring billing run jobs (status, retries, failures). Essential for debugging async billing orchestration. |

**Why not alternatives:**
- **Agenda:** MongoDB-only, no priority queues
- **node-cron:** In-process, no retries, no distributed locks
- **AWS SQS/Azure Queue:** Vendor lock-in, overkill for v1 Docker setup

**Confidence:** HIGH (BullMQ is standard for NestJS background jobs)

---

### Financial Calculations

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Decimal.js** | 10.x | Arbitrary precision decimals | CRITICAL. JavaScript's `Number` type is IEEE 754 float (unsafe for money: 0.1 + 0.2 ≠ 0.3). Decimal.js provides exact decimal arithmetic for multi-currency calculations. Currency-agnostic (works with TRY, EUR, USD). Immutable values prevent mutation bugs. |
| **math.js** | 12.x | Formula engine | VALIDATED with caveats. Supports sandbox mode to prevent code injection (whitelist allowed functions). Parse expressions like `baseRent * (1 + indexRate/100)`. **Security critical:** Must configure sandbox with limited function whitelist (no filesystem, no process access). |

**Why Decimal.js (not dinero.js or currency.js):**
- **dinero.js v1:** Deprecated, abandoned
- **dinero.js v2:** Requires custom currency definitions, overkill for simple decimal math
- **currency.js:** Less precision control, fixed decimal places
- **big.js:** Similar to Decimal.js but smaller API, less ecosystem

**math.js Security:**
```typescript
import { create, all } from 'mathjs';

const math = create(all);
const limitedEvaluate = math.evaluate;

// Whitelist: basic arithmetic, no functions
math.import({
  import: function () { throw new Error('Function "import" is disabled'); },
  createUnit: function () { throw new Error('Function "createUnit" is disabled'); },
  // ... disable filesystem, network access
}, { override: true });
```

**Alternative:** Write custom expression parser (safer but slower to market).

**Confidence:** HIGH (Decimal.js standard), MEDIUM (math.js security needs custom configuration)

---

### Payment Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Stripe SDK** | Latest (stripe npm package) | Invoice generation | VALIDATED. Stripe Invoicing API handles multi-currency, PDF generation, payment links. Adapter pattern isolates provider (future: SAP/ERP integration). |
| **@stripe/stripe-js** | Latest | Frontend SDK (future) | For tenant portal (v2). Not needed for admin-only v1. |

**Provider Abstraction Pattern:**
```typescript
// Invoice provider interface
interface InvoiceProvider {
  createInvoice(data: InvoiceData): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice>;
}

// Stripe adapter
class StripeInvoiceProvider implements InvoiceProvider { ... }

// Future: SAP adapter, ERP adapter
```

**Why Stripe:**
- Multi-currency out of box (TRY, EUR, USD supported)
- Automatic PDF invoice generation
- Webhook notifications for payment status
- No PCI compliance burden (hosted payment pages)

**Confidence:** HIGH (Stripe is industry standard for SaaS billing)

---

### Report Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Puppeteer** | 21.x | PDF generation | RECOMMENDED. Headless Chrome for rendering HTML → PDF. Airport invoices often need custom branding, complex layouts (tables, formulas). HTML templates easier to maintain than low-level PDF libraries. |
| **ExcelJS** | 4.x | Excel generation | RECOMMENDED. Read/write .xlsx files for revenue declaration uploads and billing run exports. Supports formulas, styling, multi-sheet workbooks. |

**PDF Alternatives Considered:**
- **PDFKit:** Low-level API, verbose for complex layouts
- **jsPDF:** Client-side focus, less server rendering
- **wkhtmltopdf:** External binary dependency, harder to containerize
- **Puppeteer:** HTML/CSS for layouts (faster development), supports Turkish characters, production-proven

**Excel Alternatives Considered:**
- **xlsx (SheetJS):** Community edition has licensing issues, ExcelJS is MIT
- **node-xlsx:** Read-only focus, less feature-complete

**Confidence:** MEDIUM (Puppeteer standard but resource-heavy), HIGH (ExcelJS standard)

---

### Validation & Serialization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **class-validator** | 0.14.x | DTO validation | NestJS standard. Decorator-based validation for API requests (`@IsNumber()`, `@IsEnum()`, `@IsISO8601()`). Prevents invalid billing run parameters. |
| **class-transformer** | 0.5.x | Object mapping | NestJS standard. Transform plain objects to class instances (for validation), exclude sensitive fields in responses. |

**Why not alternatives:**
- **Zod/Yup:** Functional validation, less idiomatic in NestJS (decorator-based ecosystem)
- **Joi:** Runtime schema, class-validator integrates with TypeScript types

**Confidence:** HIGH (NestJS ecosystem standard)

---

### Authentication & Authorization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@nestjs/passport** | 10.x | Auth framework | NestJS standard wrapper for Passport.js strategies. |
| **passport-jwt** | 4.x | JWT strategy | Stateless auth for admin portal. Roles stored in JWT payload (7 roles: Admin, Finance Manager, etc.). |
| **bcrypt** | 5.x | Password hashing | Industry standard for hashing passwords (work factor 10-12 for balance). |
| **@nestjs/jwt** | 10.x | JWT signing | Sign/verify tokens, refresh token rotation. |

**Why JWT (not sessions):**
- Stateless (no Redis session lookup on every request)
- Multi-instance ready (no sticky sessions needed)
- Mobile app compatible (future v2)

**Confidence:** HIGH (NestJS auth standard)

---

### Real-Time Notifications

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Server-Sent Events (SSE)** | Native | Billing status updates | VALIDATED for this use case. One-way server → client push (billing run progress, invoice created). Simpler than WebSocket (no bidirectional overhead). Auto-reconnect in browsers. Works over HTTP (no WS port). |
| **@nestjs/event-emitter** | 2.x | Internal event bus | Decouple billing domain events (`ObligationGenerated`, `InvoiceCreated`) from notification delivery. |

**SSE Implementation:**
```typescript
@Sse('notifications')
notificationStream(@Req() req: Request): Observable<MessageEvent> {
  return this.notificationService.getStreamForUser(req.user.id);
}
```

**Why not WebSocket:**
- Overkill for one-way notifications
- Requires separate WS server or socket.io overhead
- Harder to load balance (sticky sessions)

**Why not polling:**
- Network inefficient (billing runs can take minutes)
- Delayed updates (poor UX)

**Confidence:** HIGH (SSE is optimal for this pattern)

---

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Jest** | 29.x | Unit & integration tests | NestJS default. Excellent mocking for Prisma, BullMQ, Stripe SDK. |
| **Supertest** | 6.x | E2E API tests | Test billing API flows (contract publish → obligation generation). |
| **@faker-js/faker** | 8.x | Test data generation | Generate realistic tenant names, amounts, dates for billing tests. |

**Critical Tests for Billing:**
- Obligation calculation reproducibility (same input → same output)
- MAG settlement edge cases (mid-month contract start, prorated periods)
- Formula engine security (malicious expression rejection)
- Decimal precision (0.1 + 0.2 = 0.3, not 0.30000000000000004)

**Confidence:** HIGH (standard NestJS testing stack)

---

### Developer Experience

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **ESLint** | 8.x | Linting | Catch errors, enforce code style across monorepo. |
| **Prettier** | 3.x | Code formatting | Auto-format on save, eliminate style debates. |
| **Husky** | 8.x | Git hooks | Pre-commit linting, pre-push tests. |
| **Docker Compose** | Latest | Local environment | PostgreSQL + Redis + API all containerized. Consistent dev/staging/prod. |

**Confidence:** HIGH (standard tooling)

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **date-fns** | 3.x | Date manipulation | Billing period calculations (start/end dates), proration. Prefer over Moment.js (heavier, mutable). |
| **csv-parse** | 5.x | CSV parsing | Revenue declaration upload (CSV → validation → database). |
| **uuid** | 9.x | Unique IDs | Generate `line_hash` for billing obligation duplicate detection. |
| **helmet** | 7.x | HTTP security headers | Protect admin portal (XSS, clickjacking). |
| **@nestjs/throttler** | 5.x | Rate limiting | Prevent abuse of billing run API (expensive operations). |
| **class-variance-authority (cva)** | Latest | Component variants (React) | Shadcn/ui dependency for button/input styling. |
| **tailwindcss** | 3.x | CSS utility framework | Shadcn/ui requirement. Faster UI development than custom CSS. |
| **zod** | 3.x | Schema validation (frontend) | React form validation (separate from backend class-validator). |
| **react-hook-form** | 7.x | Form state management | Tenant/contract forms (better than uncontrolled inputs for complex validation). |
| **tanstack/react-query** | 5.x | Server state management | Billing run status polling, cache management. Better than useState + fetch. |
| **recharts** | 2.x | Charts | Revenue dashboard visualizations (monthly revenue, MAG vs actual). |

**Confidence:** HIGH (all standard libraries in ecosystem)

---

## Anti-Recommendations

### Do NOT Use

| Technology | Why NOT | What to Use Instead |
|------------|---------|-------------------|
| **Moment.js** | Deprecated, mutable API, heavy (causes date bugs) | date-fns (immutable, tree-shakeable) |
| **dinero.js v1** | Abandoned since 2019 | Decimal.js |
| **TypeORM** | Weak type safety compared to Prisma, more runtime errors | Prisma |
| **Bull (not BullMQ)** | Deprecated, no longer maintained | BullMQ |
| **node-cron** | In-process only, no distributed locks (fails in multi-instance) | BullMQ delayed jobs |
| **Socket.io** | Overkill for one-way notifications, complex setup | SSE (Server-Sent Events) |
| **Express.js raw** | No structure (causes spaghetti code in financial apps) | NestJS (opinionated architecture) |
| **MongoDB** | No ACID across collections (unsafe for billing) | PostgreSQL + Prisma |
| **GraphQL** | Over-engineering for admin portal, REST simpler | REST API |
| **tRPC** | TypeScript-only clients (limits future mobile app options) | REST API |
| **Currency.js** | Fixed decimal places, less precision control | Decimal.js |
| **Big.js** | Smaller API, less ecosystem than Decimal.js | Decimal.js |
| **PDFKit** | Too low-level for invoice layouts | Puppeteer (HTML → PDF) |

---

## Installation

### Backend (NestJS API)

```bash
# Core framework
npm install @nestjs/common@10 @nestjs/core@10 @nestjs/platform-express@10
npm install @nestjs/config@3 @nestjs/mapped-types@2
npm install reflect-metadata@0.2 rxjs@7

# Database
npm install @prisma/client@5
npm install -D prisma@5

# Queue
npm install @nestjs/bullmq@10 bullmq@5
npm install @bull-board/api@5 @bull-board/nestjs@5 @bull-board/express@5

# Financial calculations
npm install decimal.js@10 mathjs@12

# Validation
npm install class-validator@0.14 class-transformer@0.5

# Auth
npm install @nestjs/passport@10 @nestjs/jwt@10
npm install passport@0.7 passport-jwt@4 bcrypt@5
npm install -D @types/passport-jwt @types/bcrypt

# Events & notifications
npm install @nestjs/event-emitter@2

# Utilities
npm install date-fns@3 uuid@9 csv-parse@5

# Security
npm install helmet@7 @nestjs/throttler@5

# External services
npm install stripe@14

# Report generation
npm install puppeteer@21 exceljs@4

# Development
npm install -D @types/node@20 typescript@5 ts-node@10
npm install -D eslint@8 @typescript-eslint/parser@6 @typescript-eslint/eslint-plugin@6
npm install -D prettier@3
npm install -D jest@29 @nestjs/testing@10 supertest@6 @types/supertest
npm install -D @faker-js/faker@8
```

### Frontend (React)

```bash
# Core framework
npm install react@18 react-dom@18
npm install -D @types/react@18 @types/react-dom@18

# Build tool
npm install vite@5
npm install -D @vitejs/plugin-react@4

# Routing
npm install react-router-dom@6

# Forms & validation
npm install react-hook-form@7 zod@3 @hookform/resolvers@3

# Server state
npm install @tanstack/react-query@5

# UI components (Shadcn/ui setup)
npm install tailwindcss@3 postcss@8 autoprefixer@10
npm install class-variance-authority@0.7 clsx@2 tailwind-merge@2
npm install lucide-react@0.263
# Note: Shadcn components added via CLI (npx shadcn-ui@latest add)

# Charts
npm install recharts@2

# Development
npm install -D typescript@5 eslint@8 prettier@3
```

### Monorepo (Turborepo)

```bash
# Root package.json
npm install -D turbo@2
```

### Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: airport_revenue
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://dev:devpass@postgres:5432/airport_revenue
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

---

## Version Verification Needed

**CRITICAL:** The following versions are based on training data (Jan 2025). Verify with npm/official docs before installation:

| Package | Stated Version | Verification Method |
|---------|---------------|---------------------|
| @nestjs/common | 10.x | npm view @nestjs/common version |
| Prisma | 5.x | npm view prisma version |
| BullMQ | 5.x | npm view bullmq version |
| Decimal.js | 10.x | npm view decimal.js version |
| math.js | 12.x | npm view mathjs version |
| Puppeteer | 21.x | npm view puppeteer version |
| ExcelJS | 4.x | npm view exceljs version |
| React | 18.x | npm view react version |
| Stripe SDK | 14.x | npm view stripe version |

**Command to verify all at once:**
```bash
npm view @nestjs/common version
npm view prisma version
npm view bullmq version
npm view decimal.js version
npm view mathjs version
npm view puppeteer version
npm view exceljs version
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Core stack (NestJS + React + PostgreSQL) | HIGH | Industry standard for enterprise SaaS |
| Prisma ORM | HIGH | Widely adopted, excellent TypeScript support |
| BullMQ for async jobs | HIGH | Standard choice for NestJS background processing |
| Decimal.js for financial math | HIGH | Proven for multi-currency calculations |
| math.js security configuration | MEDIUM | Requires custom sandbox setup (not default) |
| Puppeteer for PDF | MEDIUM | Resource-heavy, may need optimization for scale |
| SSE for notifications | HIGH | Perfect fit for this use case |
| Stripe integration | HIGH | Standard for SaaS billing |
| Specific version numbers | LOW | Need verification with npm (training data is Jan 2025) |

---

## Stack Validation Summary

**VALIDATED DECISIONS:**
1. ✅ **NestJS** - Excellent for billing SaaS (DI, modularity, TypeScript-first)
2. ✅ **React 18** - Concurrent features improve billing status UX
3. ✅ **PostgreSQL** - ACID compliance essential for financial transactions
4. ✅ **Prisma** - Type safety prevents financial calculation bugs
5. ✅ **BullMQ** - Async billing runs with retries and monitoring
6. ✅ **Stripe** - Multi-currency invoice generation out of box

**CRITICAL ADDITIONS:**
1. ✅ **Decimal.js** - Required for safe financial calculations (not in original stack)
2. ✅ **math.js** - Formula engine (mentioned in PROJECT.md, now validated)
3. ✅ **Puppeteer** - PDF invoice generation (not specified, now recommended)
4. ✅ **ExcelJS** - Revenue declaration/billing exports (not specified, now recommended)
5. ✅ **@bull-board/nestjs** - Queue monitoring UI (critical for debugging)

**WARNINGS:**
- **math.js security:** Must configure sandbox with function whitelist (not secure by default)
- **Puppeteer resource usage:** Headless Chrome is memory-intensive (consider worker pool)
- **Decimal.js learning curve:** Team must understand immutable API (no `+=` on Decimal objects)
- **SSE limitations:** Client must handle reconnection logic (use EventSource API properly)

---

## Next Steps for Implementation

1. **Initialize Turborepo:** `npx create-turbo@latest` with NestJS + React templates
2. **Setup Prisma:** Initialize schema with `Currency`, `Tenant`, `Contract`, `Obligation` models
3. **Configure Decimal.js:** Create utility wrapper for common operations (add, multiply, round)
4. **Sandbox math.js:** Write whitelist config + security tests (test malicious expression rejection)
5. **Setup BullMQ + Bull Board:** Create billing queue + monitoring endpoint
6. **Stripe integration:** Implement invoice provider interface + Stripe adapter
7. **Test financial calculations:** Unit tests for decimal precision + MAG settlement edge cases

---

## Sources

**Confidence Caveat:** This research is based on training data (knowledge cutoff: January 2025). All package versions and feature availability should be verified with:
- npm registry: `npm view <package> version`
- Official documentation: NestJS docs, Prisma docs, BullMQ docs, Stripe API reference
- GitHub repositories: Check latest releases and security advisories

**No external sources accessed** due to tool limitations (WebSearch, WebFetch, Context7 unavailable during research). All recommendations are based on:
1. Training data knowledge of these technologies
2. Standard patterns for billing/invoicing SaaS platforms
3. PostgreSQL + NestJS + BullMQ architecture patterns

**Recommended validation:** Before implementation, verify current versions and check for:
- Breaking changes in major versions
- Security advisories (especially for math.js, Puppeteer)
- NestJS compatibility matrix (ensure all @nestjs/* packages are same major version)
- Prisma migration strategies (financial data migrations require extra care)

---

*Research completed: 2026-02-28*
*Researcher: GSD Project Researcher (Stack Dimension)*
*Next: Features landscape research (FEATURES.md)*
