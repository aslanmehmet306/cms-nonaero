# 📋 PHASE 1 – MVP SCOPE DEFINITION
## Non-Aeronautical Revenue Management Platform

**Version:** v3.0 (Post-Review Edition)
**Last Updated:** 2026-02-28
**Tech Stack:** NestJS + React + TypeScript + PostgreSQL + BullMQ
**Pilot:** ADB (İzmir Adnan Menderes) — Dummy Data
**Review Status:** MVP/Deferred behaviors clarified, 8-output MVP defined

---

## 1. MVP HEDEF

ADB havalimanında, kontrat publish → obligation schedule → declaration → billing run → Stripe invoice → payment akışını uçtan uca çalıştırmak.

**Başarı Kriteri:** 5 dummy tenant ile 1 aylık tam billing cycle'ın sorunsuz tamamlanması.

---

## 2. MVP MODULE SCOPE

### Phase 1 – Core Billing (MVP) — 40 hafta (Solo Developer)

> ⚠️ **Revize Timeline:** Orijinal 20 haftalık plan solo geliştirici kapasitesine göre 40 haftaya uzatılmıştır. Detaylı haftalık plan için bkz: `12_Revised_Timeline_Solo_40w.md`

| Module | MVP Behavior | Deferred Behavior (Phase 2+) |
|--------|-------------|------------------------------|
| Service Definition | CRUD, versioning, publish/deprecate. Immutable after publish. Types: rent, revenue_share | service_charge, utility types deferred |
| Formula Engine | math.js expression parser, sandbox, dry-run. Serbest formül. Escalation: manual index_rate | Otomatik TÜİK/CPI API, min/max cap |
| Contract Engine | CRUD, area/service assign, MAG, lifecycle. Published/Active ayrımı. Amendment → sonraki tam period. **Publish → obligation schedule auto-gen. İlk dönem proration aktif.** | Deposit/guarantee management, ceza bedeli |
| Obligation Engine | 9 state (scheduled → settled). line_hash duplicate detection. tax_rate alanı | disputed, written_off states. ERP invoice ref |
| MAG Settlement | Monthly higher-of, year-end true-up. **Carry-forward YOK**, her ay bağımsız | Carry-forward/carry-back rules |
| Tenant Portal | **Ayrı app**, declaration (KDV dahil brüt satış), Excel upload, attachment upload (POS/Z raporu), invoice view. Validation rule seti | Audit sampling, exception management |
| Billing Run | **Async BullMQ**, contract snapshot, draft preview, approve. **Tenant bazlı tekil/toplu start ve cancel**. Re-run: cancelled→full, active→delta | Cross-period adjustment runs |
| Invoice Engine | **Provider-agnostic interface**. MVP: Stripe Direct. Per charge type. Idempotent. **GİB/e-Fatura YOK** | ERP adapter, e-Fatura/e-Arşiv |
| Billing Policy | Cut-off, due date, fiscal year. Obligation due dates from policy | Multi-policy per charge type |
| Notification | Email + in-app (SendGrid/SES + **SSE**). Template'ler: bkz `13_Email_Notification_Templates.md` | SMS, Slack integration |
| Reporting | Invoice list, payment status, audit trail, MAG status. Read-only | Advanced analytics, export |
| Auth | JWT, RBAC, separate admin/tenant auth. SoD enforced | SSO/SAML, OAuth API access |

### Phase 1'de OLMAYAN (Explicit Exclusions)
| Module | Phase | Reason | Stub/Placeholder |
|--------|-------|--------|-------------------|
| FX & Currency Engine | Phase 2 | MVP tek currency (TRY) | currency alanları mevcut, default TRY |
| Equipment & Asset Engine | Phase 2 | Meter-based billing yok | meter_reading enum var ama unused |
| Allocation Engine | Phase 2 | Shared cost dağıtımı yok | — |
| Adjustment Engine | Phase 2 | Credit note/late correction yok | parentObligationId mevcut |
| GİB / e-Fatura | Phase 2 | Stripe invoice = tek belge | ERPProvider interface tanımlı, unimplemented |
| Deposit / Guarantee Mgmt | Phase 2 | Sadece contract'ta metadata | depositAmount, guaranteeType alanları |
| AI Capabilities | Phase 3 | Önce veri biriksin | — |
| Multi-Airport | Phase 2 | Tek airport (ADB) ile başla | airport_id her yerde mevcut |

---

## 2.5. MVP 8 CORE DELIVERABLES

> Tek havalimanında temel kira + revenue share için gerçekçi MVP:

| # | Deliverable | Açıklama |
|---|------------|----------|
| 1 | **Service Definition** (basit) | rent + revenue_share + (opsiyonel) utility |
| 2 | **Formula** (low-code ama sınırlı) | rate table + threshold + min charge. Manual index_rate |
| 3 | **Contract** (minimal) | effective dates + version + area + services. Amendment → sonraki tam period |
| 4 | **Declaration ingestion** | CSV/Excel upload + validation rule seti + approval + attachment (POS/Z raporu). KDV dahil brüt satış |
| 5 | **Obligation generation** | deterministic + calc_trace + line_hash |
| 6 | **Billing run** | contract snapshot + approve + tenant bazlı start/cancel + re-run policy (cancelled→full, active→delta) |
| 7 | **Invoice provider adapter** | Stripe (aktif) OR ERP export mock (interface hazır, implement yok). GİB entegrasyonu YOK |
| 8 | **Audit trace & reporting** | obligation → source → formula → contract chain |

> ⚠️ FX, Equipment, Allocation, Adjustment, GİB, Deposit/Guarantee management Phase 2'ye ertelenmiştir. PRD'deki "Deferred Behavior" kolonları referans alınmalıdır.

---

## 3. MVP USER STORIES

### Commercial Admin
- Servis tanımlayabilir, formül yazabilir (expression), dry-run test edebilir
- Escalation için index_rate değerini manuel girebilir
- Kontrat oluşturabilir, alan ve servis atayabilir, MAG belirleyebilir
- **Kontrat publish ettiğinde obligation schedule'ın otomatik üretildiğini görebilir**
- Gelecek dönemlerin obligation listesini görebilir (forecasting)
- Amendment başlatabilir (type seçerek, sonraki tam period'dan geçerli)
- Missing declaration alert'lerini görebilir

### Finance User
- Billing policy (cut-off, due date) tanımlayabilir
- Billing run başlatabilir — **tekil tenant veya toplu** seçerek
- Billing run sonuçlarını review ve approve edebilir
- **Belirli tenant'lar için billing run'ı iptal edebilir** (partial cancel)
- **Re-run başlatabilir** (cancelled→full rerun, completed→delta)
- Settlement ledger'ı ve MAG accrual status'u görebilir (carry-forward yok)
- Audit trace'i her invoice line için inceleyebilir
- Overdue/failed payment alert'lerini görebilir

### Tenant (Ayrı Portal)
- Revenue declaration girebilir (manual + Excel upload) — **KDV dahil brüt satış tutarı**
- Declaration'a kanıt dokümanı yükleyebilir (POS raporu, Z raporu)
- Validation uyarılarını görebilir (sapma, sıfır satış vb.)
- Cut-off yaklaşırken uyarı alabilir (email + in-app)
- Kendi faturalarını görebilir (Stripe hosted URL)
- Ödeme yapabilir (Stripe payment page)
- Geçmiş ödemelerini görebilir
- In-app notification center kullanabilir

---

## 4. MVP TEKNİK SCOPE

### Monorepo (Turborepo)
```
airport-revenue/
├── apps/
│   ├── api/          NestJS Backend
│   ├── admin/        React Admin Portal
│   └── portal/       React Tenant Portal
├── packages/
│   ├── shared-types/ TypeScript interfaces
│   └── formula-engine/ math.js wrapper
├── prisma/           Schema + migrations + seed
└── docker/           Docker Compose
```

### Backend (apps/api)
- NestJS + TypeScript
- Prisma ORM + PostgreSQL
- BullMQ + Redis (async queues)
- Stripe SDK (Direct Account)
- class-validator (DTO validation)
- Passport.js (JWT auth)
- Single-airport, single-currency (TRY)

### Admin Portal (apps/admin)
- React 18 + TypeScript
- Shadcn/ui + Tailwind CSS
- TanStack Query + Zustand
- React Hook Form + Zod
- TanStack Table (data grids)
- Desktop-first responsive

### Tenant Portal (apps/portal)
- React 18 + TypeScript
- Shadcn/ui + Tailwind CSS
- Separate auth domain
- Mobile-friendly (tenants may use phone)
- Notification center component

### Infrastructure (MVP)
- Docker Compose (local dev + staging)
- PostgreSQL 15
- Redis 7
- GitHub Actions (CI/CD)
- Single cloud region

---

## 5. MVP SEED DATA (ADB – İzmir)

### Airport
- Code: ADB, Currency: TRY, Timezone: Europe/Istanbul

### Area Hierarchy
```
ADB (Airport)
├── Terminal: Domestic (DOM)
│   ├── Floor: Ground (G)
│   │   ├── Zone: Retail (R)
│   │   │   ├── Unit: DOM-G-R-001 (50 m²)
│   │   │   ├── Unit: DOM-G-R-002 (75 m²)
│   │   │   └── Unit: DOM-G-R-003 (120 m²)
│   │   └── Zone: Food & Beverage (FB)
│   │       ├── Unit: DOM-G-FB-001 (80 m²)
│   │       └── Unit: DOM-G-FB-002 (60 m²)
│   └── Floor: First (1)
│       └── Zone: Lounge (L)
│           └── Unit: DOM-1-L-001 (200 m²)
├── Terminal: International (INT)
│   ├── Floor: Ground (G)
│   │   ├── Zone: Duty Free (DF)
│   │   │   ├── Unit: INT-G-DF-001 (300 m²)
│   │   │   └── Unit: INT-G-DF-002 (150 m²)
│   │   └── Zone: Retail (R)
│   │       └── Unit: INT-G-R-001 (90 m²)
│   └── Floor: First (1)
│       └── Zone: Food & Beverage (FB)
│           ├── Unit: INT-1-FB-001 (100 m²)
│           └── Unit: INT-1-FB-002 (45 m²)
└── Terminal: CIP
    └── Floor: Ground (G)
        └── Zone: Lounge (L)
            └── Unit: CIP-G-L-001 (500 m²)
```

### Tenants (Dummy)
| Code | Name | Type | Area |
|------|------|------|------|
| TNT-001 | Aegean Duty Free | Duty Free | INT-G-DF-001 |
| TNT-002 | İzmir Coffee Co. | F&B | DOM-G-FB-001, INT-1-FB-001 |
| TNT-003 | BookWorld | Retail | DOM-G-R-001 |
| TNT-004 | SkyLounge Services | Lounge | CIP-G-L-001 |
| TNT-005 | Mediterranean Bistro | F&B | INT-1-FB-002 |

### Sample Contracts
| Tenant | Type | Monthly Rent | Revenue Share | Annual MAG |
|--------|------|-------------|---------------|------------|
| TNT-001 | Duty Free | 45,000 TRY | 8% (step: >500K → 6%) | 1,200,000 TRY |
| TNT-002 | F&B | 12,000 TRY | 10% flat | 300,000 TRY |
| TNT-003 | Retail | 8,000 TRY | 7% flat | 150,000 TRY |
| TNT-004 | Lounge | 25,000 TRY | 5% flat | 500,000 TRY |
| TNT-005 | F&B | 5,000 TRY | 12% flat | 120,000 TRY |

### Sample Formulas
```
rent_per_m2:          area_m2 * rate_per_m2
revenue_share_flat:   sales_amount * share_rate
revenue_share_step:   if(sales_amount <= 500000, sales_amount * 0.08,
                         500000 * 0.08 + (sales_amount - 500000) * 0.06)
proration:            annual_amount * days_in_period / days_in_year
```

---

## 6. MVP MILESTONE TIMELINE (20 Weeks)

| Hafta | Milestone | Deliverables |
|-------|-----------|-------------|
| W1-2 | **Foundation** | Monorepo setup, Prisma schema, DB migration, seed data, auth module, Docker Compose |
| W3-4 | **Service & Formula** | Service Definition CRUD + versioning, Formula engine (math.js), dry-run API |
| W5-7 | **Contract & Obligation** | Contract CRUD + lifecycle, **publish → obligation schedule generation**, state machine |
| W8-9 | **MAG Settlement** | Monthly higher-of comparison, settlement ledger, year-end true-up logic |
| W10-12 | **Billing Run + Stripe** | BullMQ setup, billing run orchestrator, Stripe invoice create (per charge type), webhook handler |
| W13-14 | **Tenant Portal** | Separate React app, auth, declaration form, Excel upload, invoice view |
| W15-16 | **Admin Portal** | Dashboard, contract builder, formula editor, billing run management, approval flow |
| W17-18 | **Notification + Policy** | Email (SendGrid), in-app notifications, billing policy CRUD, cut-off enforcement |
| W19 | **Reporting + Audit** | Invoice list, payment status, audit trace, MAG status, missing declaration report |
| W20 | **Integration Test + UAT** | End-to-end flow test, 5 tenant full cycle, bug fixes |

---

## 7. GO / NO-GO CHECKLIST

- [ ] 5 dummy tenant ile 1 aylık billing cycle sorunsuz çalışmış
- [ ] Contract publish → obligation schedule otomatik üretilmiş (line_hash ile)
- [ ] Published → Active geçişi signed_at + effective_from koşuluna bağlı
- [ ] Declaration → obligation amount doğru hesaplanmış (KDV dahil brüt satış)
- [ ] Declaration validation kuralları çalışıyor (negatif, sapma, duplicate)
- [ ] Declaration attachment upload çalışıyor
- [ ] Missing declaration → skip + alert çalışmış
- [ ] Billing run async çalışmış, contract snapshot alınmış, draft preview doğru
- [ ] **Tekil tenant billing run** çalışıyor
- [ ] **Tenant bazlı partial cancel** çalışıyor
- [ ] **Re-run:** cancelled run sonrası full rerun çalışıyor
- [ ] **Re-run:** completed run sonrası delta run çalışıyor
- [ ] Stripe invoice per charge type oluşturulmuş (Invoice Provider Adapter üzerinden)
- [ ] Webhook → settlement ledger güncellenmiş
- [ ] Idempotency: platform-internal + Stripe-level duplicate yok
- [ ] Audit trail her invoice line için eksiksiz (obligation → formula → contract chain)
- [ ] MAG monthly comparison doğru, shortfall obligation üretilmiş, **carry-forward yok**
- [ ] Amendment → sonraki tam period'dan yeni schedule üretilmiş
- [ ] Email + in-app notification çalışmış
- [ ] Admin portal ve tenant portal ayrı çalışıyor
- [ ] SoD: contract creator ≠ approver, billing run creator ≠ approver
- [ ] Performance: 10 tenant billing run <30 saniye
