# 🏗️ TECHNICAL DECISIONS & ARCHITECTURE
## Kesinleşmiş Teknoloji ve Tasarım Kararları

**Version:** v2.0 (Post-Review Edition)
**Last Updated:** 2026-02-28
**Status:** CONFIRMED + Domain Expert Review Decisions Added

---

## 1. TECH STACK

### Backend
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | **TypeScript** | Stripe SDK birinci sınıf destek, frontend ile dil birliği |
| Framework | **NestJS** | Enterprise-grade, modüler mimari, decorator-based DI, OpenAPI built-in |
| ORM | **Prisma** | Type-safe, migration yönetimi, PostgreSQL native support |
| Validation | **class-validator + class-transformer** | NestJS native, DTO validation |
| Queue | **BullMQ (Redis-backed)** | Asenkron billing run, webhook processing, retry logic |
| Testing | **Jest + Supertest** | Unit + integration + e2e |

### Frontend
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | **React 18 + TypeScript** | Ekosistem, component reuse |
| UI Library | **Shadcn/ui + Tailwind CSS** | Modern, customizable, lightweight |
| State | **TanStack Query + Zustand** | Server state + client state ayrımı |
| Forms | **React Hook Form + Zod** | Performant forms, type-safe validation |
| Tables | **TanStack Table** | Complex data grids, sorting, filtering |

### Infrastructure
| Component | Choice |
|-----------|--------|
| Database | PostgreSQL 15+ |
| Cache/Queue | Redis 7+ |
| Container | Docker |
| Orchestration | Docker Compose (dev), Kubernetes (prod) |
| CI/CD | GitHub Actions |
| Hosting | Cloud-agnostic (AWS/GCP/any) |

### External Services
| Service | Usage |
|---------|-------|
| Stripe (Direct Account) | Invoice, payment, customer management |
| SendGrid / AWS SES | Transactional email notifications |
| Redis | Queue (BullMQ) + cache |

---

## 2. APPLICATION ARCHITECTURE

### 2.1 Two Separate Applications

```
┌─────────────────────────────────────────┐
│            ADMIN PORTAL                  │
│  (admin.airport-revenue.com)             │
│  React + TypeScript                      │
│  Roles: Super Admin, Airport Admin,      │
│         Commercial Mgr, Finance, Auditor │
└──────────────┬──────────────────────────┘
               │ REST API (JWT Auth)
               ▼
┌─────────────────────────────────────────┐
│            BACKEND API                   │
│  (api.airport-revenue.com)               │
│  NestJS + TypeScript                     │
│  PostgreSQL + Redis (BullMQ)             │
│  Stripe SDK                              │
└──────────────┬──────────────────────────┘
               │ REST API (JWT Auth - separate domain)
               ▼
┌─────────────────────────────────────────┐
│           TENANT PORTAL                  │
│  (portal.airport-revenue.com)            │
│  React + TypeScript                      │
│  Roles: Tenant Admin, Tenant User        │
└─────────────────────────────────────────┘
```

### 2.2 Backend Modular Monolith

```
src/
├── modules/
│   ├── auth/                  # JWT, RBAC, guards
│   ├── airport/               # Airport & Area hierarchy
│   ├── tenant/                # Tenant CRUD + Stripe Customer sync
│   ├── service-definition/    # Service templates (versioned)
│   ├── formula/               # Expression parser + evaluator
│   ├── contract/              # Contract lifecycle + obligation schedule
│   ├── obligation/            # Obligation management
│   ├── settlement/            # MAG monthly + year-end
│   ├── billing-run/           # Orchestrator + queue jobs
│   ├── stripe-integration/    # Invoice create, webhook handler
│   ├── declaration/           # Tenant revenue/meter declarations
│   ├── billing-policy/        # Cut-off, due date, fiscal year
│   ├── notification/          # Email + in-app notifications
│   ├── reporting/             # Queries, audit trace
│   └── audit/                 # Immutable audit log
├── common/
│   ├── guards/
│   ├── interceptors/
│   ├── decorators/
│   ├── filters/
│   └── pipes/
├── queue/
│   ├── processors/
│   │   ├── billing-run.processor.ts
│   │   ├── stripe-invoice.processor.ts
│   │   └── notification.processor.ts
│   └── queue.module.ts
└── prisma/
    ├── schema.prisma
    └── migrations/
```

---

## 3. KEY DESIGN DECISIONS

### 3.1 Invoice Provider: Adapter Pattern (MVP: Stripe Direct)

**Karar:** Provider-agnostic invoice engine. MVP'de Stripe, Phase 2'de ERP adapter.

```
InvoiceProviderAdapter (interface)
├── StripeProvider (MVP — aktif)
├── ERPProvider (Phase 2 — stub/interface only)
└── MockProvider (testing)
```

**Stripe specifics:**
- Tek Stripe account, tüm tenant'lar Customer olarak yaratılır (stripe_customer_id → Tenant seviyesinde)
- MVP için yeterli, multi-airport phase'de Connect evaluate edilir
- Stripe API key: environment variable (secret manager)

**GİB/e-Fatura:** Phase 1'de YOK. Stripe invoice = tek fatura belgesidir. ERP adapter interface tanımlanır ama implement edilmez.

### 3.2 Formula Engine: Expression Parser (Opsiyon B)

Gerçek bir expression parser. Kullanıcı serbest formül yazabilir.

```
Implementation:
- math.js library (expression parsing + evaluation)
- Sandbox: sadece izin verilen variable ve fonksiyonlar
- Whitelist: +, -, *, /, min, max, round, ceil, floor, if
- Context variables injection at runtime
- Formula validation: parse-time check (syntax + variable existence)
- Formula test: dry-run with sample values

Örnekler:
- Basit kira:     area_m2 * rate_per_m2 * days_in_period / 365
- Revenue share:  sales_amount * 0.08
- Step/Band:      if(sales_amount <= 100000, sales_amount * 0.08, 
                     100000 * 0.08 + (sales_amount - 100000) * 0.06)
- Escalation:     base_amount * (1 + index_rate / 100)
- Proration:      annual_amount * days_in_period / days_in_year
```

**Güvenlik:**
- `eval()` kesinlikle yok
- math.js sandbox mode → sadece pure math, I/O yok
- Max expression length: 2000 char
- Max evaluation time: 100ms timeout
- Recursive depth limit: 10

### 3.3 Obligation Generation: Contract-Activated Schedule

**Zuora/Chargebee pattern:** Kontrat publish edildiğinde, tüm gelecek obligation'lar schedule olarak üretilir.

```
Contract Published (effective: 2026-03-01 → 2027-02-28)
│
├── Obligation Schedule Generated:
│   ├── 2026-03: Rent 15,000 TRY (due: 2026-03-05)
│   ├── 2026-04: Rent 15,000 TRY (due: 2026-04-05)
│   ├── ...
│   ├── 2027-02: Rent 15,000 TRY (due: 2027-02-05)
│   │
│   ├── 2026-03: Revenue Share (amount: TBD, due: 2026-04-15)
│   ├── 2026-04: Revenue Share (amount: TBD, due: 2026-05-15)
│   ├── ...
│   │
│   └── MAG Year-End True-Up (2027-01, amount: TBD)
│
└── Obligation States:
    - Rent: "scheduled" → amount known at creation
    - Revenue Share: "pending_input" → declaration bekleniyor
    - MAG True-Up: "pending_calculation" → year-end'de hesaplanacak
```

**Avantajlar:**
- Gelecek dönemlerin tüm yükümlülükleri görünür (forecasting)
- Cash flow projection mümkün
- Billing run sadece "due" olan obligation'ları alır
- Missing declaration tespiti kolay ("pending_input" kalan obligation = eksik declaration)

**Ek Obligation States (yeni):**
| State | Meaning |
|-------|---------|
| scheduled | Tarih ve tutar belli, henüz due değil |
| pending_input | Declaration bekleniyor (revenue share) |
| pending_calculation | Hesaplama bekleniyor (MAG true-up) |
| ready | Hesaplandı, billing run'a alınabilir |
| invoiced | Fatura kesildi |
| settled | Ödeme alındı |
| skipped | Declaration gelmedi, bu dönem atlandı |
| on_hold | Manuel olarak bekletiliyor |
| cancelled | İptal edildi (kontrat terminate) |

### 3.4 Billing Run: Asenkron (Queue-Based)

```
Admin clicks "Run" → API creates BillingRun record (status: initiated)
                    → Job pushed to BullMQ
                    → Worker picks up job
                    → Scoping (eligible obligations)
                    → Draft preview generated
                    → Status: draft_ready
                    → Admin reviews & approves
                    → Stripe invoice jobs queued (1 per invoice)
                    → Each job: create Stripe invoice + finalize
                    → Webhook confirms → settlement update
                    → Status: completed
```

**Queue Structure:**
| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| billing-run | Obligation collection & calculation | 1 (serial per run) |
| stripe-invoice | Individual Stripe API calls | 5 (parallel) |
| webhook-processing | Stripe webhook handling | 3 |
| notification | Email + in-app sends | 10 |

### 3.5 Invoice Grouping: Per Charge Type

Bir tenant'ın aynı dönemde birden fazla obligation türü varsa, **her charge type için ayrı invoice** kesilir.

```
Tenant: ABC Duty Free, March 2026
├── Invoice #1: Base Rent
│   └── Line: Unit T1-A-101, 15,000 TRY
├── Invoice #2: Revenue Share
│   └── Line: Revenue Share 8%, 24,000 TRY
└── Invoice #3: Service Charge (Phase 2)
    └── Line: Common area maintenance, 3,200 TRY
```

**Stripe metadata ile grouping:**
```json
{
  "charge_type": "base_rent",
  "contract_id": "CTR-2026-001",
  "period": "2026-03"
}
```

### 3.6 Missing Declaration Policy: Skip & Alert

Declaration gelmezse o charge type için fatura **üretilmez**.

```
Cut-off day arrives (e.g., 10th of month)
│
├── Tenant ABC: declaration submitted ✅ → obligation ready → billing run includes
├── Tenant XYZ: declaration missing ❌ → obligation stays "pending_input"
│   ├── Obligation marked as "skipped" for this billing run
│   ├── Alert: email to tenant + in-app notification
│   ├── Alert: email to commercial manager
│   └── Next period: still pending, can be submitted late → adjustment flow
```

### 3.7 Notification: Email + In-App

| Event | Email | In-App | Recipient |
|-------|:-----:|:------:|-----------|
| Cut-off approaching (3 days) | ✅ | ✅ | Tenant |
| Declaration missing at cut-off | ✅ | ✅ | Tenant + Commercial Mgr |
| Invoice created | ✅ | ✅ | Tenant |
| Payment received | ✅ | ✅ | Tenant + Finance |
| Payment failed | ✅ | ✅ | Tenant + Finance |
| Invoice overdue | ✅ | ✅ | Tenant + Finance |
| Billing run completed | ❌ | ✅ | Finance |
| Contract expiring (30 days) | ✅ | ✅ | Commercial Mgr + Tenant |
| MAG shortfall detected | ❌ | ✅ | Finance + Commercial Mgr |

### 3.8 Pilot Airport: ADB (İzmir Adnan Menderes)

- Dummy data ile başlayacağız
- Airport code: ADB
- Currency: TRY
- Timezone: Europe/Istanbul
- Fiscal year: January-December
- Seed: 3 terminal, sample zones/units, 5-10 dummy tenants

---

## 4. MONOREPO STRUCTURE

```
airport-revenue/
├── apps/
│   ├── api/                    # NestJS Backend
│   ├── admin/                  # React Admin Portal
│   └── portal/                 # React Tenant Portal
├── packages/
│   ├── shared-types/           # Shared TypeScript types/interfaces
│   ├── ui-components/          # Shared UI components (if any)
│   └── formula-engine/         # Formula parser (shared between api & admin preview)
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.admin
│   └── Dockerfile.portal
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                 # ADB dummy data
├── docs/                       # All PRD & design docs
├── .github/
│   └── workflows/
├── turbo.json                  # Turborepo config
├── package.json
└── README.md
```

**Monorepo Tool:** Turborepo — parallel builds, shared deps, caching

---

## 5. POST-REVIEW DECISIONS (Domain Expert Review — Confirmed)

### 5.1 MAG Settlement: No Carry-Forward

**Karar:** Her ay bağımsız değerlendirilir. Fazlalık sonraki aya devredilmez.

```
monthly_result = max(revenue_share_actual, annual_mag / 12)
```

- Mart: MAG/12 = 100K, rev share = 130K → faturalanır 130K. 30K fazla taşınmaz.
- Nisan: MAG/12 = 100K, rev share = 70K → faturalanır 100K. 30K shortfall.
- Year-end: YTD sum comparison ile true-up hesaplanır.

### 5.2 Revenue Declaration: KDV Dahil Brüt Satış (Gross)

**Karar:** `sales_amount` context variable = KDV dahil brüt satış tutarı.

- Revenue share, gross tutar üzerinden hesaplanır.
- Declaration form'da açıkça "KDV Dahil Brüt Satış Tutarı" label'ı gösterilir.
- DeclarationLine: `grossAmount` (KDV dahil), `deductions` (bilgi amaçlı), `amount` (hesaplamada kullanılan = grossAmount).

### 5.3 Billing Run: Tenant-Level Granularity + Re-Run Policy

**Karar:**
- Billing run'lar tenant bazında tekil veya toplu başlatılabilir
- Run içindeki belirli tenant(lar) için partial cancel yapılabilir
- Re-run policy:
  - Önceki run **cancelled** → `full` mode (sıfırdan)
  - Önceki run **completed** → `delta` mode (sadece yeni/değişen)
- Her run başında **contract snapshot** alınır (deterministik hesaplama)

### 5.4 Amendment: Sonraki Tam Period

**Karar:** Mid-month proration yapılmaz. Amendment her zaman sonraki tam period başından geçerli olur.

- Amendment type: rate_change, area_change, service_change, term_extension
- Effective date = sonraki ayın 1'i (en erken)
- Önceki period'ların obligation'ları etkilenmez

### 5.5 Escalation: Manuel Index Input

**Karar:** `index_rate` değeri admin tarafından manuel girilir. Otomatik TÜİK/CPI API entegrasyonu yoktur.

### 5.6 Stripe Customer ID: Tenant Seviyesinde

**Karar:** `stripe_customer_id` Tenant entity'sinde tutulur (contract'ta değil). Multi-contract tenant'larda tek customer objesi.

### 5.7 GİB/e-Fatura: Phase 1'de Yok

**Karar:** Stripe invoice Phase 1'de tek fatura belgesidir. GİB entegrasyonu yoktur. ERPProvider interface tanımlanır ama implement edilmez.

### 5.8 File Storage: Local + Docker Volume (MVP)

**Karar:** Declaration attachment'ları (POS raporu, Z raporu vb.) local filesystem + Docker volume üzerinde saklanır.

```
Yapı:
/data/uploads/{airport_code}/{tenant_code}/{year}/{month}/
  ├── {declaration_id}_{original_filename}
  └── ...

Volume Config (docker-compose):
volumes:
  - upload-data:/data/uploads

Kısıtlamalar:
- Max dosya boyutu: 10 MB
- İzin verilen formatlar: .pdf, .xlsx, .xls, .csv, .jpg, .png
- Dosya adı sanitization: UUID prefix + original name

Migration Path (Phase 2):
- FileStorageAdapter interface tanımlanır
- LocalStorageProvider (MVP — aktif)
- S3Provider / R2Provider (Phase 2 — stub)
```

### 5.9 In-App Notification: SSE (Server-Sent Events)

**Karar:** Real-time in-app bildirimler SSE üzerinden iletilir.

```
Neden SSE (WebSocket yerine):
- Tek yönlü iletişim yeterli (server → client)
- HTTP/2 üzerinde multiplexing
- Auto-reconnect built-in
- Daha basit implementasyon (NestJS @Sse decorator)
- Firewall/proxy uyumluluğu daha iyi

Endpoint: GET /api/notifications/stream
Headers: Content-Type: text/event-stream
Auth: JWT token (query param veya cookie)

Fallback: SSE desteklenmezse polling (30 saniye interval)
```

### 5.10 Proration: İlk Dönem Aktif

**Karar:** Yeni kontrat ayın ortasında başlarsa ilk dönem proration uygulanır.

```
Kapsam:
- Yeni kontrat başlangıcı: Proration UYGULANIR
  → annual_amount * days_in_period / days_in_year
- Amendment: Proration UYGULANMAZ (sonraki tam period'dan)
- Termination: Son dönem MAG pro-rata hesaplanır

Örnek:
Contract effective_from = 2026-03-15
İlk dönem: 15 Mart – 31 Mart (17 gün)
Rent: annual_rent * 17 / 365
Revenue share obligation: normal (pending_input)
```
