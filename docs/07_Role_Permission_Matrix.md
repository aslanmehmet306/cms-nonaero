# 🔐 ROLE & PERMISSION MATRIX
## User Roles, Permissions & Access Control

**Version:** v2.0 (Post-Review Edition)
**Last Updated:** 2026-02-28
**Review Status:** SoD genişletildi, external auditor Phase 2 notu eklendi

---

## 1. ROLE DEFINITIONS

### 1.1 Platform Roles

| Role | Description | Typical User |
|------|-------------|-------------|
| **Super Admin** | Tam platform erişimi, airport yönetimi | Platform operasyon ekibi |
| **Airport Admin** | Tek airport'a tam erişim, kullanıcı yönetimi | Havalimanı IT/Operasyon müdürü |
| **Commercial Manager** | Kontrat, servis, formül yönetimi | Ticari gelirler müdürü |
| **Finance User** | Billing, fatura, ödeme, settlement yönetimi | Finans departmanı |
| **Auditor** | Tüm verilere read-only erişim | İç/dış denetim |
| **Tenant Admin** | Kendi tenant'ına ait işlemler | Kiracı yönetici |
| **Tenant User** | Declaration girişi ve fatura görüntüleme | Kiracı çalışanı |

### 1.2 Role Hierarchy

```
Super Admin
  └── Airport Admin
        ├── Commercial Manager
        ├── Finance User
        └── Auditor (read-only)

Tenant Admin
  └── Tenant User
```

---

## 2. PERMISSION MATRIX – ADMIN PORTAL

### 2.1 Airport & Area Management

| Action | Super Admin | Airport Admin | Commercial Mgr | Finance | Auditor |
|--------|:-----------:|:------------:|:--------------:|:-------:|:-------:|
| Airport CRUD | ✅ | ❌ | ❌ | ❌ | ❌ |
| Area hierarchy view | ✅ | ✅ | ✅ | ✅ | ✅ |
| Area CRUD | ✅ | ✅ | ✅ | ❌ | ❌ |
| Equipment CRUD | ✅ | ✅ | ✅ | ❌ | ❌ |

### 2.2 Service & Formula

| Action | Super Admin | Airport Admin | Commercial Mgr | Finance | Auditor |
|--------|:-----------:|:------------:|:--------------:|:-------:|:-------:|
| Service definition create | ✅ | ✅ | ✅ | ❌ | ❌ |
| Service definition publish | ✅ | ✅ | ✅ | ❌ | ❌ |
| Service definition view | ✅ | ✅ | ✅ | ✅ | ✅ |
| Formula create | ✅ | ✅ | ✅ | ❌ | ❌ |
| Formula evaluate (dry run) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Formula publish | ✅ | ✅ | ✅ | ❌ | ❌ |

### 2.3 Contract Management

| Action | Super Admin | Airport Admin | Commercial Mgr | Finance | Auditor |
|--------|:-----------:|:------------:|:--------------:|:-------:|:-------:|
| Contract create | ✅ | ✅ | ✅ | ❌ | ❌ |
| Contract edit (draft) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Contract submit for review | ✅ | ✅ | ✅ | ❌ | ❌ |
| Contract approve | ✅ | ✅ | ❌ | ✅ | ❌ |
| Contract publish | ✅ | ✅ | ❌ | ❌ | ❌ |
| Contract amend | ✅ | ✅ | ✅ | ❌ | ❌ |
| Contract terminate | ✅ | ✅ | ❌ | ❌ | ❌ |
| Contract view | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.4 Obligation & Settlement

| Action | Super Admin | Airport Admin | Commercial Mgr | Finance | Auditor |
|--------|:-----------:|:------------:|:--------------:|:-------:|:-------:|
| Obligation view | ✅ | ✅ | ✅ | ✅ | ✅ |
| Obligation hold/release | ✅ | ✅ | ✅ | ✅ | ❌ |
| Obligation generate (trigger) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Settlement view | ✅ | ✅ | ✅ | ✅ | ✅ |
| MAG status view | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.5 Billing & Invoicing

| Action | Super Admin | Airport Admin | Commercial Mgr | Finance | Auditor |
|--------|:-----------:|:------------:|:--------------:|:-------:|:-------:|
| Billing run create (tekil/toplu tenant) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Billing run preview | ✅ | ✅ | ✅ | ✅ | ✅ |
| Billing run approve | ✅ | ✅ | ❌ | ✅ | ❌ |
| Billing run reject | ✅ | ✅ | ❌ | ✅ | ❌ |
| Billing run cancel (full/partial tenant) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Billing run re-run (full/delta) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Invoice list view | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invoice detail view | ✅ | ✅ | ✅ | ✅ | ✅ |
| Credit note request | ✅ | ✅ | ❌ | ✅ | ❌ |

### 2.6 Billing Policy

| Action | Super Admin | Airport Admin | Commercial Mgr | Finance | Auditor |
|--------|:-----------:|:------------:|:--------------:|:-------:|:-------:|
| Billing policy create | ✅ | ✅ | ❌ | ✅ | ❌ |
| Billing policy approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| Billing policy view | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.7 Reporting & Audit

| Action | Super Admin | Airport Admin | Commercial Mgr | Finance | Auditor |
|--------|:-----------:|:------------:|:--------------:|:-------:|:-------:|
| Reports view | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reports export | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit trail view | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit trail export | ✅ | ✅ | ❌ | ✅ | ✅ |

### 2.8 Tenant & User Management

| Action | Super Admin | Airport Admin | Commercial Mgr | Finance | Auditor |
|--------|:-----------:|:------------:|:--------------:|:-------:|:-------:|
| Tenant CRUD | ✅ | ✅ | ✅ | ❌ | ❌ |
| Admin user create | ✅ | ✅ | ❌ | ❌ | ❌ |
| Admin user role assign | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tenant user create | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 3. PERMISSION MATRIX – TENANT PORTAL

| Action | Tenant Admin | Tenant User |
|--------|:-----------:|:-----------:|
| Revenue declaration create | ✅ | ✅ |
| Revenue declaration submit | ✅ | ✅ |
| Meter reading upload | ✅ | ✅ |
| Declaration history view | ✅ | ✅ |
| Invoice list view (own) | ✅ | ✅ |
| Invoice PDF download | ✅ | ✅ |
| Payment via Stripe | ✅ | ❌ |
| Payment history view | ✅ | ✅ |
| Tenant profile edit | ✅ | ❌ |
| Tenant user manage | ✅ | ❌ |
| Contract view (own) | ✅ | ❌ |

---

## 4. DATA ISOLATION RULES

### 4.1 Airport-Level Isolation

- Tüm admin roller sadece atandıkları airport'un verilerine erişir
- Super Admin hariç, cross-airport erişim yok
- PostgreSQL row-level security ile enforced
- Her API call'da `airport_id` context zorunlu

### 4.2 Tenant-Level Isolation

- Tenant kullanıcılar sadece kendi tenant_id'lerine ait verileri görür
- Cross-tenant erişim kesinlikle yok
- Declaration, invoice, payment → tenant_id filter zorunlu

### 4.3 Separation of Duties (Genişletilmiş)

| Principle | Implementation | Enforcement |
|-----------|---------------|-------------|
| Contract oluşturan onaylayamaz | Commercial creates, Finance/Admin approves | API: approved_by ≠ created_by |
| Billing run'ı başlatan onaylayamaz | Same user cannot both create and approve | API: approved_by ≠ created_by |
| Billing policy maker ≠ approver | Creator cannot approve own policy | API: approved_by ≠ created_by |
| **Formula/Tariff yazan billing run approve edemez** | Commercial Mgr: formula yazar; Finance: billing run approve eder | Role-level (Commercial Mgr billing run approve yetkisi yok) |
| **Service publish eden contract approve edemez** | Aynı kullanıcı aynı pipeline'da iki kritik adımı yapamaz | API: kullanıcı bazlı kontrol (enterprise modda) |

> ⚠️ Phase 2: "Enterprise SoD Mode" — daha granüler kontrol, configurable per-airport.

### 4.4 External Auditor Role (Phase 2)

Phase 2'de `auditor_external` rolü eklenecek:
- Sadece audit trail + settlement + invoice + reporting erişimi
- Contract draft, formula düzenleme vb. göremez
- Compliance raporlama için optimize edilmiş read-only görünüm

---

## 5. AUTHENTICATION SPECS

### 5.1 Admin Portal

```
Auth Method: Email + Password + Optional 2FA
Session: JWT (15 min access, 7 day refresh)
Password Policy:
  - Min 12 characters
  - Uppercase + lowercase + number + special
  - No password reuse (last 5)
  - Account lock after 5 failed attempts (30 min)
```

### 5.2 Tenant Portal

```
Auth Method: Email + Password
Session: JWT (30 min access, 30 day refresh)
Password Policy:
  - Min 8 characters
  - Uppercase + lowercase + number
  - Account lock after 5 failed attempts (15 min)
```

### 5.3 Future (Phase 2+)

- SSO / SAML integration
- OAuth 2.0 for API access
- IP whitelist per airport
- Session management dashboard
