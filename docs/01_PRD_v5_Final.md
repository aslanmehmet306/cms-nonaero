# 📘 PRODUCT REQUIREMENTS DOCUMENT
## Non-Aeronautical Revenue Management SaaS Platform

**Version:** v6.0 (Post-Review Edition)
**Target:** 50M+ Hub Airports
**Deployment:** Cloud Native, Multi-Airport, Multi-Tenant
**Invoice Provider:** Provider-Agnostic (MVP: Stripe Direct Account)
**Tech Stack:** NestJS + React + TypeScript + PostgreSQL
**Pilot Airport:** ADB (İzmir Adnan Menderes)
**Last Updated:** 2026-02-28
**Review Status:** Domain Expert Review Completed — decisions finalized

---

## 1. PRODUCT VISION

Bu platform: **Airport Non-Aeronautical Commercial Revenue Orchestration System**'dir.

ERP değildir. Basit billing sistemi değildir. AODB modülü değildir.

Bu sistem:
- Kontrat publish edildiğinde **obligation schedule otomatik üretir** (Zuora/Chargebee pattern)
- Tariff/Formula ile **expression-based** hesaplama yapar
- Multi-layer allocation yapar (Phase 2)
- Hybrid MAG settlement uygular (carry-forward yok, her ay bağımsız)
- **Charge type bazlı** ayrı invoice keser
- **Provider-agnostic invoice engine** üzerinden fatura oluşturur (MVP: Stripe, Phase 2: ERP adapter)
- **Asenkron queue-based** billing run çalıştırır (tenant bazlı tekil/toplu)
- Declaration gelmezse **o charge type'ı atlar**, alert gönderir
- Revenue declaration **KDV dahil brüt satış** üzerinden çalışır
- **Email + in-app** notification yapar
- AI ile gelir kaçaklarını ve anomalileri tespit eder (Phase 3)
- **Phase 1'de GİB/e-Fatura entegrasyonu yoktur** — Stripe invoice tek fatura belgesidir

---

## 2. CORE ARCHITECTURE PRINCIPLES

- Multi-Airport isolation (Phase 2, designed from day 1)
- Airport-level configuration independence
- Immutable contract & allocation versions
- Immutable invoice after finalization (Stripe-enforced)
- Service-centric design
- **Contract-driven obligation schedule generation**
- Idempotent billing (platform-internal + Stripe-level)
- **Asynchronous queue-based billing execution**
- **Invoice Provider Adapter pattern** (Stripe → ERP extensible)
- Audit explainability mandatory
- **Two separate frontend applications** (Admin Portal + Tenant Portal)
- **MAG settlement: no carry-forward, each month independent**
- **Revenue declarations: KDV dahil brüt satış (Gross)**

---

## 3. DOMAIN OBJECT MODEL

```
Airport (ADB)
→ Area Hierarchy (Terminal → Floor → Zone → Unit)
→ Service Definition (versioned, immutable after publish)
→ Formula (expression-based, versioned)
→ Contract (lifecycle-managed)
   → Obligation Schedule (auto-generated on publish)
      → Billing Run (async, queue-based)
         → Stripe Invoice (per charge type)
            → Payment (webhook-driven)
               → Settlement Ledger
→ Declaration (tenant-submitted, frozen at cut-off)
→ Billing Policy (airport-level)
→ Notification (email + in-app)
```

---

## 4. MODULE 1 – SERVICE DEFINITION ENGINE

### 🎯 Amaç
Airport'taki tüm charge'ları standardize edilmiş servis objelerine dönüştürmek.

### ⚙️ Nasıl Çalışır
Commercial Admin:
- Service type seçer (rent, revenue_share, service_charge, utility)
- Formula (expression) bağlar
- Default billing frequency tanımlar
- Default currency belirler (MVP: TRY only)
- Tax class atar
- Publish → immutable

### 📥 Input
- Service metadata
- Formula reference (expression ID)
- Escalation rule
- Default billing frequency

### 📤 Output
- Versioned service template
- Contract'a assign edilebilir charge

### 🔍 Edge Cases
- Service mid-year değişirse → new version, mevcut kontratlar etkilenmez
- Retroactive change yok
- Deprecated service → yeni kontrata atanamaz, mevcut devam eder

---

## 5. MODULE 2 – TARIFF & FORMULA ENGINE (Expression Parser)

### 🎯 Amaç
Tüm hesaplamaları **serbest expression-based** bir motor üzerinden yapmak.

### ⚙️ Engine: math.js Sandbox

Kullanıcı serbest matematiksel ifade yazar. Sistem parse eder, validate eder, çalıştırır.

### İzin Verilen Operasyonlar
- Aritmetik: `+`, `-`, `*`, `/`, `^`
- Fonksiyonlar: `min()`, `max()`, `round()`, `ceil()`, `floor()`, `if()`
- Karşılaştırma: `<`, `>`, `<=`, `>=`, `==`, `!=`
- Mantıksal: `and`, `or`, `not`

### 🧠 Context Variables
```
area_m2, days_in_period, days_in_year, sales_amount,
meter_kwh, pax, index_rate, base_amount,
annual_amount, rate_per_m2, monthly_rent
```

### Örnek Formüller
```
Basit kira:       area_m2 * rate_per_m2 * days_in_period / 365
Revenue share:    sales_amount * 0.08
Step/Band:        if(sales_amount <= 100000, sales_amount * 0.08,
                     100000 * 0.08 + (sales_amount - 100000) * 0.06)
Escalation:       base_amount * (1 + index_rate / 100)
Proration:        annual_amount * days_in_period / days_in_year
```

### Güvenlik
- `eval()` kesinlikle yok — math.js sandbox mode
- Max expression length: 2000 karakter
- Max evaluation time: 100ms timeout
- Recursive depth limit: 10
- Sadece whitelist'teki fonksiyonlar çalışır

### 📥 Input
- Expression string
- Variable definitions
- Effective dates

### 📤 Output
- Calculated amount
- Full calculation trace (her adım loglanır)
- Validation result

### 🔍 Edge Cases
- Syntax error → parse-time validation error
- Missing variable → block with clear error
- Division by zero → catch and report
- Negative result → credit candidate flag

---

## 6. MODULE 3 – FX & CURRENCY ENGINE (Phase 2)

MVP'de tek currency: **TRY**. Multi-currency Phase 2'de eklenecek.

---

## 7. MODULE 4 – EQUIPMENT & ASSET ENGINE (Phase 2)

MVP'de equipment/meter-based billing yok. Phase 2'de eklenecek.

---

## 8. MODULE 5 – ALLOCATION ENGINE (Phase 2)

MVP'de shared cost allocation yok. Phase 2'de eklenecek.

---

## 9. MODULE 6 – CONTRACT ENGINE (Commercial Digital Twin)

### 🎯 Amaç
Contract'ı çalıştırılabilir dijital modele dönüştürmek. **Publish anında obligation schedule otomatik üretilir.**

### İçerir
- Tenant assignment
- Area membership
- Included services (with optional overrides)
- Annual MAG amount
- Revenue share bands
- Effective dates (start → end)
- Billing frequency
- Responsible owner
- Escalation rule (manual index_rate input — CPI/ÜFE/sabit %)
- Deposit / guarantee metadata (Phase 2: teminat mektubu, depozito tutarı)

### Lifecycle
```
Draft → In Review → Published → Active → [Amended | Suspended | Terminated]
```
**Geçiş Koşulları:**
- Draft → In Review: tüm zorunlu alanlar dolu
- In Review → Published: farklı kullanıcı tarafından onay (SoD)
- Published → Active: signed_at dolu VE effective_from <= today
- Active → Amended: amendment tipi ve etki tarihi belirtilmeli

### ⚡ Contract Publish Trigger
Contract publish edildiğinde:
1. Tüm dönemler için obligation schedule üretilir
2. Rent obligation'ları **amount belli** → status: `scheduled`
3. Revenue share obligation'ları **declaration bekleniyor** → status: `pending_input`
4. MAG year-end true-up → status: `pending_calculation`
5. Her obligation'a due date atanır (billing policy'den)

### Amendment / Addendum Model
| Tip | Etki | Obligation Etkisi |
|-----|------|-------------------|
| Rate change | Sonraki tam period'dan geçerli | Gelecek obligation'lar yeniden hesaplanır |
| Area change | Sonraki tam period'dan geçerli | Mevcut + gelecek obligation'lar etkilenir |
| Service add/remove | Sonraki tam period'dan geçerli | Yeni obligation schedule eklenir/çıkarılır |
| Term extension | Yeni end date | Ek obligation'lar üretilir |

> ⚠️ **Phase 1 kararı — Proration:**
> - **Yeni kontrat başlangıcı:** Kontrat ayın ortasında başlarsa ilk dönem proration uygulanır (`annual_amount * days_in_period / days_in_year`).
> - **Amendment:** Mid-month proration yapılmaz. Amendment her zaman bir sonraki tam period'dan geçerli olur.
> - **Termination:** Son dönem MAG pro-rata hesaplanır.

### Termination Hesapları
- Erken fesihte: kalan scheduled obligation'lar → `cancelled`
- Son dönem pro-rata MAG settlement
- Depozito/teminat mektubu iadesi (Phase 2)
- Ceza bedeli hesaplama (Phase 2)

### Indexation / Escalation
- `index_rate` context variable'ı admin tarafından **manuel girilir**
- Otomatik TÜİK/CPI API entegrasyonu yok (Phase 1)
- Formula örneği: `base_amount * (1 + index_rate / 100)`
- Min/max cap desteği Phase 2'de eklenecek

### 🔍 Edge Cases
- Amendment → mevcut future schedule iptal, yeni version'dan yeni schedule (sonraki tam period'dan)
- Early termination → kalan scheduled obligation'lar `cancelled`, pro-rated MAG settlement
- Immutable after publish — sadece amendment ile değişiklik

---

## 10. MODULE 7 – OBLIGATION ENGINE

### 🎯 Amaç
Contract publish'te üretilen obligation schedule'ı yönetmek.

### Obligation States
| State | Meaning |
|-------|---------|
| `scheduled` | Tarih ve tutar belli, henüz due değil |
| `pending_input` | Declaration bekleniyor (revenue share) |
| `pending_calculation` | Hesaplama bekleniyor (MAG true-up) |
| `ready` | Hesaplandı, billing run'a alınabilir |
| `invoiced` | Stripe'da fatura kesildi |
| `settled` | Ödeme alındı |
| `skipped` | Declaration gelmedi, bu dönem atlandı |
| `on_hold` | Manuel olarak bekletiliyor |
| `cancelled` | İptal edildi (kontrat terminate / amend) |

### Obligation Türleri
- **Rent (Prepaid):** Contract publish'te amount belli, scheduled olarak üretilir
- **Revenue Share (Postpaid):** Declaration gelince amount hesaplanır
- **MAG Shortfall:** Monthly settlement'dan çıkar
- **MAG True-Up:** Year-end settlement'dan çıkar

### Declaration → Obligation Flow
```
Declaration frozen → Obligation amount hesaplanır (formula) → Status: ready
Declaration missing at cut-off → Obligation stays pending_input → skipped in billing run
```

---

## 11. MODULE 8 – HYBRID MAG SETTLEMENT ENGINE

### 🎯 Amaç
Aylık higher-of + yıllık true-up uygulamak.

### Monthly
```
Revenue Share (actual) vs (Annual MAG / 12)
→ Higher of → billing amount
→ If MAG > Revenue Share → shortfall obligation generated
```

### ⚠️ Carry-Forward Kuralı: YOK
- Her ay bağımsız değerlendirilir
- Bir ayda revenue share > MAG/12 olsa bile fazlalık sonraki aya **devredilmez**
- Örnek: MAG/12 = 100K, Mart rev share = 130K → Mart'ta 130K faturalanır, 30K fazla sonraki aya taşınmaz

### Year-End
```
YTD Revenue Share vs Pro-rated Annual MAG
→ If MAG > YTD Revenue Share → true-up obligation
→ If YTD Revenue Share > MAG → surplus (no action / credit)
```

### Settlement Timing
- Monthly settlement: billing run ile birlikte (cut-off sonrası)
- Year-end true-up: fiscal year kapanışından sonra, billing policy'deki due_date_days kuralına göre
- True-up obligation due date: billing policy'den hesaplanır

### 📤 Output
- Settlement ledger entries
- Shortfall / surplus amounts
- True-up obligation (if applicable)

---

## 12. MODULE 9 – TENANT PORTAL & DATA INGESTION

### 🎯 Amaç
Ayrı bir web uygulaması olarak revenue declaration & fatura yönetimi sunmak.

**URL:** `portal.airport-revenue.com` (ayrı app, ayrı auth)

### Features
- Revenue declaration (manual input)
- Excel upload (bulk declaration)
- Validation rules (aşağıda detaylı)
- Duplicate check
- Freeze after cut-off
- Declaration kanıt/ek doküman yükleme (POS raporu, Z raporu)
- Invoice görüntüleme (Stripe hosted URL)
- Ödeme geçmişi
- In-app notification center

### ⚠️ Declaration Kuralı: KDV Dahil Brüt Satış (Gross)
- Tenant'ın beyan ettiği `sales_amount` = KDV dahil brüt satış tutarı
- İadeler, indirimler, void'ler düşülmüş net satış DEĞİL
- Declaration form'da açıkça "KDV Dahil Brüt Satış Tutarı" label'ı gösterilecek

### Validation Rule Seti
| Kural | Aksiyon |
|-------|---------|
| Negatif satış tutarı | Reject |
| Önceki aya göre %50+ sapma | Warning (submit edilebilir ama flag) |
| Boş gün kontrolü (31 günlük ayda <20 gün) | Warning |
| Duplicate period + tenant + category | Reject |
| Sıfır satış tutarı | Warning (izin ver ama flag) |
| Currency mismatch (TRY dışı) | Reject (Phase 1) |

### 📤 Output
- Validated declaration → obligation amount trigger
- Frozen dataset token
- Attached evidence files (POS report, Z report)

### 🔍 Missing Declaration Policy
Cut-off'ta declaration yoksa:
- O obligation `pending_input` → `skipped`
- **O charge type için fatura üretilmez**
- Tenant'a email + in-app alert
- Commercial manager'a email + in-app alert
- Sonraki dönemde geç declaration → adjustment flow (Phase 2)

---

## 13. MODULE 10 – BILLING RUN ORCHESTRATOR (Async)

### 🎯 Amaç
Eligible obligation'ları **asenkron queue üzerinden** Stripe invoice'a dönüştürmek.

### Run Types
- Scheduled (cron-triggered)
- Manual (admin-triggered)
- Selective (filtered)
- Settlement (MAG)

### Flow (Queue-Based)
```
1. Admin triggers run (or cron fires) — tekil tenant veya toplu
2. BillingRun record created → status: initiated
3. Contract snapshot alınır (aktif version'lar kilitlenir)
4. Job → BullMQ "billing-run" queue
5. Worker: scope + collect eligible obligations
6. Worker: calculate amounts (formula evaluation) — deterministik
7. Status: draft_ready → Admin gets notification
8. Admin reviews preview → Approve or Reject
9. If approved → individual Stripe invoice jobs queued
10. Each job: create invoice per charge type per tenant
11. Stripe webhook → payment confirmation
12. Status: completed
```

### ⚡ Billing Run Tenant-Level Granularity
- **Başlatma:** Tekil tenant veya çoklu tenant seçerek run başlatılabilir
- **İptal:** Run içindeki belirli tenant(lar) için iptal yapılabilir (partial cancel)
- **Re-Run Politikası:**
  - Önceki run **iptal edilmişse** → aynı period için yeni run (full rerun)
  - Önceki run **iptal edilmemişse** → delta hesaplama (sadece yeni/değişen obligation'lar)
- **Snapshot:** Run başlarken contract version + formula version snapshot alınır, run süresince değişikliklerden etkilenmez

### Invoice Grouping: Per Charge Type
```
Tenant: ABC Duty Free, March 2026
├── Stripe Invoice #1: Base Rent → 1 invoice, rent lines
├── Stripe Invoice #2: Revenue Share → 1 invoice, rev share lines
└── (Phase 2) Invoice #3: Utility → 1 invoice, utility lines
```

### Queue Configuration
| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| billing-run | Scope & calculate | 1 per run |
| stripe-invoice | Stripe API calls | 5 parallel |
| webhook-processing | Webhook handling | 3 |
| notification | Email + in-app | 10 |

### Selective Filters
- Period, Charge type, Tenant, Zone, Responsible owner

---

## 14. MODULE 11 – INVOICE & PAYMENT ENGINE (Provider-Agnostic)

### 🎯 Amaç
Provider-agnostic invoice engine üzerinden fatura oluşturmak ve ödeme toplamak.

### Invoice Provider Adapter Pattern
```
InvoiceProviderAdapter (interface)
├── StripeProvider (MVP — tüm işlevsellik)
│   ├── createInvoice()
│   ├── finalizeInvoice()
│   ├── voidInvoice()
│   ├── handleWebhook()
│   └── getPaymentStatus()
├── ERPProvider (Phase 2 — extensible stub)
│   ├── exportInvoiceData() → ERP format
│   ├── importPaymentStatus() → batch reconciliation
│   └── generateEInvoice() → GİB/e-Fatura
└── MockProvider (testing)
```

> ⚠️ **Phase 1 kararı:** Sadece Stripe provider aktif. GİB/e-Fatura entegrasyonu yoktur. Stripe invoice tek fatura belgesidir. ERP adapter interface'i tanımlanır ama implement edilmez.

### Stripe Integration Model (MVP)

### Stripe Integration Model

**Customer Mapping:** Her tenant → Stripe Customer object

**Invoice Creation:** Per charge type per tenant per period

**Payment Collection:**
- `send_invoice` mode (tenant Stripe hosted page'den öder)
- Bank transfer / credit card (tenant seçer)

**Idempotency:** Key = `{billing_run_id}_{obligation_id}`

### Webhook Events
| Event | Platform Action |
|-------|----------------|
| `invoice.finalized` | Mark as issued, notify tenant |
| `invoice.paid` | Settlement ledger update, notify |
| `invoice.payment_failed` | Alert queue, retry |
| `invoice.overdue` | Alert tenant + finance |
| `invoice.voided` | Mark void in platform |

### 🔍 Edge Cases
- Stripe downtime → retry queue, exponential backoff
- Currency mismatch → validate before API call
- Duplicate prevention → idempotency key enforced
- Invoice immutable after finalization (Stripe-enforced)

---

## 15. MODULE 12 – ADJUSTMENT ENGINE (Phase 2)

MVP'de credit note/adjustment yok. Late declaration → sonraki dönemde düzeltme Phase 2'de.

---

## 16. MODULE 13 – BILLING POLICY ENGINE

### 🎯 Amaç
Airport bazlı takvim ve kuralları yönetmek.

### İçerir
- Cut-off day (e.g., her ayın 10'u)
- Invoice issue day
- Due date rule (e.g., net 30)
- Fiscal year start month
- Stripe payment terms mapping

### Obligation Schedule'a Etkisi
Contract publish'te obligation due date'leri billing policy'ye göre hesaplanır.

Versioned & approval required.

---

## 17. MODULE 14 – NOTIFICATION ENGINE

### 🎯 Amaç
Email + in-app bildirim yönetmek.

### Notification Matrix
| Event | Email | In-App | Recipient |
|-------|:-----:|:------:|-----------|
| Cut-off approaching (3 gün) | ✅ | ✅ | Tenant |
| Declaration missing at cut-off | ✅ | ✅ | Tenant + Commercial Mgr |
| Invoice created | ✅ | ✅ | Tenant |
| Payment received | ✅ | ✅ | Tenant + Finance |
| Payment failed | ✅ | ✅ | Tenant + Finance |
| Invoice overdue | ✅ | ✅ | Tenant + Finance |
| Billing run completed | ❌ | ✅ | Finance |
| Contract expiring (30 gün) | ✅ | ✅ | Commercial Mgr + Tenant |
| MAG shortfall detected | ❌ | ✅ | Finance + Commercial Mgr |

### Implementation
- Email: SendGrid / AWS SES (transactional)
- In-App: **SSE (Server-Sent Events)** notification center
- Queue: BullMQ "notification" queue
- Templates: email templates versioned

---

## 18. MODULE 15 – REPORTING & AUDIT TRACE

### 🎯 Amaç
Explainable billing + operational reports.

### Her invoice line için trace:
- Contract version
- Formula expression + version
- Calculation trace (her adım)
- Obligation source
- Declaration reference (if applicable)
- Stripe Invoice ID
- Payment status & timestamp

### MVP Reports
- Invoice list (filterable by tenant, period, status, charge type)
- Payment status dashboard
- Settlement ledger view
- MAG accrual status per contract
- Missing declaration report
- Billing run history

---

## 19. SYSTEM GUARANTEES

- No double invoicing (idempotency key per obligation — platform + Stripe level)
- Immutable invoices (Stripe-enforced after finalization)
- Immutable contract versions (amendment creates new version)
- **Obligation schedule generated on contract publish**
- **Billing run contract snapshot** — run başlarken aktif version kilitlenir
- **Deterministic obligation generation** — aynı input → aynı output
- Missing declaration → skip, never estimate
- Charge type based invoice separation
- Async billing execution (queue-resilient)
- **Tenant-level billing granularity** — tekil/toplu start ve cancel
- **Re-run policy:** cancelled run → full rerun, active run → delta
- **MAG: no carry-forward** — her ay bağımsız, fazlalık devredilmez
- **Revenue declaration: KDV dahil brüt satış (Gross)**
- **Invoice Provider Adapter** — Stripe (MVP), ERP extensible (Phase 2)
- **No GİB/e-Fatura** — Phase 1'de Stripe invoice = tek belge
- FX traceability guaranteed (Phase 2)
- Allocation residual never lost (Phase 2)
- Payment status always in sync (webhook-driven)
- Full audit trail on every financial operation

---

## 20. END-TO-END CORE FLOWS

### Contract → Obligation Schedule
```
Contract Created (Draft)
→ Areas & Services assigned
→ MAG & Revenue Share configured
→ Submit → Review → Approve → Publish
→ Obligation Schedule auto-generated for all periods
```

### Base Rent (Prepaid)
```
Obligation (scheduled) → Due date arrives → Billing Run picks up
→ Stripe Invoice (charge_type: base_rent) → Payment → Settled
```

### Revenue Share (Postpaid + Hybrid MAG)
```
Tenant submits declaration → Cut-off → Declaration frozen
→ Obligation amount calculated (formula)
→ MAG comparison (monthly higher-of)
→ Billing Run → Stripe Invoice (charge_type: revenue_share)
→ Payment → Settled
```

### Missing Declaration
```
Cut-off arrives → Declaration missing
→ Obligation stays pending_input → skipped
→ Alert: tenant + commercial manager
→ No invoice generated for that charge type
```

### Year-End MAG True-Up
```
Fiscal year end → YTD calculation
→ True-up obligation generated (if shortfall)
→ Settlement Run → Stripe Invoice → Payment
```

### Payment Reconciliation
```
Stripe Webhook (invoice.paid) → Settlement Ledger Update
→ Obligation status: settled → Reporting updated
```
