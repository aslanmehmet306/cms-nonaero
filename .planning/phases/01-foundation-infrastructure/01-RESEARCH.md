# Phase 1: Foundation & Infrastructure - Research

**Researched:** 2026-03-01
**Domain:** Backend infrastructure, monorepo architecture, authentication, financial precision
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational technical infrastructure for an airport non-aeronautical revenue management platform. This phase delivers a Docker-based development environment with a Turborepo monorepo containing NestJS API, React Admin, shared types, PostgreSQL 15, Redis 7, JWT authentication with 7 roles, RBAC guards, Decimal.js financial precision patterns, audit trail logging, health endpoints, and Swagger documentation.

The core technical challenge is establishing deterministic financial calculation patterns from day one. Using JavaScript's native number type creates precision errors (0.1 + 0.2 = 0.30000000000000004) that compound across thousands of invoices. This phase enforces Decimal.js for ALL monetary values and PostgreSQL NUMERIC(19,4) columns, preventing precision loss before any billing logic is built. The second critical challenge is multi-tenant data isolation using Prisma middleware with tenant context, ensuring airport/tenant data never leaks between requests.

This is a **modular monolith** (not microservices) with clean domain boundaries. Turborepo manages the monorepo with shared TypeScript types between backend and frontend. Docker Compose orchestrates PostgreSQL + Redis + API for one-command local development. NestJS provides enterprise-grade dependency injection, module architecture, and decorator-based routing. Prisma delivers type-safe queries that prevent runtime errors in financial calculations. JWT authentication implements stateless auth with role-based access control supporting 7 roles with separation of duties enforcement.

**Primary recommendation:** Establish Decimal.js usage patterns in Phase 1 before any calculation code. Create a utility wrapper (DecimalHelper) for common operations (add, multiply, round) that all services import. Use Prisma's Decimal type in schema. Enforce via ESLint rule banning native number arithmetic on monetary values. This prevents the most common cause of billing discrepancies in financial SaaS platforms.

<phase_requirements>

## Phase Requirements

| ID   | Description                                                                                                 | Research Support                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| R1.1 | Turborepo monorepo with NestJS API, React Admin, React Portal (stub), shared-types, formula-engine packages | Turborepo TypeScript guide, shared types patterns, pnpm workspaces                  |
| R1.2 | Docker Compose: PostgreSQL 15 + Redis 7 + API — docker compose up runs everything                           | Docker Compose development workflow, healthcheck patterns, service dependencies     |
| R1.3 | Prisma schema with 20+ models, all enums, indexes, relations — migration applied                            | Prisma schema design patterns, multi-file schemas, relationship modeling            |
| R1.4 | JWT auth with 7 roles                                                                                       | NestJS Passport JWT, role-based access control patterns, token lifecycle management |
| R1.5 | RBAC guards with separation of duties                                                                       | Custom guards, metadata decorators, separation of duties implementation             |
| R1.6 | Global Decimal.js pattern for all financial calculations                                                    | Decimal.js best practices, Prisma Decimal type, financial precision patterns        |
| R1.7 | Audit trail module logging all entity state changes                                                         | TypeORM subscribers, audit entity schema, JSONB metadata storage                    |
| R1.8 | Health endpoints (liveness + readiness) with DB/Redis checks                                                | NestJS Terminus library, health indicators, Kubernetes probe patterns               |
| R1.9 | Swagger/OpenAPI documentation for all endpoints                                                             | NestJS Swagger module, decorator-based documentation, API versioning                |

</phase_requirements>

## Standard Stack

### Core

| Library               | Version      | Purpose               | Why Standard                                                                                                                             |
| --------------------- | ------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Turborepo**         | 2.x          | Monorepo build system | Fast incremental builds, shared configs, task orchestration. Better than Nx for 3-5 package monorepos. Remote caching optional.          |
| **pnpm**              | 9.x          | Package manager       | Efficient disk usage (content-addressed storage), fast installs, strict dependency resolution. Turborepo recommends over npm/yarn.       |
| **NestJS**            | 10.x         | Backend API framework | Enterprise-grade DI, module architecture, decorator routing. TypeScript-first. Excellent for domain-driven billing systems.              |
| **Prisma**            | 5.x or 6.x   | ORM & migrations      | Type-safe queries prevent runtime errors. Schema-first migrations enable audit trail. Native Decimal type. JSONB support.                |
| **PostgreSQL**        | 15.x or 16.x | Primary database      | ACID compliance critical for financial transactions. JSONB for snapshots. Native DECIMAL type. Row-level security support.               |
| **Redis**             | 7.x          | Cache & session store | BullMQ queue backend (Phase 5), session storage, pub/sub for SSE. Minimal caching (billing must be deterministic).                       |
| **TypeScript**        | 5.x          | Type system           | REQUIRED. Financial calculations demand compile-time type safety. Shared types between monorepo packages eliminate API drift.            |
| **Decimal.js**        | 10.x         | Financial precision   | JavaScript Number is unsafe for money (0.1 + 0.2 ≠ 0.3). Decimal.js provides exact decimal arithmetic. Currency-agnostic. Immutable API. |
| **@nestjs/passport**  | 10.x         | Auth framework        | NestJS wrapper for Passport.js. Supports JWT strategy, local strategy, OAuth (future).                                                   |
| **passport-jwt**      | 4.x          | JWT strategy          | Stateless auth. Roles in payload. Multi-instance ready (no sticky sessions).                                                             |
| **bcrypt**            | 5.x          | Password hashing      | Industry standard. Work factor 10-12 for balance. Prevents rainbow table attacks.                                                        |
| **class-validator**   | 0.14.x       | Request validation    | Decorator-based validation. Prevents invalid billing parameters. NestJS standard.                                                        |
| **class-transformer** | 0.5.x        | Object mapping        | Transform DTOs, exclude sensitive fields. NestJS standard.                                                                               |
| **@nestjs/terminus**  | 10.x         | Health checks         | Liveness/readiness probes. PostgreSQL, Redis, disk, memory indicators. Kubernetes-ready.                                                 |
| **@nestjs/swagger**   | 7.x          | OpenAPI documentation | Auto-generate API docs from decorators. Swagger UI at /api-docs.                                                                         |

### Supporting

| Library                   | Version | Purpose                   | When to Use                                                               |
| ------------------------- | ------- | ------------------------- | ------------------------------------------------------------------------- |
| **@nestjs/config**        | 3.x     | Environment configuration | Load .env files, validate env vars with Joi schemas.                      |
| **@nestjs/event-emitter** | 2.x     | Internal event bus        | Decouple domains (ContractPublished → ObligationScheduler).               |
| **helmet**                | 7.x     | HTTP security headers     | Protect admin portal from XSS, clickjacking.                              |
| **@nestjs/throttler**     | 5.x     | Rate limiting             | Prevent abuse of expensive operations (billing runs).                     |
| **date-fns**              | 3.x     | Date manipulation         | Billing period calculations. Prefer over Moment.js (deprecated, mutable). |
| **uuid**                  | 9.x     | Unique IDs                | Generate line_hash for obligation deduplication.                          |

### Alternatives Considered

| Instead of   | Could Use            | Tradeoff                                                                                                                  |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Turborepo    | Nx                   | Nx has more features (affected commands, plugins) but higher learning curve, heavier. Turborepo simpler for 3-5 packages. |
| pnpm         | npm/yarn             | npm slower, disk inefficient. Yarn 1 deprecated. Yarn 2+ (berry) has different package resolution that breaks some tools. |
| Prisma       | TypeORM              | TypeORM weaker type safety, decorator-heavy, complex queries verbose. Drizzle too new, smaller ecosystem.                 |
| PostgreSQL   | MySQL                | MySQL lacks robust JSONB, weaker transaction isolation (REPEATABLE READ issues). MongoDB no ACID across collections.      |
| Decimal.js   | dinero.js v2         | dinero.js requires custom currency definitions, overkill for simple decimal math. dinero.js v1 deprecated.                |
| Passport JWT | Auth0 SDK            | Auth0 adds external dependency, cost. Passport sufficient for v1. Can migrate later.                                      |
| Terminus     | Custom health checks | Terminus standardized, Kubernetes-ready, supports multiple indicators out-of-box.                                         |

**Installation:**

```bash
# Root
pnpm add -D turbo@2

# API package
pnpm add @nestjs/common@10 @nestjs/core@10 @nestjs/platform-express@10
pnpm add @nestjs/config@3 @nestjs/mapped-types@2
pnpm add @prisma/client@5 decimal.js@10
pnpm add @nestjs/passport@10 @nestjs/jwt@10 passport@0.7 passport-jwt@4 bcrypt@5
pnpm add class-validator@0.14 class-transformer@0.5
pnpm add @nestjs/event-emitter@2 @nestjs/terminus@10 @nestjs/swagger@7
pnpm add helmet@7 @nestjs/throttler@5 date-fns@3 uuid@9
pnpm add -D @types/passport-jwt @types/bcrypt prisma@5

# Shared types package
pnpm add decimal.js@10
pnpm add -D typescript@5

# Admin package (React)
pnpm add react@18 react-dom@18
pnpm add -D @types/react@18 @types/react-dom@18 vite@5 @vitejs/plugin-react@4
```

## Architecture Patterns

### Recommended Monorepo Structure

```
/
├── apps/
│   ├── api/                      # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts           # Bootstrap, Swagger setup, global pipes
│   │   │   ├── app.module.ts     # Root module
│   │   │   ├── common/           # Shared utilities
│   │   │   │   ├── decorators/   # @Roles(), @CurrentUser()
│   │   │   │   ├── guards/       # JwtAuthGuard, RolesGuard
│   │   │   │   ├── filters/      # PrismaClientExceptionFilter
│   │   │   │   ├── interceptors/ # AuditLogInterceptor
│   │   │   │   └── utils/        # DecimalHelper
│   │   │   ├── config/           # ConfigModule setup
│   │   │   ├── database/         # PrismaModule, PrismaService
│   │   │   ├── auth/             # AuthModule, JWT strategy
│   │   │   ├── users/            # UsersModule
│   │   │   ├── audit/            # AuditModule (entity change logging)
│   │   │   └── health/           # HealthModule (Terminus)
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema (can split to multiple files)
│   │   │   └── migrations/       # Generated migrations
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── admin/                    # React admin portal (Vite + Shadcn/ui)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   └── pages/
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── portal/                   # React tenant portal (stub for v1)
│       └── package.json
├── packages/
│   ├── shared-types/             # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── enums.ts          # Roles, ContractStatus, etc.
│   │   │   ├── dtos/             # Request/response DTOs
│   │   │   └── entities/         # Domain entities (mirrors Prisma)
│   │   └── package.json
│   ├── formula-engine/           # Formula evaluation (math.js sandbox) - stub for Phase 3
│   │   └── package.json
│   ├── eslint-config/            # Shared ESLint config
│   │   └── package.json
│   └── tsconfig/                 # Shared TypeScript configs
│       ├── base.json
│       ├── nestjs.json
│       └── react.json
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Pattern 1: Decimal.js Wrapper Utility

**What:** Centralized utility for financial calculations to enforce Decimal.js usage and prevent accidental native number arithmetic.

**When to use:** ALL financial operations (amounts, rates, calculations).

**Example:**

```typescript
// apps/api/src/common/utils/decimal-helper.ts
import Decimal from 'decimal.js';

export class DecimalHelper {
  /**
   * Add two decimal values
   * @example DecimalHelper.add('100.50', '25.25') => Decimal(125.75)
   */
  static add(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).plus(b);
  }

  /**
   * Multiply with rounding to 4 decimal places (standard for money)
   * @example DecimalHelper.multiply('100.50', '1.15') => Decimal(115.575) => Decimal(115.58)
   */
  static multiply(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).times(b).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  /**
   * Divide with rounding
   */
  static divide(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).dividedBy(b).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  /**
   * Round to 2 decimal places (for display/invoice amounts)
   */
  static roundMoney(value: Decimal.Value): Decimal {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /**
   * Convert Decimal to number (ONLY for read-only display, never calculations)
   */
  static toNumber(value: Decimal): number {
    return value.toNumber();
  }

  /**
   * Format for display with currency symbol
   */
  static format(value: Decimal.Value, currency: string = 'TRY'): string {
    const symbols = { TRY: '₺', EUR: '€', USD: '$' };
    const rounded = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return `${symbols[currency] || currency} ${rounded.toFixed(2)}`;
  }
}
```

### Pattern 2: Multi-Tenant Context with Prisma Middleware

**What:** Request-scoped tenant context that automatically filters all Prisma queries by airport/tenant, preventing data leaks.

**When to use:** Every authenticated request. Critical for multi-tenant isolation.

**Example:**

```typescript
// apps/api/src/database/prisma.service.ts
import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly cls: ClsService) {
    super();

    // Middleware to inject tenant context into all queries
    this.$use(async (params, next) => {
      const tenantId = this.cls.get('tenantId');

      // Models that require tenant filtering
      const tenantModels = ['Contract', 'Obligation', 'Declaration', 'Invoice'];

      if (tenantId && tenantModels.includes(params.model)) {
        if (params.action === 'findMany' || params.action === 'findFirst') {
          params.args.where = { ...params.args.where, tenantId };
        }
        if (params.action === 'findUnique') {
          params.args.where = { ...params.args.where, tenantId };
        }
        if (params.action === 'update' || params.action === 'delete') {
          params.args.where = { ...params.args.where, tenantId };
        }
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}

// apps/api/src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user; // Attached by JwtAuthGuard
});
```

### Pattern 3: RBAC with Separation of Duties

**What:** Role-based access control with metadata decorators and guards that enforce "creator cannot approve" rules.

**When to use:** All protected endpoints. Critical for financial approval workflows.

**Example:**

```typescript
// packages/shared-types/src/enums.ts
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  AIRPORT_ADMIN = 'airport_admin',
  COMMERCIAL_MANAGER = 'commercial_manager',
  FINANCE = 'finance',
  AUDITOR = 'auditor',
  TENANT_ADMIN = 'tenant_admin',
  TENANT_USER = 'tenant_user',
}

// apps/api/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@shared-types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const EXCLUDE_CREATOR_KEY = 'excludeCreator';
export const ExcludeCreator = () => SetMetadata(EXCLUDE_CREATOR_KEY, true);

// apps/api/src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@shared-types';
import { ROLES_KEY, EXCLUDE_CREATOR_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No role requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user has required role
    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));
    if (!hasRole) {
      return false;
    }

    // Check separation of duties (e.g., contract approval)
    const excludeCreator = this.reflector.get<boolean>(
      EXCLUDE_CREATOR_KEY,
      context.getHandler(),
    );

    if (excludeCreator) {
      const resourceCreatorId = request.body?.createdBy || request.params?.createdBy;
      if (resourceCreatorId === user.sub) {
        return false; // Creator cannot approve own resource
      }
    }

    return true;
  }
}

// Usage in controller:
@Post('contracts/:id/approve')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AIRPORT_ADMIN, UserRole.COMMERCIAL_MANAGER)
@ExcludeCreator() // Creator cannot approve own contract
approveContract(@Param('id') id: string, @CurrentUser() user: any) {
  // ...
}
```

### Pattern 4: Audit Trail with TypeORM-style Subscribers (Prisma Extension)

**What:** Automatic logging of all entity state changes (create, update, delete) with before/after snapshots.

**When to use:** All mutable entities (Contract, Obligation, Tenant, etc.). Not needed for immutable entities (AuditLog itself).

**Example:**

```typescript
// apps/api/src/audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ClsService } from 'nestjs-cls';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async log(params: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
  }) {
    const userId = this.cls.get('userId');
    const tenantId = this.cls.get('tenantId');

    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: userId || 'SYSTEM',
        tenantId,
        before: params.before || {},
        after: params.after || {},
        timestamp: new Date(),
      },
    });
  }
}

// apps/api/src/common/interceptors/audit-log.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService, AuditAction } from '../../audit/audit.service';

export const AUDIT_KEY = 'audit';
export const Audit = (entityType: string) => SetMetadata(AUDIT_KEY, entityType);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const entityType = this.reflector.get<string>(AUDIT_KEY, context.getHandler());

    if (!entityType) {
      return next.handle(); // No audit needed
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method;

    return next.handle().pipe(
      tap((data) => {
        // Determine action from HTTP method
        let action: AuditAction;
        if (method === 'POST') action = AuditAction.CREATE;
        else if (method === 'PUT' || method === 'PATCH') action = AuditAction.UPDATE;
        else if (method === 'DELETE') action = AuditAction.DELETE;
        else return; // GET doesn't need audit

        this.auditService.log({
          action,
          entityType,
          entityId: data?.id || request.params?.id,
          before: request.body?._before, // Attach in controller if needed
          after: data,
        });
      }),
    );
  }
}
```

### Pattern 5: Health Checks with Terminus

**What:** Kubernetes-ready liveness and readiness probes with database and Redis connectivity checks.

**When to use:** Every deployment. Kubernetes requires /health/liveness and /health/readiness endpoints.

**Example:**

```typescript
// apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get('liveness')
  @HealthCheck()
  liveness() {
    // Liveness: Is the container running? (lightweight check)
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
    ]);
  }

  @Get('readiness')
  @HealthCheck()
  readiness() {
    // Readiness: Is the container ready to accept traffic? (DB connectivity)
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      // Add Redis check when BullMQ added in Phase 5:
      // () => this.redis.pingCheck('redis'),
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }
}
```

### Pattern 6: Swagger Documentation Setup

**What:** Auto-generated OpenAPI documentation from NestJS decorators, with JWT auth, response schemas, and examples.

**When to use:** All API endpoints.

**Example:**

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Airport Revenue Management API')
    .setDescription('Non-aeronautical revenue billing and invoicing platform')
    .setVersion('1.0')
    .addBearerAuth() // JWT authentication
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('tenants', 'Tenant (concessionaire) management')
    .addTag('contracts', 'Contract lifecycle')
    .addTag('health', 'Health checks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
  console.log(`API running at http://localhost:3000`);
  console.log(`Swagger UI at http://localhost:3000/api-docs`);
}
bootstrap();

// Example DTO with Swagger decorators:
// apps/api/src/users/dto/create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';
import { UserRole } from '@shared-types';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (min 8 characters)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.COMMERCIAL_MANAGER,
  })
  @IsEnum(UserRole)
  role: UserRole;
}
```

### Anti-Patterns to Avoid

- **Using native JavaScript number for money:** Always use Decimal.js. Native numbers cause precision errors (0.1 + 0.2 = 0.30000000000000004).
- **Creating new PrismaClient per request:** Singleton pattern required. Connection pool exhaustion, performance degradation.
- **Storing Decimal as string in DTOs without validation:** Use class-transformer @Type(() => Decimal) to ensure Decimal instances.
- **Hardcoding roles in guards:** Use enums from shared-types package. Single source of truth.
- **Not validating JWT signature:** Always verify JWT signature with secret. Attackers can forge unsigned tokens.
- **Using bcrypt with work factor < 10:** Too fast, vulnerable to brute force. Use 10-12.
- **Logging sensitive data in audit trail:** Exclude password hashes, tokens, PII from before/after snapshots.
- **Docker Compose localhost database URL:** Inside containers, use service name (postgres:5432) not localhost:5432.

## Don't Hand-Roll

| Problem                      | Don't Build                              | Use Instead                              | Why                                                                                          |
| ---------------------------- | ---------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Password hashing             | Custom hashing algorithm, MD5, SHA256    | bcrypt with work factor 10-12            | Salting, key stretching, timing-attack resistance. Custom crypto always has vulnerabilities. |
| JWT token generation         | Manual base64 encoding, custom signing   | @nestjs/jwt with passport-jwt            | Standard compliant, signature verification, expiration handling.                             |
| Request validation           | Manual if/else checks, custom validators | class-validator + class-transformer      | Decorator-based, comprehensive rules, type coercion, nested validation.                      |
| Health checks                | Custom ping endpoints, manual DB queries | @nestjs/terminus                         | Standardized format, multiple indicators, Kubernetes-compatible.                             |
| API documentation            | Manually written OpenAPI YAML            | @nestjs/swagger decorators               | Auto-sync with code, zero maintenance, type-safe.                                            |
| Financial arithmetic         | Native JavaScript operators (+, \*, /)   | Decimal.js                               | Exact decimal math, no floating-point errors, immutable API.                                 |
| Multi-tenant query filtering | Manual WHERE clauses in every query      | Prisma middleware with CLS context       | Centralized, prevents accidental leaks, consistent across codebase.                          |
| Database migrations          | Manual SQL scripts, ALTER TABLE commands | Prisma Migrate                           | Version control, rollback support, type-safe schema.                                         |
| Enum management              | String literals, magic strings           | TypeScript enums in shared-types package | Type safety, single source of truth, refactor-safe.                                          |

**Key insight:** Security, precision, and data isolation are too critical to hand-roll. Use battle-tested libraries. Custom solutions miss edge cases that experts solved years ago. Hand-rolled auth has vulnerabilities. Hand-rolled decimal math has rounding errors. Hand-rolled multi-tenancy has data leaks.

## Common Pitfalls

### Pitfall 1: Decimal Precision Loss in Financial Calculations

**What goes wrong:** Using JavaScript's native `number` type for monetary values creates floating-point precision errors. 0.1 + 0.2 = 0.30000000000000004. Errors compound across thousands of invoices, creating reconciliation nightmares.

**Why it happens:** JavaScript uses IEEE 754 double-precision floats. 0.1 cannot be represented exactly in binary, just like 1/3 cannot be represented exactly in decimal (0.333...).

**How to avoid:**

- Use Decimal.js for ALL monetary values, rates, percentages
- Prisma schema: `amount Decimal @db.Decimal(19, 4)` (19 total digits, 4 decimal places)
- Create DecimalHelper utility wrapper (see Pattern 1)
- Add ESLint rule to ban native number arithmetic on monetary fields
- NEVER convert Decimal to number until final display step

**Warning signs:**

- Invoice amounts end in ...0004 or ...9999
- Sum of line items ≠ total
- Reconciliation reports show penny discrepancies
- Unit tests with 0.1 + 0.2 === 0.3 assertions fail

**Test to verify:**

```typescript
// apps/api/src/common/utils/decimal-helper.spec.ts
describe('DecimalHelper', () => {
  it('should prevent floating-point precision errors', () => {
    const a = new Decimal('0.1');
    const b = new Decimal('0.2');
    const result = DecimalHelper.add(a, b);

    expect(result.toString()).toBe('0.3'); // Passes
    expect(0.1 + 0.2).not.toBe(0.3); // Demonstrates the problem
  });
});
```

### Pitfall 2: Docker Compose Service Name vs localhost

**What goes wrong:** Prisma connection fails with "ECONNREFUSED localhost:5432" when API container tries to connect to PostgreSQL. App works locally without Docker but fails in container.

**Why it happens:** Inside a Docker container, `localhost` refers to the container itself, not the host machine. PostgreSQL runs in separate container (postgres:5432).

**How to avoid:**

- Use service name from docker-compose.yml as hostname
- Correct: `DATABASE_URL=postgresql://user:pass@postgres:5432/db`
- Wrong: `DATABASE_URL=postgresql://user:pass@localhost:5432/db`
- Use environment-specific .env files (.env.local vs .env.docker)
- Document in README.md for team

**Warning signs:**

- Works with `npm run start:dev` but fails in Docker
- Connection refused errors to port 5432 or 6379
- Health check /health/readiness fails immediately on container start

**Example docker-compose.yml:**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: airport_revenue
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dev']
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./apps/api
    environment:
      DATABASE_URL: postgresql://dev:devpass@postgres:5432/airport_revenue
      #                                      ^^^^^^^^ service name, not localhost
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
```

### Pitfall 3: Prisma Schema Drift (Manual DB Changes)

**What goes wrong:** Developer runs manual SQL in production (ALTER TABLE, CREATE INDEX). Prisma schema out of sync. Next migration fails with conflicts. Team loses migration history, forced to manually reconcile.

**Why it happens:** Urgent hotfix, debugging in production, misunderstanding of migration workflow.

**How to avoid:**

- NEVER run manual SQL in environments (staging, production)
- All schema changes via Prisma Migrate: `prisma migrate dev`
- Use `--create-only` flag to review migration SQL before applying
- Use `prisma db pull` to sync schema from existing database (one-time, project start)
- Enable migration locking in CI/CD (prevent concurrent migrations)

**Warning signs:**

- `prisma migrate dev` errors: "Column already exists"
- `prisma migrate deploy` fails in CI/CD
- Prisma Client types don't match database schema
- Team reports "schema.prisma doesn't match database"

**Recovery process:**

```bash
# If schema drift detected:
1. prisma db pull           # Introspect current database state
2. Compare with schema.prisma
3. Create migration for difference: prisma migrate dev --name fix-drift --create-only
4. Review generated SQL
5. Apply: prisma migrate deploy
```

### Pitfall 4: JWT Secret in Version Control

**What goes wrong:** Developer commits .env file with JWT_SECRET to git. Attackers clone repo, extract secret, forge admin tokens, gain full access to production API.

**Why it happens:** .env file not in .gitignore, developer unaware of security implications, example .env.example copied without changing secrets.

**How to avoid:**

- Add .env to .gitignore BEFORE first commit
- Provide .env.example template with placeholder values (JWT_SECRET=your_secret_here_change_me)
- Use @nestjs/config validation to fail startup if secrets missing
- Production secrets in environment variables (AWS Secrets Manager, HashiCorp Vault)
- NEVER commit JWT_SECRET, DATABASE_URL, API keys

**Warning signs:**

- GitHub security alert: "Secret detected in commit"
- Production JWT_SECRET matches local development secret
- .env file visible in git history (`git log --all -- .env`)

**Prevention code:**

```typescript
// apps/api/src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .invalid('your_secret_here_change_me', 'secret') // Reject placeholder values
    .description('JWT signing secret (min 32 chars)'),
  JWT_EXPIRATION: Joi.string().default('15m'),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
});

// apps/api/src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // Show all validation errors
      },
    }),
  ],
})
```

### Pitfall 5: RBAC Guard Not Applied to All Routes

**What goes wrong:** Developer forgets @UseGuards(RolesGuard) on sensitive endpoint. Auditor role can create contracts. Tenant user can delete other tenants. Security breach.

**Why it happens:** Guards applied per-controller or per-route (opt-in). New endpoints added without guards. Copy-paste from public endpoint template.

**How to avoid:**

- Apply guards globally in main.ts: `app.useGlobalGuards(new JwtAuthGuard(), new RolesGuard())`
- Use @Public() decorator for exceptions (login, health checks)
- Add ESLint rule to require @Roles() decorator on all @Post/@Put/@Delete routes
- Security audit: grep for missing @UseGuards in PR reviews

**Warning signs:**

- Public endpoints accessible without Authorization header
- Auditor can modify data (should be read-only)
- Tenant user can access other tenant data
- Security tests fail: unauthorized access returns 200 instead of 403

**Global guard setup:**

```typescript
// apps/api/src/main.ts
const app = await NestFactory.create(AppModule);
const reflector = app.get(Reflector);

app.useGlobalGuards(
  new JwtAuthGuard(reflector),
  new RolesGuard(reflector),
);

// apps/api/src/common/decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// apps/api/src/auth/auth.controller.ts
@Public() // Explicitly mark as public
@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

### Pitfall 6: Missing Database Connection Cleanup

**What goes wrong:** Prisma connections leak. Connection pool exhausted. API becomes unresponsive. "Too many connections" errors. Requires container restart.

**Why it happens:** PrismaClient.$connect() called but never $disconnect(). Tests create new client per test without cleanup. Hot reload creates new instances.

**How to avoid:**

- Singleton PrismaService pattern (one instance per app)
- Call enableShutdownHooks() in main.ts
- Close connections in beforeEach/afterEach test hooks
- Use Prisma connection pool settings (connection_limit=20)
- Monitor active connections: SELECT count(\*) FROM pg_stat_activity;

**Warning signs:**

- Connection pool exhausted errors
- API slow after running for hours
- Database reports > 100 active connections from single API instance
- Tests fail with "Cannot connect to database" after 20+ test files

**Solution:**

```typescript
// apps/api/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prismaService = app.get(PrismaService);

  await prismaService.enableShutdownHooks(app);

  await app.listen(3000);
}

// apps/api/test/helpers/setup.ts
let prisma: PrismaService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaService],
  }).compile();

  prisma = moduleRef.get(PrismaService);
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## Code Examples

Verified patterns from official sources:

### Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "outputs": []
    },
    "db:migrate": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    }
  }
}
```

### Docker Compose with Health Checks

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: airport-db
    environment:
      POSTGRES_DB: airport_revenue
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dev -d airport_revenue']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: airport-redis
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: development
    container_name: airport-api
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://dev:devpass@postgres:5432/airport_revenue
      REDIS_URL: redis://redis:6379
      JWT_SECRET: development_secret_change_in_production
      JWT_EXPIRATION: 15m
    volumes:
      - ./apps/api/src:/app/apps/api/src
      - ./packages:/app/packages
      - /app/node_modules
      - /app/apps/api/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: pnpm --filter api dev

volumes:
  postgres_data:
```

### Prisma Schema Foundation

```prisma
// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  SUPER_ADMIN
  AIRPORT_ADMIN
  COMMERCIAL_MANAGER
  FINANCE
  AUDITOR
  TENANT_ADMIN
  TENANT_USER
}

enum Currency {
  TRY
  EUR
  USD
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hashed
  role      UserRole
  firstName String?
  lastName  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  auditLogs AuditLog[]

  @@index([email])
  @@index([role])
}

model AuditLog {
  id         String   @id @default(cuid())
  action     String   // CREATE, UPDATE, DELETE
  entityType String   // Contract, Obligation, etc.
  entityId   String
  userId     String
  tenantId   String?
  before     Json     @default("{}")  // JSONB for before state
  after      Json     @default("{}")  // JSONB for after state
  timestamp  DateTime @default(now())

  // Relations
  user User @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
}

model Tenant {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  currency    Currency @default(TRY)
  contactName String?
  email       String?
  phone       String?
  status      String   // active, suspended, deactivated
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([code])
  @@index([status])
}

// Additional models (Contract, Obligation, etc.) added in Phase 2-3
```

### JWT Strategy Implementation

```typescript
// apps/api/src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  tenantId?: string; // Optional for tenant-scoped users
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Verify user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Return user object (attached to request.user)
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: payload.tenantId,
    };
  }
}
```

### NestJS Module with Prisma

```typescript
// apps/api/src/database/database.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Makes PrismaService available everywhere without import
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}

// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
```

## State of the Art

| Old Approach            | Current Approach           | When Changed | Impact                                                                                       |
| ----------------------- | -------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| Moment.js for dates     | date-fns                   | 2020         | Moment.js deprecated, mutable API dangerous. date-fns immutable, tree-shakeable.             |
| Bull (job queue)        | BullMQ                     | 2021         | Bull no longer maintained. BullMQ better TypeScript support, improved Redis patterns.        |
| TypeORM                 | Prisma                     | 2021-2022    | TypeORM weak type safety, complex migrations. Prisma schema-first, better DX.                |
| Manual env validation   | @nestjs/config + Joi       | 2020         | Fail-fast on missing secrets. Joi schema validation catches errors at startup.               |
| Global Passport guards  | Reflector-based guards     | 2022         | Global guards with @Public() decorator cleaner than opt-in per route.                        |
| dinero.js v1            | Decimal.js                 | 2023         | dinero.js v1 abandoned. Decimal.js currency-agnostic, simpler API for non-currency decimals. |
| Separate Swagger JSON   | @nestjs/swagger decorators | 2019         | Manual OpenAPI YAML out-of-sync. Decorators auto-generate from code.                         |
| Custom health endpoints | @nestjs/terminus           | 2020         | Terminus standardized format, Kubernetes-compatible, multiple indicators.                    |

**Deprecated/outdated:**

- **Moment.js:** Deprecated. Use date-fns (immutable, smaller bundle).
- **Bull (not BullMQ):** No longer maintained. Use BullMQ.
- **dinero.js v1:** Abandoned since 2019. Use Decimal.js or dinero.js v2.
- **Manual JWT signing:** Use @nestjs/jwt. Custom crypto always has bugs.
- **class-validator-jsonschema:** Deprecated. Use @nestjs/swagger directly.

## Open Questions

1. **Multi-file Prisma schema organization**
   - What we know: Prisma 5.x supports multi-file schemas with --schema flag or generator paths
   - What's unclear: Best practice for 20+ models — single schema.prisma vs split by domain (auth.prisma, contracts.prisma, billing.prisma)
   - Recommendation: Start with single file in Phase 1 (easier), split by domain in Phase 2 when models > 15. Document in schema.prisma comments.

2. **Refresh token rotation strategy**
   - What we know: Access tokens 15min, refresh tokens 7d. Store refresh tokens in Redis or database.
   - What's unclear: Refresh token rotation (issue new refresh token on refresh) vs reuse (same refresh token until expiration)
   - Recommendation: Implement rotation in Phase 1 (higher security). Store refresh token hash in database, invalidate on logout. Adds complexity but prevents token replay attacks.

3. **Prisma Client generation in Docker**
   - What we know: `prisma generate` must run after `npm install` to create @prisma/client
   - What's unclear: Should Dockerfile RUN prisma generate, or should docker-compose command run it on container start?
   - Recommendation: RUN prisma generate in Dockerfile (faster container startup). Re-run on schema change: docker-compose exec api npx prisma generate.

4. **Separation of duties metadata storage**
   - What we know: Need to prevent creator from approving own contract
   - What's unclear: Should createdBy be in entity table (Contract.createdBy) or audit log only?
   - Recommendation: Store createdBy in entity table. Easier to query, enforce in guard. Audit log for historical tracking. Add index on createdBy for performance.

5. **JSONB vs JSON for audit trail**
   - What we know: JSONB faster for queries, 26% larger storage. JSON preserves formatting, faster inserts.
   - What's unclear: Audit logs are write-heavy, rarely queried. Is JSONB overhead justified?
   - Recommendation: Use JSONB. Audit logs queried for compliance, investigations. Query performance > insert speed. Storage overhead negligible for v1 scale.

## Sources

### Primary (HIGH confidence)

- [Turborepo TypeScript Guide](https://turborepo.dev/docs/guides/tools/typescript) - Monorepo configuration, shared tsconfig patterns
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/docker) - Container setup, client generation, migration workflow
- [NestJS Official Docs - Prisma](https://docs.nestjs.com/recipes/prisma) - PrismaService pattern, module integration
- [NestJS Official Docs - Authentication](https://docs.nestjs.com/security/authentication) - JWT strategy, Passport integration
- [NestJS Official Docs - Terminus](https://docs.nestjs.com/recipes/terminus) - Health check setup, indicators
- [Prisma Schema Docs](https://www.prisma.io/docs/orm/prisma-schema/overview) - Schema design, relationships, indexes
- [Prisma Best Practices](https://www.prisma.io/docs/orm/more/best-practices) - Migration strategies, type safety patterns

### Secondary (MEDIUM confidence)

- [How to setup a monorepo project using NextJS, NestJS, Turborepo and pnpm](https://medium.com/@chengchao60827/how-to-setup-a-monorepo-project-using-nextjs-nestjs-turborepo-and-pnpm-e0d3ade0360d) - Monorepo structure, pnpm workspaces
- [Dockerizing NestJS with Prisma and PostgreSQL](https://notiz.dev/blog/dockerizing-nestjs-with-prisma-and-postgresql/) - Docker Compose patterns, health checks, volume mounts
- [API with NestJS #147: Money with PostgreSQL and Prisma](https://wanago.io/2024/03/04/api-nestjs-money-postgresql-prisma/) - Decimal.js usage, Prisma Decimal type
- [Building an Audit Trail System in NestJS](https://medium.com/@solomoncodes/building-an-audit-trail-system-in-nestjs-222a4604a6a2) - Audit patterns, interceptors, TypeORM subscribers
- [Role-Based Access Control in NestJS](https://medium.com/@dev.muhammet.ozen/role-based-access-control-in-nestjs-15c15090e47d) - RBAC guards, roles decorator, separation of duties
- [NestJS + Swagger: Auto-Generate API Docs](https://www.devcentrehouse.eu/blogs/nestjs-swagger-auto-generate-api-docs/) - Swagger setup, decorators, best practices
- [Securing Multi-Tenant Applications Using RLS with Prisma](https://medium.com/@francolabuschagne90/securing-multi-tenant-applications-using-row-level-security-in-postgresql-with-prisma-orm-4237f4d4bd35) - Multi-tenant patterns, Prisma middleware
- [NestJS JWT Authentication with Refresh Tokens](https://www.elvisduru.com/blog/nestjs-jwt-authentication-refresh-token) - Token rotation, storage strategies
- [JSON vs JSONB in PostgreSQL](https://www.dbvis.com/thetable/json-vs-jsonb-in-postgresql-a-complete-comparison/) - Performance comparison, storage overhead

### Tertiary (LOW confidence - needs validation)

- [Stop Fighting node_modules: Managing Monorepos in 2026](https://medium.com/@jamesmiller22871/stop-fighting-node-modules-a-modern-guide-to-managing-monorepos-in-2026-16cbc79e190d) - pnpm vs npm, syncpack for version consistency
- GitHub starter templates: ejazahm3d/fullstack-turborepo-starter, mantaskaveckas/nestjs-turbo - Reference implementations (not verified)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Core libraries (NestJS, Prisma, PostgreSQL, Decimal.js) verified with official docs and production usage patterns
- Architecture: HIGH - Patterns (modular monolith, Prisma middleware, RBAC guards) verified with official guides and Medium articles from NestJS community
- Pitfalls: HIGH - Common mistakes (decimal precision, Docker localhost, schema drift) documented in official guides and community post-mortems
- Validation Architecture: N/A - workflow.nyquist_validation not enabled in config

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (30 days - stable technologies, minimal churn)

**Notes:**

- Library versions verified as of 2026-03-01 web search results
- Prisma 5.x currently stable, Prisma 6.x in preview (use 5.x for Phase 1)
- NestJS 10.x stable, all @nestjs/\* packages should match major version
- Decimal.js 10.x stable, immutable API requires learning curve
- Multi-file Prisma schema needs validation with current Prisma version before Phase 2
