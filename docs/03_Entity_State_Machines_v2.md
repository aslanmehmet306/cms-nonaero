# 🔄 ENTITY STATE MACHINES
## Core Entity Lifecycle Definitions

**Version:** v3.0 (Post-Review Edition)
**Last Updated:** 2026-02-28
**Review Status:** Published/Active split, Phase 2 states, re-run transitions added

---

## 1. CONTRACT LIFECYCLE

```
[Draft] → [In Review] → [Published] → [Active]
                              │              │
                              │    ┌─────────┼──────────┐
                              │    ▼         ▼          ▼
                              │ [Amended]  [Suspended]  [Terminated]
                              │    │           │
                              │    ▼           ▼
                              │ [New Draft]  [Active] (resume)
                              │
                         (signed_at dolu VE
                          effective_from <= today)
```

| State | Description | Allowed Actions | System Side Effects |
|-------|-------------|-----------------|---------------------|
| Draft | İlk oluşturma, düzenleme | Edit, Delete, Submit | — |
| In Review | Onay bekliyor (farklı kullanıcı onaylar — SoD) | Approve, Reject (→ Draft) | — |
| Published | Onaylandı, schedule üretildi ama henüz aktif değil | Activate (auto/manual) | **⚡ Obligation schedule auto-generated** |
| Active | İmzalandı ve effective_from geçti, canlı | Amend, Suspend, Terminate | Billing run'a dahil |
| Amended | Yeni version oluşturuluyor | → New Draft (linked) | Future obligations → cancelled (sonraki tam period'dan) |
| Suspended | Geçici durdurma | Resume, Terminate | Future obligations → on_hold |
| Terminated | Sona ermiş | — (immutable) | Remaining obligations → cancelled, MAG pro-rated |

### ⚡ State Transition Koşulları
| Geçiş | Koşul |
|--------|-------|
| Draft → In Review | Tüm zorunlu alanlar dolu (tenant, area, service, dates) |
| In Review → Published | Farklı kullanıcı onayı (approved_by ≠ created_by) |
| Published → Active | `signed_at` IS NOT NULL AND `effective_from <= today` |
| Active → Amended | Amendment type + effective date (sonraki tam period başı) belirtilmeli |
| Active → Terminated | termination_date + reason belirtilmeli |

### ⚡ Publish Side Effect (Critical)
```
Contract → Published:
  1. Tüm dönemler için obligation records üretilir
  2. Rent obligations: status = "scheduled", amount = hesaplanmış
  3. Revenue share obligations: status = "pending_input"
  4. MAG year-end: status = "pending_calculation"
  5. Due date'ler billing policy'den hesaplanır
  6. Her obligation'a line_hash üretilir (duplicate detection)
  7. Audit log: "obligation_schedule_generated"
  8. Notification: commercial manager'a bilgi
```

### Amendment Side Effect
```
Contract → Amended:
  1. Amendment type belirlenir (rate_change, area_change, service_change, term_extension)
  2. Effective date = sonraki tam period başı (mid-month proration YOK)
  3. Effective date'ten sonraki tüm future obligations → cancelled
  4. Yeni contract version draft oluşturulur (previous_version_id bağlanır)
  5. Yeni version publish edildiğinde yeni obligation schedule üretilir
  6. Audit log: "contract_amended", amendment_type, effective_date
```

---

## 2. SERVICE DEFINITION LIFECYCLE

```
[Draft] → [Published] → [Deprecated]
```

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| Draft | Düzenleniyor | Edit, Publish |
| Published | Aktif, kontrat'a atanabilir | Deprecate, New Version |
| Deprecated | Yeni kontrat'a atanamaz | — (mevcut devam eder) |

---

## 3. FORMULA LIFECYCLE

```
[Draft] → [Published] → [Archived]
```

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| Draft | Düzenleniyor, dry-run test edilebilir | Edit, Test, Publish |
| Published | Aktif, service'e bağlanabilir | Archive, New Version |
| Archived | Artık yeni service'e bağlanamaz | — |

---

## 4. OBLIGATION LIFECYCLE (Updated — 9 States + 2 Phase 2 Reserved)

```
Contract Published
       │
       ├── Rent: ──────────► [scheduled] ──► [ready] ──► [invoiced] ──► [settled]
       │                                                      │
       ├── Rev Share: ──────► [pending_input] ──► [ready] ──► [invoiced] ──► [settled]
       │                          │
       │                     (cut-off, no declaration)
       │                          │
       │                          ▼
       │                      [skipped]
       │
       ├── MAG True-Up: ───► [pending_calculation] ──► [ready] ──► [invoiced] ──► [settled]
       │
       └── (Amendment/Termination)
                 │
                 ▼
            [cancelled]
                
       Any state: ──► [on_hold] ──► (previous state)
```

| State | Description | Trigger to Next | Billing Run Picks Up? |
|-------|-------------|----------------|:---------------------:|
| `scheduled` | Tarih ve tutar belli, due date gelmedi | Due date arrives | ❌ |
| `pending_input` | Declaration bekleniyor | Declaration frozen | ❌ |
| `pending_calculation` | MAG hesaplama bekleniyor | Year-end settlement | ❌ |
| `ready` | Amount hesaplandı, due olmuş | Billing run scope | ✅ |
| `invoiced` | Stripe invoice kesildi | Stripe webhook (paid) | ❌ |
| `settled` | Ödeme alındı | — (terminal) | ❌ |
| `skipped` | Declaration gelmedi, atlandı | — (terminal for this period) | ❌ |
| `on_hold` | Manuel olarak bekletiliyor | Admin release | ❌ |
| `cancelled` | İptal (contract amend/terminate) | — (terminal) | ❌ |
| `disputed` | *(Phase 2)* İtiraz edildi | Resolution → ready/cancelled | ❌ |
| `written_off` | *(Phase 2)* Tahsil edilemez | — (terminal) | ❌ |

### State Transition Rules

**scheduled → ready:**
```
Condition: current_date >= obligation.due_date - billing_policy.lead_days (default: 5 gün)
Action: Move to ready, available for next billing run
Trigger: Daily cron job (00:15 UTC)
Note: lead_days alanı BillingPolicy modelinde tanımlıdır
```

**pending_input → ready:**
```
Condition: declaration.status == "frozen" AND amount calculated
Action: Run formula with declaration data, set amount, move to ready
```

**pending_input → skipped:**
```
Condition: cut_off_date passed AND no declaration submitted
Action: Mark skipped, send alert (email + in-app) to tenant + commercial mgr
```

**pending_calculation → ready:**
```
Condition: Year-end settlement calculation completed
Action: Set true-up amount, move to ready
```

**ready → invoiced:**
```
Condition: Billing run approved, Stripe invoice finalized
Action: Link to invoice_log, set invoiced_at timestamp
```

**invoiced → settled:**
```
Condition: Stripe webhook invoice.paid received
Action: Update settlement ledger, set settled_at timestamp
```

**any → on_hold:**
```
Condition: Admin manually holds obligation
Action: Exclude from billing run until released
```

**any → cancelled:**
```
Condition: Contract amended or terminated
Action: All future scheduled/pending obligations cancelled
```

---

## 5. BILLING RUN LIFECYCLE

```
[Initiated] ──► [Scoping] ──► [Calculating] ──► [Draft Ready]
                                                      │
                                               ┌──────┼──────┐
                                               ▼      │      ▼
                                          [Approved]   │  [Rejected]
                                               │       │      │
                                               ▼       │      ▼
                                          [Invoicing]  │  [Cancelled]
                                               │
                                        ┌──────┼──────┐
                                        ▼             ▼
                                   [Completed]   [Partial]
                                                      │
                                                      ▼
                                              [Completed w/ Errors]
```

| State | Description | Next |
|-------|-------------|------|
| Initiated | Run oluşturuldu, BullMQ job queued | → Scoping (auto) |
| Scoping | Eligible obligations toplanıyor | → Calculating (auto) |
| Calculating | Formula evaluation yapılıyor | → Draft Ready (auto) |
| Draft Ready | Preview hazır, admin review bekliyor | Approve / Reject |
| Approved | Stripe invoice creation başlayacak | → Invoicing (auto) |
| Rejected | Admin reddetti | → Cancelled veya yeni run |
| Invoicing | Stripe API calls devam ediyor | → Completed / Partial |
| Completed | Tüm invoices başarılı | — (terminal) |
| Partial | Bazı invoices failed | Retry failed → Completed |
| Cancelled | Run iptal edildi | — (terminal) |

### Concurrency Rule
- Aynı airport + aynı period için sadece 1 active billing run olabilir
- Yeni run başlatmak için mevcut run completed/cancelled olmalı

### Re-Run Policy
| Senaryo | Run Mode | Davranış |
|---------|----------|----------|
| Önceki run **cancelled** | `full` | Sıfırdan tüm eligible obligation'ları toplar |
| Önceki run **completed** | `delta` | Sadece yeni/değişen obligation'ları hesaplar |
| Önceki run **partial** (bazı invoice failed) | `retry` | Sadece failed invoice'ları yeniden dener |

### Tenant-Level Operations
- **Başlatma:** `tenant_ids` filtresi ile tekil veya çoklu tenant seçerek run başlatılabilir
- **Partial Cancel:** Run içindeki belirli tenant(lar)ın obligation + invoice'ları iptal edilebilir
- **Cancel sonrası:** İptal edilen tenant'lar için `full` modda yeniden run başlatılabilir

### Contract Snapshot
- Billing run `initiated` state'ine geçtiğinde **contract_snapshot** alınır
- Snapshot: aktif contract version ID'leri + formula version ID'leri
- Run süresince yapılan contract amendment'lar bu run'ı **etkilemez**
- Deterministic: aynı snapshot + aynı declaration → aynı obligation amount

---

## 6. INVOICE LIFECYCLE (Stripe-Managed)

```
[Created] ──► [Finalized] ──► [Sent] ──► [Paid]
                                 │
                            [Past Due] ──► [Paid]
                                 │
                          [Uncollectible]
                                 │
                             [Voided]
```

| State | Source | Platform Action |
|-------|--------|-----------------|
| Created | Stripe API call | Log, link to billing run |
| Finalized | Stripe auto_advance | Mark as issued, immutable |
| Sent | Stripe delivery | — |
| Paid | Stripe webhook | **Settlement ledger update**, notify |
| Past Due | Stripe overdue | Alert tenant + finance |
| Uncollectible | Stripe/manual | Finance review queue |
| Voided | Stripe/manual | Void record in platform |

Platform invoice state = Stripe'dan webhook ile senkronize. Stripe is source of truth.

---

## 7. DECLARATION LIFECYCLE

```
[Draft] ──► [Submitted] ──► [Validated] ──► [Frozen]
                                │
                           [Rejected] ──► [Draft]
```

| State | Description | Trigger |
|-------|-------------|---------|
| Draft | Tenant giriyor/düzenliyor | Manual save |
| Submitted | Cut-off öncesi gönderildi | Tenant submit action |
| Validated | System validation geçti | Auto-validation rules |
| Rejected | Validation failed | → back to Draft with error details |
| Frozen | Cut-off sonrası kilitlendi | Cut-off date cron job |

### Cut-Off Enforcement
```
cut_off_date - 3 days: Alert (email + in-app) → "Declaration deadline approaching"
cut_off_date: 
  - Submitted declarations → Frozen
  - Missing declarations → Obligation stays pending_input → skipped in billing run
  - Alert (email + in-app) → "Declaration missing, invoice will not be generated"
```

---

## 8. MAG SETTLEMENT LIFECYCLE

```
[Period Open] ──► [Accruing] ──► [Period Closed] ──► [Monthly Settled]
                                                            │
                                                     (12 months)
                                                            │
                                                            ▼
                                                   [Year-End Eligible]
                                                            │
                                                            ▼
                                                   [True-Up Complete]
```

| State | Meaning |
|-------|---------|
| Period Open | Yeni ay başladı |
| Accruing | Declarations geliyor, revenue share birikiyor |
| Period Closed | Cut-off geçti, monthly comparison yapılabilir |
| Monthly Settled | Rev share vs MAG/12 → higher-of billed |
| Year-End Eligible | Fiscal year kapandı, true-up hesaplanabilir |
| True-Up Complete | YTD comparison done, true-up invoiced (if any) |

---

## 9. NOTIFICATION LIFECYCLE

```
[Created] ──► [Queued] ──► [Sent] ──► [Read]
                              │
                          [Failed] ──► [Retry] ──► [Sent]
                              │
                     [Permanently Failed]
```

| Channel | Delivery |
|---------|----------|
| Email | SendGrid/SES → webhook delivery status |
| In-App | DB record → client polling/WebSocket → read status |
