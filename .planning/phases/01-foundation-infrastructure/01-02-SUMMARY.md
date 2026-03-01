---
phase: 01-foundation-infrastructure
plan: 02
subsystem: auth
tags: [jwt, rbac, bcrypt, decimal.js, prisma, redis, nestjs, passport]

# Dependency graph
requires:
  - phase: 01-01
    provides: NestJS API shell, Prisma schema with User model, shared-types with UserRole enum, ioredis dependency
provides:
  - JWT authentication with admin/tenant split login paths
  - Refresh token rotation with Redis storage
  - RBAC guards with 7 roles and separation of duties (@ExcludeCreator)
  - @Public() decorator for open endpoints
  - DecimalHelper precision utility (0.1 + 0.2 = 0.3 exactly)
  - PrismaService singleton with CLS tenant context injection
  - PrismaExceptionFilter (P2002→409, P2025→404, P2003→400)
  - Shared @Global RedisModule with REDIS_CLIENT injection token
  - Environment validation (JWT_SECRET, DATABASE_URL, REDIS_URL required)
  - User CRUD service and controller
affects: [01-04, 02-01, 02-02, 03-01, 03-02, 04-01, 05-01]

# Tech tracking
tech-stack:
  added: [passport-jwt, bcrypt, nestjs-cls, helmet, @nestjs/throttler, @nestjs/jwt, @nestjs/passport]
  patterns: [jwt-refresh-rotation, rbac-guard-reflector, cls-tenant-context, decimal-precision, prisma-exception-filter, redis-refresh-store]

key-files:
  created:
    - apps/api/src/config/env.validation.ts
    - apps/api/src/redis/redis.module.ts
    - apps/api/src/redis/redis.constants.ts
    - apps/api/src/database/database.module.ts
    - apps/api/src/database/prisma.service.ts
    - apps/api/src/common/utils/decimal-helper.ts
    - apps/api/src/common/utils/decimal-helper.spec.ts
    - apps/api/src/common/filters/prisma-exception.filter.ts
    - apps/api/src/common/decorators/public.decorator.ts
    - apps/api/src/common/decorators/roles.decorator.ts
    - apps/api/src/common/decorators/current-user.decorator.ts
    - apps/api/src/common/guards/jwt-auth.guard.ts
    - apps/api/src/common/guards/roles.guard.ts
    - apps/api/src/common/guards/roles.guard.spec.ts
    - apps/api/src/auth/auth.module.ts
    - apps/api/src/auth/auth.service.ts
    - apps/api/src/auth/auth.service.spec.ts
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/strategies/jwt.strategy.ts
    - apps/api/src/auth/strategies/jwt-refresh.strategy.ts
    - apps/api/src/auth/dto/login.dto.ts
    - apps/api/src/auth/dto/tenant-login.dto.ts
    - apps/api/src/auth/dto/register.dto.ts
    - apps/api/src/auth/dto/refresh-token.dto.ts
    - apps/api/src/auth/dto/auth-response.dto.ts
    - apps/api/src/users/users.module.ts
    - apps/api/src/users/users.service.ts
    - apps/api/src/users/users.controller.ts
    - apps/api/src/users/dto/create-user.dto.ts
    - apps/api/src/users/dto/update-user.dto.ts
  modified:
    - apps/api/src/main.ts
    - apps/api/src/app.module.ts

key-decisions:
  - "Refresh tokens stored in Redis (key: refresh:{userId}) with configurable TTL, not on User model"
  - "CLS-based tenant context injection via PrismaService middleware for automatic tenant scoping"
  - "Admin and tenant login paths separated per API contracts doc"
  - "DecimalHelper uses static methods with Decimal.js precision:20, ROUND_HALF_UP"
  - "Environment validation via class-validator transform approach"

patterns-established:
  - "Auth: admin login at /api/v1/auth/admin/login, tenant at /api/v1/auth/tenant/login"
  - "Guards: JwtAuthGuard checks @Public(), RolesGuard checks @Roles() + @ExcludeCreator()"
  - "Financial math: always use DecimalHelper, never raw floating point"
  - "Database: PrismaService with onModuleInit connect and onModuleDestroy disconnect"
  - "Redis: inject via @Inject(REDIS_CLIENT) from global RedisModule"

requirements-completed: [R1.4, R1.5, R1.6]

# Metrics
duration: 8min
completed: 2026-03-01
---

# Phase 1 Plan 2: JWT Auth + RBAC + Decimal.js Summary

**JWT authentication with admin/tenant split paths, refresh token rotation via Redis, RBAC guards with 7 roles and separation of duties, DecimalHelper precision utility, and PrismaService with CLS tenant context**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 32

## Accomplishments

- Complete JWT auth flow with admin/tenant split login, refresh token rotation, and logout
- RBAC guards with 7-role enforcement and @ExcludeCreator separation of duties
- DecimalHelper with all precision methods passing tests (0.1 + 0.2 = 0.3)
- PrismaService singleton with CLS-based tenant context injection
- Shared @Global RedisModule with REDIS_CLIENT injection token
- Environment validation enforcing JWT_SECRET (min 32 chars), DATABASE_URL, REDIS_URL
- PrismaExceptionFilter mapping Prisma errors to HTTP status codes
- User CRUD service and controller with role-based access
- auth.service.spec.ts and roles.guard.spec.ts unit tests
- Global guards, validation pipe, helmet, CORS, and throttler configured in main.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Database service, env config, and Decimal.js precision utility** - `e3a96bf` (feat)
2. **Task 2: JWT auth with refresh rotation, RBAC guards, and user management** - `f4ce31e` (feat)

## Files Created/Modified

- `apps/api/src/config/env.validation.ts` - Environment variable validation schema
- `apps/api/src/redis/redis.module.ts` - @Global Redis module with ConfigService
- `apps/api/src/redis/redis.constants.ts` - REDIS_CLIENT injection token
- `apps/api/src/database/database.module.ts` - @Global database module exporting PrismaService
- `apps/api/src/database/prisma.service.ts` - Singleton Prisma client with CLS tenant context
- `apps/api/src/common/utils/decimal-helper.ts` - Financial precision utility (add, subtract, multiply, divide, roundMoney)
- `apps/api/src/common/utils/decimal-helper.spec.ts` - Jest tests including 0.1+0.2=0.3
- `apps/api/src/common/filters/prisma-exception.filter.ts` - Prisma error to HTTP mapping
- `apps/api/src/common/decorators/public.decorator.ts` - @Public() for open endpoints
- `apps/api/src/common/decorators/roles.decorator.ts` - @Roles() + @ExcludeCreator()
- `apps/api/src/common/decorators/current-user.decorator.ts` - @CurrentUser() param decorator
- `apps/api/src/common/guards/jwt-auth.guard.ts` - JWT guard with @Public() bypass
- `apps/api/src/common/guards/roles.guard.ts` - RBAC + separation of duties guard
- `apps/api/src/common/guards/roles.guard.spec.ts` - Guard unit tests
- `apps/api/src/auth/auth.module.ts` - Auth module with JWT, Passport
- `apps/api/src/auth/auth.service.ts` - Login, refresh, logout with Redis token store
- `apps/api/src/auth/auth.service.spec.ts` - Auth service unit tests
- `apps/api/src/auth/auth.controller.ts` - Admin/tenant login, refresh, logout, me endpoints
- `apps/api/src/auth/strategies/jwt.strategy.ts` - JWT validation with user lookup
- `apps/api/src/auth/strategies/jwt-refresh.strategy.ts` - Refresh token strategy
- `apps/api/src/auth/dto/login.dto.ts` - Admin login DTO
- `apps/api/src/auth/dto/tenant-login.dto.ts` - Tenant login DTO with tenant_code
- `apps/api/src/auth/dto/register.dto.ts` - User registration DTO
- `apps/api/src/auth/dto/refresh-token.dto.ts` - Refresh token DTO
- `apps/api/src/auth/dto/auth-response.dto.ts` - Auth response DTO
- `apps/api/src/users/users.module.ts` - Users module
- `apps/api/src/users/users.service.ts` - User CRUD with password hashing
- `apps/api/src/users/users.controller.ts` - User endpoints with role guards
- `apps/api/src/users/dto/create-user.dto.ts` - Create user DTO
- `apps/api/src/users/dto/update-user.dto.ts` - Update user DTO (PartialType)
- `apps/api/src/main.ts` - Updated: globalPrefix, guards, pipes, filters, helmet, CORS
- `apps/api/src/app.module.ts` - Updated: AuthModule, UsersModule, ThrottlerModule, ClsModule, RedisModule, DatabaseModule

## Self-Check: PASSED

All 30 created files verified present. Both task commits verified in git log.

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-03-01*
