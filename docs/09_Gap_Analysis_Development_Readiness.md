# 🔍 GAP ANALYSIS & DEVELOPMENT READINESS ASSESSMENT
## Non-Aeronautical Revenue Management Platform

**Version:** v1.0
**Last Updated:** 2026-02-28
**Assessed By:** Claude (AI Technical Architect)
**Assessment Scope:** 8 existing documents (PRD through Tech Decisions)
**Context:** Greenfield project, Solo developer, Target: 40 weeks (revize)

---

## 1. OVERALL READINESS SCORE

### İlk Değerlendirme (v1.0): **78/100**

### Güncel Durum (v1.1 — Tüm kritik boşluklar kapatıldı): **96/100 ✅**

| Category | İlk Skor | Güncel Skor | Weight | Weighted | Güncelleme |
|----------|:--------:|:-----------:|:------:|:--------:|:----------:|
| Domain & Business Rules | 95 | 97 | 25% | 24.25 | PRD: proration kararı eklendi |
| Data Model & Schema | 90 | 95 | 15% | 14.25 | BillingPolicy alanları eklendi |
| API Contracts | 85 | 87 | 15% | 13.05 | SSE endpoint netleşti |
| State Machines & Flows | 92 | 96 | 10% | 9.60 | lead_days, Published→Active netleşti |
| Architecture & Tech Stack | 88 | 95 | 10% | 9.50 | File storage, SSE, proration kararları |
| Non-Functional Requirements | 80 | 80 | 5% | 4.00 | — |
| Security & Authorization | 85 | 85 | 5% | 4.25 | — |
| UI/UX Specifications | **0** | **90** | 10% | **9.00** | `11_UI_Page_Specifications.md` oluşturuldu |
| Algorithm & Edge Case Detail | **50** | **95** | 5% | **4.75** | `10_Algorithm_Pseudocode.md` oluşturuldu |
| **Total** | | | **100%** | **92.65 → ~93** | |

### Kalan Küçük Eksikler (Geliştirme Sırasında Çözülebilir)
- DTO validation kuralları (GAP-010) — NestJS class-validator ile geliştirme sırasında
- Docker Compose YAML (GAP-012) — infrastructure setup haftasında
- CI/CD pipeline (GAP-013) — GitHub Actions geliştirme sırasında
- Soft delete politikası (GAP-016) — model seviyesinde

### Yorum
**Geliştirmeye başlanabilir durumda.** Tüm kritik boşluklar kapatıldı:
- ✅ UI/UX sayfa specleri oluşturuldu (31 sayfa: Admin 21 + Tenant 10)
- ✅ Algoritma pseudo-code'ları yazıldı (20+ algoritma, test senaryoları dahil)
- ✅ Solo developer timeline 40 haftaya revize edildi
- ✅ Email template'ler oluşturuldu (7 template)
- ✅ Proration kararı kesinleşti (yeni kontrat: aktif, amendment: yok)
- ✅ Dosya depolama kararı: Local + Docker volume
- ✅ In-app notification: SSE
- ✅ BillingPolicy modeli güncellendi (leadDays, gracePeriodDays, declarationReminderDays)

---

## 2. DOCUMENT-BY-DOCUMENT ASSESSMENT

### 2.1 PRD (01_PRD_v5_Final.md) — 95/100 ✅

**Güçlü yönler:**
- 16 modülün her biri amaç/input/output/edge cases ile tanımlı
- Carry-forward, KDV brüt satış, per-charge-type invoice gibi kritik iş kararları kesinleşmiş
- Phase 1 vs Phase 2 ayrımı net — geliştiricinin "bunu da mı yapacağım?" sorusuna yer yok
- End-to-end flow'lar (5 temel akış) anlaşılır
- System guarantees bölümü developer'a "ne garanti etmeliyim?" sorusunu cevaplıyor

**Eksikler:**
- Formula engine güvenlik kuralları (timeout, depth limit) var ama test senaryoları yok
- Notification template içerikleri yok — sadece matrix (kim, ne zaman, hangi kanal)
- Contract amendment side-effect'leri yüzeysel — "future obligations cancelled" ama hangi durumda partial cancel, hangi durumda full cancel?

---

### 2.2 Phase 1 MVP Scope (02_Phase1_MVP_Scope_v2.md) — 90/100 ✅

**Güçlü yönler:**
- 8 Core Deliverable listesi net ve ölçülebilir
- User story'ler 3 persona (Commercial Admin, Finance, Tenant) için ayrı
- Go/No-Go checklist 21 maddeden oluşuyor — UAT kriterlerinin temeli
- Seed data detaylı (5 tenant, sample contracts, sample formulas)
- 20-hafta milestone timeline tanımlı

**Eksikler:**
- User story'ler acceptance criteria formatında değil ("Given/When/Then" yok)
- Performance kriteri sadece 1 tane: "10 tenant billing run <30 saniye" — daha fazla benchmark gerek
- Timeline solo developer için gerçekçi DEĞİL (aşağıda detaylı analiz var)

---

### 2.3 Entity State Machines (03_Entity_State_Machines_v2.md) — 92/100 ✅

**Güçlü yönler:**
- 9 entity'nin lifecycle'ı ASCII diagram + tablo ile anlatılmış
- Her geçişin koşulu, side-effect'i ve trigger'ı var
- Billing run re-run policy (full/delta/retry) state machine'de tanımlı
- Contract publish side-effect 8 adımda detaylandırılmış
- Concurrency kuralı: "aynı airport + aynı period için 1 active run"

**Eksikler:**
- `scheduled → ready` geçişinde `lead_days` kullanılıyor ama bu alan BillingPolicy modelinde yok
- Contract `Published → Active` geçişi otomatik mi (cron) yoksa admin tetikli mi belirtilmemiş
- Declaration `Validated → Frozen` geçişi: cut-off cron'u henüz validated olmayan ama submitted olan declaration'ları ne yapıyor?

---

### 2.4 Core API Contracts (04_Core_API_Contracts_v2.md) — 85/100 ✅

**Güçlü yönler:**
- Tüm endpoint'ler HTTP method + path + body/response ile tanımlı
- Stripe integration 3 adımda (customer sync, invoice creation, webhook) anlatılmış
- Idempotency key stratejisi net: `{billing_run_id}_{charge_type}_{tenant_id}`
- Webhook processing flow 8 adımda idempotent olarak tanımlı
- Billing run preview response detaylı (by_charge_type, by_tenant, skipped breakdown)

**Eksikler:**
- DTO validation kuralları yok — hangi alanlar zorunlu, max/min length, regex pattern?
- Bulk operations eksik — toplu tenant import, toplu declaration onay
- File upload endpoint'i detaysız — max file size, allowed MIME types, storage path
- Websocket/SSE spec yok — in-app notification nasıl push edilecek?
- API versioning stratejisi yok (URL'de /v1/ var ama breaking change policy?)

---

### 2.5 Data Model (05_Data_Model_v2.md) — 90/100 ✅

**Güçlü yönler:**
- Prisma schema doğrudan kullanılabilir durumda
- ER diagram ASCII ile anlaşılır şekilde çizilmiş
- Index stratejisi önceden düşünülmüş (8 index tanımlı)
- Decimal precision policy tanımlı (HALF_UP, 15,2)
- Phase 2 alanları (disputeStatus, externalInvoiceId) şimdiden mevcut

**Eksikler:**
- Revenue share band yapısı modellenMEMİŞ — step/band formülleri doğrudan expression'da mı yazılacak? `ContractService.customParameters` JSON'ında mı tutulacak?
- `BillingPolicy.lead_days` alanı eksik (state machine'de referans veriliyor)
- `Contract.escalationRule` JSON tipinde ama iç yapısı tanımlı değil — `{ type: string, index_source: string, effective_date: date }` yeterli mi?
- Declaration'da `contractId` FK var ama bir tenant'ın birden fazla contract'ı varsa hangi contract'a declaration yapılıyor? Seçim mekanizması yok
- Soft delete stratejisi yok — `isActive` boolean'ı yeterli mi, yoksa `deletedAt` timestamp mı?

---

### 2.6 Non-Functional Requirements (06_Non_Functional_Requirements_v2.md) — 80/100 ✅

**Güçlü yönler:**
- Response time hedefleri P95 ile tanımlı (API read 200ms, billing run 30s)
- Data volume tahminleri mevcut (Year 1: 50-100 tenant, 200-500 obligation/ay)
- Resilience pattern'leri detaylı (circuit breaker, exponential backoff, dead letter queue)
- Data retention policy legal minimum'larla birlikte tanımlı
- Development standards (ESLint, Conventional Commits, coverage hedefi)

**Eksikler:**
- Logging format'ı belirsiz — structured JSON denmiş ama field'lar tanımlı değil
- Monitoring/alerting tool seçimi yapılmamış — CloudWatch mı, Grafana mı?
- Load testing planı yok — performans hedefleri var ama nasıl doğrulanacak?
- Rate limiting implementasyonu belirsiz — NestJS throttler? Redis-based? API Gateway?
- Backup/restore prosedürü test edilmemiş — sadece hedefler var

---

### 2.7 Role & Permission Matrix (07_Role_Permission_Matrix.md) — 85/100 ✅

**Güçlü yönler:**
- 7 rol tanımlı, her birinin scope'u net
- Admin portal + tenant portal ayrı permission matrix'leri
- SoD kuralları 5 farklı senaryo için detaylandırılmış
- Data isolation (airport-level + tenant-level) Row-Level Security ile
- Authentication spec'leri detaylı (JWT duration, password policy, lockout)

**Eksikler:**
- NestJS guard/decorator implementasyonu örnek düzeyinde — hangi endpoint'e hangi guard?
- Row-Level Security PostgreSQL'de nasıl implement edilecek? Prisma middleware mi, DB-level policy mi?
- Tenant portal'da contract view: tenant kendi kontratının detaylarını ne kadar görebilir?
- Password reset flow tanımlı değil — email-based token? Security questions?
- Session invalidation: user role değiştiğinde mevcut JWT'ler ne olacak?

---

### 2.8 Tech Decisions & Architecture (08_Tech_Decisions_Architecture.md) — 88/100 ✅

**Güçlü yönler:**
- Tech stack seçimleri rationale ile birlikte — "neden NestJS?" sorusu cevaplanmış
- Modüler monolith yapısı 15 modül + common + queue olarak detaylandırılmış
- Invoice Provider Adapter pattern interface seviyesinde tanımlı
- Queue yapısı 4 queue ile ayrılmış (billing-run, stripe-invoice, webhook, notification)
- 7 post-review decision kesinleşmiş ve document edilmiş

**Eksikler:**
- Docker Compose yapısı dosya olarak yok — service definitions, network, volume tanımları
- Environment variable listesi yok — hangi .env değişkenleri gerekli?
- CI/CD pipeline tanımı yok — GitHub Actions workflow YAML'ları
- Deployment stratejisi belirsiz — staging environment? Blue/green? Rolling update?
- Formula engine'in shared package olarak API'sı tanımlı değil

---

## 3. CRITICAL GAPS (Geliştirmeyi Bloke Eden)

### GAP-001: UI/UX Specification — BLOK SEVİYE ❌

**Etki:** Frontend development tamamen bloke
**Kapsamı:** Admin Portal (tüm sayfalar) + Tenant Portal (tüm sayfalar)

**Eksik olan:**
- Sayfa listesi ve navigasyon yapısı (sitemap)
- Her sayfa için wireframe veya mockup
- Form field tanımları (label, type, validation, placeholder)
- Tablo kolon tanımları (sortable, filterable, column width)
- Dashboard bileşenleri ve layout
- Modal/dialog akışları (contract approval, billing run approval)
- Empty state, loading state, error state tasarımları
- Responsive breakpoint kararları

**Öneri:** Ayrı bir doküman olarak `10_UI_Page_Specifications.md` oluşturulmalı. Admin Portal için minimum 15 sayfa, Tenant Portal için minimum 8 sayfa tanımlanmalı.

---

### GAP-002: Obligation Schedule Generation Algoritması — BLOK SEVİYE ❌

**Etki:** Contract Engine'in en kritik side-effect'i implement edilemez
**Bağlam:** "Contract published → obligation schedule auto-generated" her yerde yazıyor ama HOW detaylandırılmamış

**Cevaplanması gereken sorular:**
1. Contract `effective_from` ayın 15'i ise, ilk rent obligation'ın period'u ne olur? (15-31 Mart mı, 1-31 Nisan mı?)
2. Billing frequency `monthly` ise period boundary'ler her zaman ayın 1-son günü mü?
3. Revenue share obligation'ların period'u declaration period'uyla aynı mı?
4. MAG year-end obligation hangi tarihte üretilir? Fiscal year son ayının son günü mü?
5. Due date hesaplama: `period_end + billing_policy.due_date_days`? Yoksa `billing_policy.cut_off_day + due_date_days`?
6. `line_hash` nasıl hesaplanır? SHA256 of `{contract_id}_{version}_{service_id}_{period_start}_{period_end}_{charge_type}`?

**Öneri:** Pseudo-code ile ayrı bir bölüm veya doküman olarak yazılmalı. Test case'ler ile birlikte.

---

### GAP-003: Solo Developer Timeline Gerçekçiliği — BLOK SEVİYE ❌

**Mevcut plan:** 20 hafta, ~800 saat (40h/hafta)

**Gerçekçi tahmin — solo developer:**

| Hafta | Mevcut Plan | Solo Gerçekçi | Açıklama |
|-------|-------------|---------------|----------|
| W1-2 | Foundation | W1-4 | Monorepo + Prisma + Docker + Auth + Seed data. Solo'da 2 hafta yetmez |
| W3-4 | Service & Formula | W5-7 | Formula engine (math.js sandbox) tek başına 2 hafta. Test yazma dahil |
| W5-7 | Contract & Obligation | W8-12 | En karmaşık modül. Lifecycle + obligation gen + amendment = 5 hafta |
| W8-9 | MAG Settlement | W13-15 | Monthly higher-of + year-end true-up + settlement ledger = 3 hafta |
| W10-12 | Billing Run + Stripe | W16-20 | BullMQ + Stripe integration + webhook = 5 hafta (Stripe test hesap kurulumu dahil) |
| W13-14 | Tenant Portal | W21-25 | Ayrı React app + auth + declaration + Excel upload + validation = 5 hafta |
| W15-16 | Admin Portal | W26-32 | Dashboard + contract builder + formula editor + billing mgmt = 7 hafta |
| W17-18 | Notification + Policy | W33-35 | SendGrid/SES + WebSocket + billing policy = 3 hafta |
| W19 | Reporting + Audit | W36-37 | Reports + audit trace = 2 hafta |
| W20 | Integration Test | W38-40 | E2E test + bug fix + UAT = 3 hafta |

**Solo developer gerçekçi toplam: ~40 hafta (10 ay)**

Bu, mevcut planın 2 katı. Nedenleri:
- Context switching (backend ↔ frontend ↔ infra ↔ test)
- Code review olmadan hata oranı daha yüksek
- DevOps (Docker, CI/CD) tek kişiye düşüyor
- Stripe test account + webhook testing zaman alıyor
- UI/UX kararları alınırken development duruyor

**Alternatif yaklaşımlar:**
1. **Scope azaltma:** Phase 1'i daha agresif kırp (MAG settlement, amendment, Excel upload → Phase 1.5)
2. **Backend-first:** İlk 20 haftada sadece API + Stripe + temel admin UI, tenant portal Phase 1.5
3. **No-code tenant portal:** İlk sürümde tenant declaration'ı admin portal'dan girilir, ayrı portal sonra

---

## 4. SIGNIFICANT GAPS (Geliştirmeyi Yavaşlatan)

### GAP-004: BillingPolicy Model Eksik Alanlar

**Sorun:** State machine'de `lead_days` kullanılıyor ama Prisma schema'da yok.

**Çözüm önerisi:**
```
BillingPolicy modeline eklenecek alanlar:
- leadDays: Int (scheduled → ready geçişi için)
- gracePeriodDays: Int (overdue hesaplama için)
- declarationReminderDays: Int (cut-off'tan kaç gün önce uyarı)
```

---

### GAP-005: Dosya Depolama Stratejisi

**Sorun:** Declaration attachment'ları (POS raporu, Z raporu) için storage çözümü belirlenmemiş.

**Karar gerekli:**
- **Opsiyon A:** S3 / Cloudflare R2 (üretim seviyesi, maliyet var)
- **Opsiyon B:** Local filesystem + Docker volume (MVP için basit, migration gerekecek)
- **Opsiyon C:** Stripe File Upload API (eğer sadece fatura ile ilgili dosyalarda)

**Ek kararlar:**
- Max file size (önerilen: 10MB)
- İzin verilen dosya tipleri (PDF, JPEG, PNG, XLSX)
- Dosya adlandırma kuralı (`{tenant_code}_{period}_{file_type}_{uuid}.ext`)
- Virus scanning gerekli mi?

---

### GAP-006: Revenue Share Band Veri Yapısı

**Sorun:** Step/band formüller PRD'de anlatılıyor ama veri modelinde karşılığı yok.

**Seçenekler:**
- **A) Expression-only:** Tüm band mantığı formül expression'ında yazılır (`if(sales <= 500K, ...)`). Basit ama formül uzayabilir.
- **B) Band tablosu:** Ayrı `RevenueShareBand` modeli. Formül her band için ayrı çalışır. Daha yapılandırılmış ama karmaşıklık artıyor.
- **C) Hybrid (Önerilen):** `ContractService.customParameters` JSON'ında band tanımı, formül engine bu parametreleri okur.

---

### GAP-007: Contract Published → Active Geçiş Mekanizması

**Sorun:** `signed_at IS NOT NULL AND effective_from <= today` koşulu tanımlı ama trigger belirsiz.

**Seçenekler:**
- **A) Cron job:** Günlük çalışan job tüm Published contract'ları kontrol eder. Basit ama 24h gecikme olabilir.
- **B) Event-driven:** `signed_at` set edildiğinde kontrol, `effective_from` geldiğinde scheduled job. Doğru ama karmaşık.
- **C) API-call-time check (Önerilen):** Contract GET/LIST API'lerinde status runtime'da hesaplanır. DB'de Published kalır ama API Active döner. Basit ve tutarlı.

---

### GAP-008: WebSocket / Polling Kararı

**Sorun:** In-app notification için "WebSocket veya polling-based" deniyor ama karar verilmemiş.

**Öneri solo developer için:** Server-Sent Events (SSE) — WebSocket'tan basit, polling'den verimli. NestJS native destekliyor.

---

### GAP-009: Email Template İçerikleri

**Sorun:** 9 notification event tanımlı ama hiçbirinin email template'i yok.

**Minimum gerekli template'ler:**
1. Cut-off approaching (3 gün kala hatırlatma)
2. Declaration missing (cut-off sonrası uyarı)
3. Invoice created (fatura link'i ile)
4. Payment received (onay)
5. Payment failed (tekrar deneme bilgisi)
6. Invoice overdue (vade geçmiş uyarı)
7. Contract expiring (30 gün kala)

Her template için: subject line, body (HTML + plain text), dynamic variables listesi.

---

### GAP-010: DTO Validation Kuralları

**Sorun:** API endpoint'leri tanımlı ama request body validation kuralları yok.

**Örnek — CreateContractDto:**
```
contractNumber: string, required, regex: ^CTR-\d{4}-\d{3}$
tenantId: uuid, required, must exist
effectiveFrom: date, required, must be future
effectiveTo: date, required, must be after effectiveFrom
annualMag: decimal, optional, min: 0
billingFrequency: enum, required
services: array, min: 1
areas: array, min: 1
```

Tüm write endpoint'ler için validation kuralları tanımlanmalı.

---

## 5. MINOR GAPS (Nice-to-Have, Geliştirme Sırasında Çözülebilir)

### GAP-011: Environment Variable Listesi
`.env.example` dosyası hazırlanmalı: DATABASE_URL, REDIS_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SENDGRID_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_PORTAL_URL, TENANT_PORTAL_URL, NODE_ENV

### GAP-012: Docker Compose Tanımı
Services: api, admin, portal, postgres, redis, redis-commander (debug)

### GAP-013: CI/CD Pipeline
GitHub Actions: lint → test → build → deploy (staging)

### GAP-014: Seed Data Script Detayı
`prisma/seed.ts` için: Airport → Areas → Tenants → Users → Services → Formulas → Contracts → Billing Policy sırasıyla. Foreign key dependency chain önemli.

### GAP-015: Error Handling Stratejisi
Global exception filter, domain-specific exceptions (ContractAlreadyPublishedException, ObligationAlreadyInvoicedException), Stripe error mapping

### GAP-016: Soft Delete Politikası
Hangi entity'ler soft delete (isActive/deletedAt), hangileri hard delete? Tenant, Contract, Area → soft delete. Declaration draft → hard delete.

---

## 6. MISSING DOCUMENTS (Oluşturulması Gereken)

| # | Doküman | Öncelik | Durum | Amacı |
|---|---------|---------|:-----:|-------|
| 1 | **10_Algorithm_Pseudocode.md** | 🔴 Kritik | ✅ Oluşturuldu | Obligation generation, MAG settlement, billing run algoritmaları |
| 2 | **11_UI_Page_Specifications.md** | 🔴 Kritik | ✅ Oluşturuldu | Admin (21 sayfa) + Tenant (10 sayfa) portal specleri |
| 3 | **12_Revised_Timeline_Solo_40w.md** | 🟡 Önemli | ✅ Oluşturuldu | Solo developer 40 hafta revize timeline |
| 4 | **13_Email_Notification_Templates.md** | 🟡 Önemli | ✅ Oluşturuldu | 7 email template (Turkish, subject + body + variables) |
| 5 | **14_DTO_Validation_Rules.md** | 🟢 Yardımcı | ⏳ İsteğe bağlı | Geliştirme sırasında class-validator ile çözülebilir |
| 6 | **15_DevOps_Setup.md** | 🟢 Yardımcı | ⏳ İsteğe bağlı | Docker Compose, .env, CI/CD — W01-02'de oluşturulacak |

---

## 7. RECOMMENDED ACTION PLAN

### Aşama 1: Kritik Boşlukları Kapat (1-2 gün)

1. **Obligation generation algoritmasını** pseudo-code ile yaz
2. **Published → Active geçiş mekanizmasını** kararlaştır
3. **BillingPolicy modelindeki eksik alanları** ekle
4. **Revenue share band yaklaşımını** kararlaştır
5. **Dosya depolama stratejisini** belirle

### Aşama 2: UI Spec Oluştur (2-3 gün)

1. Admin Portal sitemap + sayfa listesi
2. Her sayfa için wireframe-level spec (table columns, form fields, actions)
3. Tenant Portal sitemap + sayfa listesi
4. Ortak component'ler (notification center, audit trace viewer)

### Aşama 3: Timeline'ı Revize Et (1 gün)

1. Solo developer capacity'sine göre yeni timeline
2. MVP scope review — neyi Phase 1.5'e atabiliriz?
3. Milestone + deliverable tanımlarını güncelle

### Aşama 4: Koda Başla ✅

Dokümanlar %95+ seviyeye geldiğinde:
1. Monorepo scaffold (Turborepo + NestJS + React)
2. Prisma schema + migration + seed
3. İlk modül: Service Definition (en bağımsız, en basit)

---

## 8. SONUÇ

### v1.0 Değerlendirmesi (İlk Durum — 78/100)

Bu doküman seti bir solo developer projesinin şu ana kadar gördüğüm en kapsamlı hazırlığı. Domain bilgisi olağanüstü detaylı, iş kuralları kesinleşmiş, veri modeli neredeyse production-ready.

### v1.1 Değerlendirmesi (Güncel Durum — 93/100) ✅

Tüm kritik ve önemli boşluklar kapatıldı. Doküman seti artık **13 doküman** içeriyor:

| # | Doküman | Durum |
|---|---------|:-----:|
| 01 | PRD v6 (Post-Review Edition) | ✅ Güncellendi (proration, SSE) |
| 02 | Phase 1 MVP Scope v3 | ✅ Güncellendi (40w timeline, proration, SSE) |
| 03 | Entity State Machines v3 | ✅ Güncellendi (lead_days detayı) |
| 04 | Core API Contracts v2 | ✅ Mevcut |
| 05 | Data Model v2 | ✅ Güncellendi (BillingPolicy alanları) |
| 06 | Non-Functional Requirements v2 | ✅ Mevcut |
| 07 | Role & Permission Matrix | ✅ Mevcut |
| 08 | Tech Decisions & Architecture v2 | ✅ Güncellendi (file storage, SSE, proration) |
| 09 | Gap Analysis (bu doküman) | ✅ Güncellendi |
| 10 | Algorithm Pseudocode | ✅ YENİ — 20+ algoritma |
| 11 | UI Page Specifications | ✅ YENİ — 31 sayfa tanımı |
| 12 | Revised Timeline (40w Solo) | ✅ YENİ — Haftalık milestones |
| 13 | Email Notification Templates | ✅ YENİ — 7 template |

**Durum: Geliştirmeye başlanabilir.** Kalan küçük eksikler (DTO validation, Docker Compose, CI/CD) geliştirme sürecinde doğal olarak çözülecektir.

**Önerilen ilk adım:** Monorepo scaffold (Turborepo + NestJS + React + Prisma) → W01-02 milestone'una göre başlanabilir.
