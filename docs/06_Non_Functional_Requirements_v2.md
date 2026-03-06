# ⚡ NON-FUNCTIONAL REQUIREMENTS (NFR)
## Performance, Security, Reliability & Operations

**Version:** v3.0 (Post-Review Edition)
**Last Updated:** 2026-02-28
**Stack:** NestJS + PostgreSQL + Redis + BullMQ
**Review Status:** SoD genişletildi, billing run snapshot/idempotency eklendi

---

## 1. PERFORMANCE

### 1.1 Response Time Targets

| Operation | Target (P95) | Max |
|-----------|:------------:|:---:|
| API read (single entity) | 200ms | 500ms |
| API read (list, paginated) | 500ms | 1s |
| API write (single entity) | 300ms | 1s |
| Formula evaluation (math.js) | 50ms | 200ms |
| Billing run (10 tenants, 50 obligations) | 30s | 60s |
| Billing run (100 tenants, 500 obligations) | 5 min | 10 min |
| Stripe invoice creation (single) | 3s | 10s |
| Dashboard page load | 2s | 5s |
| Obligation schedule generation (1 contract, 12 months) | 1s | 3s |

### 1.2 Throughput (MVP)

| Metric | Target |
|--------|--------|
| Concurrent admin users | 20 |
| Concurrent tenant portal users | 50 |
| Obligations per billing run | 500 |
| Stripe API calls per minute | 50 |
| BullMQ jobs per minute | 100 |

### 1.3 Data Volume (Year 1 — ADB)

| Entity | Estimate |
|--------|----------|
| Tenants | 50-100 |
| Active contracts | 50-100 |
| Obligations per month | 200-500 |
| Invoice records per year | 2,400-6,000 |
| Audit log entries per year | 50K-100K |
| Declarations per month | 50-100 |

---

## 2. AVAILABILITY & RELIABILITY

### 2.1 SLA

| Component | Uptime Target |
|-----------|:------------:|
| API | 99.5% |
| Webhook Handler | 99.9% |
| BullMQ Workers | 99.5% |
| Admin Portal | 99.5% |
| Tenant Portal | 99.5% |

### 2.2 Recovery

| Metric | Target |
|--------|--------|
| RPO | 1 hour |
| RTO | 4 hours |
| DB backup | Every 6h + daily full |
| Backup retention | 30 days |
| Point-in-time recovery | Yes (PostgreSQL WAL) |

### 2.3 Resilience

| Pattern | Implementation |
|---------|---------------|
| Stripe failure | BullMQ retry: 3 attempts, exponential backoff (1m, 5m, 15m) |
| Stripe down (extended) | Dead letter queue → manual review |
| Circuit breaker | On Stripe calls: open after 5 failures, half-open after 60s |
| Webhook idempotency | event_id dedup in webhook_event_log |
| Billing run resumable | Checkpoint per obligation, restart from last success |
| Billing run snapshot | Contract version freeze at run initiation |
| Billing run re-run | Cancelled → full rerun, Completed → delta mode |
| Queue failure | BullMQ persistence in Redis, auto-restart |

---

## 3. SECURITY

### 3.1 Authentication

| Component | Method |
|-----------|--------|
| Admin Portal | JWT (15 min access + 7 day refresh) |
| Tenant Portal | JWT (30 min access + 30 day refresh) — **separate auth domain** |
| Stripe Webhook | HMAC SHA-256 signature verification |

### 3.2 Authorization (RBAC)

| Role | Scope |
|------|-------|
| super_admin | All airports |
| airport_admin | Single airport, all modules |
| commercial_manager | Contracts, services, formulas, billing view |
| finance | Billing runs, invoices, settlements, policies |
| auditor | Read-only everywhere |
| tenant_admin | Own tenant data + payments |
| tenant_user | Declarations + invoice view |

**Enforcement:** NestJS Guards + Decorators

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('commercial_manager', 'airport_admin')
@Post('contracts')
async createContract(@Body() dto: CreateContractDto) { ... }
```

### 3.3 Data Protection

| Requirement | Implementation |
|-------------|---------------|
| Encryption at rest | Cloud-managed (AES-256) |
| Encryption in transit | TLS 1.3 |
| Stripe API keys | Environment variable (secret manager) |
| Password hashing | bcrypt (salt rounds: 12) |
| Audit trail | Immutable append-only (no UPDATE/DELETE on audit_log) |
| SQL injection | Prisma parameterized queries |
| XSS | React auto-escaping + helmet.js |

### 3.4 Separation of Duties (Genişletilmiş)

| Rule | Enforcement |
|------|-------------|
| Contract creator ≠ approver | API checks: approved_by ≠ created_by |
| Billing run creator ≠ approver | API checks: approved_by ≠ created_by |
| Billing policy creator ≠ approver | API checks: approved_by ≠ created_by |
| Formula/Tariff writer ≠ billing run approver | Role-level: Commercial Mgr billing run approve edemez |
| Service publisher ≠ contract approver | Enterprise mode: aynı kullanıcı pipeline'da iki kritik adım yapamaz |

### 3.5 Billing Run Integrity

| Rule | Implementation |
|------|---------------|
| Contract snapshot at run start | Run initiated → aktif contract/formula version'ları JSON olarak saklanır |
| Deterministic obligation generation | Aynı snapshot + aynı declaration → aynı obligation amount (idempotent) |
| Platform-internal idempotency | line_hash (SHA256) per obligation — duplicate detection |
| Stripe-level idempotency | Idempotency-Key header per invoice API call |
| Re-run safety | Cancelled run → full rerun; Completed run → delta only |
| Partial cancel support | Tenant bazlı cancel — diğer tenant'ların obligation'ları etkilenmez |

---

## 4. OBSERVABILITY

### 4.1 Logging

| Type | Approach | Retention |
|------|----------|-----------|
| Application | NestJS Logger → structured JSON | 30 days |
| Audit | PostgreSQL audit_log table | 7 years |
| Webhook | webhook_event_log table | 90 days |
| BullMQ jobs | Redis + application log | 30 days |

### 4.2 Metrics & Alerts

| Metric | Alert Threshold |
|--------|:---------------:|
| API P95 latency | >1s |
| Billing run duration | >2x expected |
| Stripe error rate | >5% in 5 min |
| BullMQ queue depth | >100 jobs |
| Webhook processing lag | >5 min |
| Failed invoice rate per run | >10% |
| PostgreSQL connections | >80% pool |

### 4.3 Health Checks

```
GET /health           → liveness (always 200 if process alive)
GET /health/ready     → readiness (DB + Redis + Stripe connectivity)
```

---

## 5. DATA RETENTION

| Data | Active | Archive | Legal Min |
|------|--------|---------|-----------|
| Contracts | Indefinite | — | 10 years |
| Obligations | 3 years | Cold | 10 years |
| Invoice logs | 3 years | Cold | 10 years |
| Audit logs | 3 years | Cold | 7 years |
| Declarations | 2 years | Cold | 7 years |
| Webhook events | 90 days | Delete | — |
| Notifications | 1 year | Delete | — |
| Application logs | 30 days | Delete | — |

---

## 6. INFRASTRUCTURE (MVP)

| Component | Choice |
|-----------|--------|
| Database | PostgreSQL 15 (managed: RDS/Cloud SQL/Supabase) |
| Cache + Queue | Redis 7 (managed) |
| Containers | Docker Compose (dev), single server or K8s (prod) |
| CI/CD | GitHub Actions |
| Email | SendGrid or AWS SES |
| Monitoring | Cloud-native (CloudWatch/Cloud Monitoring) or self-hosted (Grafana) |
| Secret management | Environment variables → upgrade to Vault/AWS SM later |

---

## 7. DEVELOPMENT STANDARDS

| Area | Standard |
|------|----------|
| Code style | ESLint + Prettier |
| Commits | Conventional Commits |
| Branching | Git Flow (main, develop, feature/*, release/*) |
| PR review | Minimum 1 reviewer |
| Testing | Unit: Jest, Integration: Supertest, E2E: Playwright |
| Coverage target | 70% (business logic modules: 90%) |
| API docs | OpenAPI 3.0 (NestJS Swagger) |
| DB migrations | Prisma Migrate (forward-only) |
