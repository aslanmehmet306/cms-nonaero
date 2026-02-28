# 📧 EMAIL & NOTIFICATION TEMPLATES
## Template Definitions for All Notification Events

**Version:** v1.0
**Last Updated:** 2026-02-28
**Email Provider:** SendGrid / AWS SES
**Language:** Turkish (primary), English (Phase 2)

---

## 1. TEMPLATE STANDARDS

### Shared Variables (all templates)
```
{{airport_name}}      → "İzmir Adnan Menderes Havalimanı"
{{airport_code}}      → "ADB"
{{tenant_name}}       → "Aegean Duty Free"
{{tenant_code}}       → "TNT-001"
{{recipient_name}}    → "Mehmet Aslan"
{{current_date}}      → "28 Şubat 2026"
{{support_email}}     → "destek@airport-revenue.com"
{{portal_url}}        → "https://portal.airport-revenue.com"
{{admin_url}}         → "https://admin.airport-revenue.com"
```

### Email Layout
```
┌─────────────────────────────────────────┐
│  [Airport Logo]   Airport Revenue Mgmt  │  Header
├─────────────────────────────────────────┤
│                                         │
│  Email body content                     │  Body
│                                         │
├─────────────────────────────────────────┤
│  Bu e-posta otomatik olarak            │
│  gönderilmiştir. Yanıtlamayınız.       │  Footer
│  {{airport_name}} | {{support_email}}  │
└─────────────────────────────────────────┘
```

---

## 2. TEMPLATE DEFINITIONS

### TEMPLATE 01: Cut-Off Approaching (3 Days)

**Event:** `cutoff_approaching`
**Recipient:** Tenant (email + in-app)
**Trigger:** 3 days before billing policy cut-off day

**Subject:** `[{{airport_code}}] Beyan Teslim Süreniz Yaklaşıyor — {{period_display}}`

**Body:**
```
Sayın {{recipient_name}},

{{tenant_name}} olarak {{period_display}} dönemi gelir beyanı teslim süreniz
{{cutoff_date}} tarihinde sona erecektir.

Kalan süre: {{days_remaining}} gün

Beyan bilgilerinizi Kiracı Portalı üzerinden girebilirsiniz:
[Beyan Gir →] {{portal_url}}/declarations/new?period={{period_key}}

Hatırlatma:
• Beyanlar "KDV Dahil Brüt Satış Tutarı" üzerinden yapılmalıdır
• POS raporu veya Z raporu eklemeniz önerilir
• Süre sonunda beyan girilmemişse ilgili dönem faturası oluşturulmayacaktır

Sorularınız için: {{support_email}}
```

**Variables:**
```
{{period_display}}  → "Mart 2026"
{{period_key}}      → "2026-03"
{{cutoff_date}}     → "10 Nisan 2026"
{{days_remaining}}  → "3"
```

**In-App Notification:**
```
Title: "Beyan teslim süreniz yaklaşıyor"
Body: "{{period_display}} dönemi beyanı için {{days_remaining}} gün kaldı"
Action: Navigate to /declarations/new
```

---

### TEMPLATE 02: Declaration Missing at Cut-Off

**Event:** `declaration_missing`
**Recipient:** Tenant + Commercial Manager (email + in-app)
**Trigger:** Cut-off date passed, no declaration submitted

**Subject (Tenant):** `[{{airport_code}}] ⚠️ Beyan Eksik — {{period_display}} Faturası Oluşturulamayacak`

**Body (Tenant):**
```
Sayın {{recipient_name}},

{{tenant_name}} olarak {{period_display}} dönemi gelir beyanınız
{{cutoff_date}} itibarıyla teslim edilmemiştir.

Bu nedenle {{period_display}} dönemi gelir payı faturanız oluşturulamayacaktır.

Lütfen en kısa sürede beyanınızı iletiniz. Geç beyanlar bir sonraki
dönemde değerlendirilecektir.

[Beyanlarıma Git →] {{portal_url}}/declarations

Sorularınız için: {{support_email}}
```

**Subject (Commercial Manager):** `[{{airport_code}}] Eksik Beyan: {{tenant_name}} — {{period_display}}`

**Body (Commercial Manager):**
```
{{tenant_name}} ({{tenant_code}}) kiracısının {{period_display}} dönemi
gelir beyanı cut-off tarihi ({{cutoff_date}}) itibarıyla teslim edilmemiştir.

İlgili dönem gelir payı faturası oluşturulmayacaktır.
Obligation durumu: pending_input → skipped

[Obligation Detay →] {{admin_url}}/billing/obligations?tenant={{tenant_code}}&period={{period_key}}
```

---

### TEMPLATE 03: Invoice Created

**Event:** `invoice_created`
**Recipient:** Tenant (email + in-app)
**Trigger:** Stripe invoice finalized

**Subject:** `[{{airport_code}}] Yeni Faturanız: {{invoice_number}} — {{charge_type_display}}`

**Body:**
```
Sayın {{recipient_name}},

{{tenant_name}} adına yeni bir fatura oluşturulmuştur:

Fatura No  : {{invoice_number}}
Dönem      : {{period_display}}
Tür        : {{charge_type_display}}
Tutar      : {{amount}} ₺
Son Ödeme  : {{due_date}}

Faturanızı görüntülemek ve ödeme yapmak için:
[Faturayı Görüntüle →] {{stripe_hosted_url}}

Faturanızın PDF'ine erişmek için:
[PDF İndir →] {{stripe_pdf_url}}

Sorularınız için: {{support_email}}
```

**Variables:**
```
{{invoice_number}}      → "INV-2026-03-001"
{{charge_type_display}} → "Baz Kira" | "Gelir Payı" | "MAG Mahsup"
{{amount}}              → "45,000.00"
{{due_date}}            → "15 Nisan 2026"
{{stripe_hosted_url}}   → Stripe hosted invoice URL
{{stripe_pdf_url}}      → Stripe PDF URL
```

**charge_type_display mapping:**
- base_rent → "Baz Kira"
- revenue_share → "Gelir Payı"
- mag_settlement → "MAG Mahsup"
- service_charge → "Hizmet Bedeli"
- utility → "Kullanım Bedeli"

---

### TEMPLATE 04: Payment Received

**Event:** `payment_received`
**Recipient:** Tenant + Finance (email + in-app)
**Trigger:** Stripe webhook invoice.paid

**Subject (Tenant):** `[{{airport_code}}] Ödemeniz Alındı: {{invoice_number}}`

**Body (Tenant):**
```
Sayın {{recipient_name}},

{{invoice_number}} numaralı faturanız için ödemeniz başarıyla alınmıştır.

Fatura No  : {{invoice_number}}
Tutar      : {{amount}} ₺
Ödeme Tarihi: {{paid_date}}

Ödeme detayları için:
[Ödeme Geçmişi →] {{portal_url}}/payments

Teşekkür ederiz.
```

**Subject (Finance):** `[{{airport_code}}] Ödeme: {{tenant_name}} — {{invoice_number}} ({{amount}} ₺)`

**Body (Finance):** Compact notification with tenant, invoice, amount, paid date.

---

### TEMPLATE 05: Payment Failed

**Event:** `payment_failed`
**Recipient:** Tenant + Finance (email + in-app)
**Trigger:** Stripe webhook invoice.payment_failed

**Subject (Tenant):** `[{{airport_code}}] ⚠️ Ödeme Başarısız: {{invoice_number}}`

**Body (Tenant):**
```
Sayın {{recipient_name}},

{{invoice_number}} numaralı faturanız için yapılan ödeme girişimi başarısız
olmuştur.

Fatura No  : {{invoice_number}}
Tutar      : {{amount}} ₺
Son Ödeme  : {{due_date}}

Lütfen ödeme bilgilerinizi kontrol ederek tekrar deneyiniz:
[Ödeme Yap →] {{stripe_hosted_url}}

Ödeme sorunu devam ederse lütfen bizimle iletişime geçiniz: {{support_email}}
```

---

### TEMPLATE 06: Invoice Overdue

**Event:** `invoice_overdue`
**Recipient:** Tenant + Finance (email + in-app)
**Trigger:** Stripe invoice past_due

**Subject (Tenant):** `[{{airport_code}}] ❗ Vadesi Geçmiş Fatura: {{invoice_number}}`

**Body (Tenant):**
```
Sayın {{recipient_name}},

{{invoice_number}} numaralı faturanızın vadesi geçmiştir.

Fatura No  : {{invoice_number}}
Tutar      : {{amount}} ₺
Vade Tarihi: {{due_date}}
Gecikme    : {{overdue_days}} gün

Lütfen en kısa sürede ödemenizi gerçekleştiriniz:
[Ödeme Yap →] {{stripe_hosted_url}}

Sorularınız için: {{support_email}}
```

---

### TEMPLATE 07: Contract Expiring (30 Days)

**Event:** `contract_expiring`
**Recipient:** Commercial Manager + Tenant (email + in-app)
**Trigger:** 30 days before contract.effectiveTo

**Subject:** `[{{airport_code}}] Sözleşme Süresi Doluyor: {{contract_number}} — {{tenant_name}}`

**Body (Commercial Manager):**
```
{{tenant_name}} ({{tenant_code}}) ile yapılan {{contract_number}} numaralı
sözleşmenin bitiş tarihi yaklaşmaktadır:

Sözleşme No  : {{contract_number}}
Bitiş Tarihi : {{expiry_date}}
Kalan Süre   : {{days_remaining}} gün

Yenileme veya uzatma işlemi için:
[Sözleşme Detay →] {{admin_url}}/contracts/{{contract_id}}
```

**Body (Tenant):**
```
Sayın {{recipient_name}},

{{airport_name}} ile yapılan sözleşmenizin süresi dolmak üzeredir:

Sözleşme No  : {{contract_number}}
Bitiş Tarihi : {{expiry_date}}
Kalan Süre   : {{days_remaining}} gün

Sözleşme yenileme hakkında bilgi almak için ticari yöneticinizle
iletişime geçebilirsiniz.
```

---

## 3. IN-APP NOTIFICATION FORMAT

Her in-app notification için:

```json
{
  "type": "cutoff_approaching",
  "title": "Beyan teslim süreniz yaklaşıyor",
  "body": "Mart 2026 dönemi beyanı için 3 gün kaldı",
  "icon": "clock",
  "severity": "warning",
  "actionUrl": "/declarations/new?period=2026-03",
  "actionLabel": "Beyan Gir",
  "createdAt": "2026-04-07T00:05:00Z"
}
```

**Severity → Icon/Color Mapping:**
- info (blue): invoice_created, payment_received, billing_run_completed
- warning (yellow): cutoff_approaching, mag_shortfall, contract_expiring
- error (red): declaration_missing, payment_failed, invoice_overdue

---

## 4. NOTIFICATION PREFERENCES (Phase 2)

Phase 1'de tüm notification'lar varsayılan olarak aktif. Phase 2'de:
- Kullanıcı bazlı email on/off
- Channel preference (email only, in-app only, both)
- Digest mode (günlük özet email)
