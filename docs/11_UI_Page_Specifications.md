# 🖥️ UI PAGE SPECIFICATIONS
## Admin Portal & Tenant Portal Page Definitions

**Version:** v1.0
**Last Updated:** 2026-02-28
**UI Framework:** React 18 + Shadcn/ui + Tailwind CSS + TanStack Table
**Design System:** Shadcn/ui defaults (Slate/Zinc + Inter font)

---

## 1. NAVIGATION & LAYOUT

### 1.1 Admin Portal Layout

```
┌─────────────────────────────────────────────────────┐
│ Logo  Airport: ADB ▼   🔔 3   👤 Admin Name ▼      │  ← Top bar
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Sidebar  │  Page Content                            │
│          │                                          │
│ Dashboard│  ┌──────────────────────────────────┐    │
│ Contracts│  │  Page Header + Breadcrumb         │    │
│ Services │  │  ┌────────────────────────────┐   │    │
│ Formulas │  │  │  Main Content Area         │   │    │
│ Tenants  │  │  │                            │   │    │
│ Billing  │  │  │                            │   │    │
│ Invoices │  │  └────────────────────────────┘   │    │
│ Reports  │  └──────────────────────────────────┘    │
│ Settings │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

**Sidebar Menü Yapısı:**
- 📊 Dashboard
- 📋 Contracts (sub: List, Create)
- ⚙️ Services (sub: Definitions, Formulas)
- 👥 Tenants
- 💰 Billing (sub: Runs, Obligations, Policies)
- 🧾 Invoices
- 📈 Reports (sub: Revenue, MAG Status, Audit)
- ⚙️ Settings (sub: Users, Airport Config)

### 1.2 Tenant Portal Layout

```
┌─────────────────────────────────────────────────────┐
│ Airport Logo    TNT-001 Aegean DF    🔔 2   👤 User │  ← Top bar
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Sidebar  │  Page Content                            │
│          │                                          │
│ Dashboard│                                          │
│ Declarat.│                                          │
│ Invoices │                                          │
│ Payments │                                          │
│ Contract │                                          │
│ Notific. │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

**Sidebar Menü Yapısı (mobile: bottom tab bar):**
- 📊 Dashboard
- 📝 Declarations
- 🧾 Invoices
- 💳 Payments
- 📋 My Contract
- 🔔 Notifications

---

## 2. ADMIN PORTAL PAGES

### PAGE A01: Dashboard

**URL:** `/dashboard`
**Roles:** All admin roles

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ Dashboard                              Period ▼  │
├──────────┬──────────┬──────────┬────────────────┤
│  Active  │ Pending  │ Overdue  │ Revenue This   │
│ Contracts│ Invoices │ Invoices │ Month          │
│    47    │    12    │     3    │ ₺2,340,000     │
├──────────┴──────────┴──────────┴────────────────┤
│                                                  │
│ Missing Declarations (this period)      View All │
│ ┌─────────────────────────────────────────────┐  │
│ │ TNT-002  İzmir Coffee  Mar 2026  ⚠️ 3 days │  │
│ │ TNT-005  Med. Bistro   Mar 2026  ⚠️ 3 days │  │
│ └─────────────────────────────────────────────┘  │
│                                                  │
│ Recent Billing Runs                     View All │
│ ┌─────────────────────────────────────────────┐  │
│ │ BR-2026-03-001  Feb 2026  Completed  ₺1.8M │  │
│ │ BR-2026-02-001  Jan 2026  Completed  ₺1.7M │  │
│ └─────────────────────────────────────────────┘  │
│                                                  │
│ MAG Alert Summary                                │
│ ┌─────────────────────────────────────────────┐  │
│ │ TNT-001: YTD shortfall ₺150,000 (projected) │  │
│ └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Stats Cards:** Active Contracts, Pending Invoices, Overdue Invoices, Revenue This Month
**Tables:** Missing Declarations (5 rows), Recent Billing Runs (5 rows), MAG Alerts (compact)

---

### PAGE A02: Contract List

**URL:** `/contracts`
**Roles:** All admin roles (edit: Commercial Mgr + Admin)

**Table Columns:**

| Column | Type | Sortable | Filterable | Width |
|--------|------|:--------:|:----------:|-------|
| Contract # | string, link | ✅ | text search | 140px |
| Tenant | string, link | ✅ | dropdown | 180px |
| Status | badge (color-coded) | ✅ | multi-select | 120px |
| Effective From | date | ✅ | date range | 120px |
| Effective To | date | ✅ | date range | 120px |
| Annual MAG | currency | ✅ | range | 140px |
| Charge Types | tag list | ❌ | multi-select | 160px |
| Owner | string | ✅ | dropdown | 140px |
| Actions | icon buttons | ❌ | ❌ | 80px |

**Status Badge Colors:**
- Draft: gray
- In Review: yellow
- Published: blue
- Active: green
- Amended: orange
- Suspended: red (muted)
- Terminated: red

**Actions Column:** View (eye icon), Edit (pencil, draft only), More (⋮ → Amend, Suspend, Terminate)

**Page Actions:** + New Contract (button, top right)

**Filters Bar:** Status (multi-select), Tenant (search dropdown), Date Range, Owner

---

### PAGE A03: Contract Detail / Create / Edit

**URL:** `/contracts/:id` (view), `/contracts/new` (create), `/contracts/:id/edit` (edit)
**Roles:** View: All | Edit: Commercial Mgr + Admin

**Form Sections (Tabs):**

**Tab 1: General Information**

| Field | Type | Required | Validation | Notes |
|-------|------|:--------:|------------|-------|
| Contract Number | text input | ✅ | auto-generated: CTR-YYYY-NNN | readonly after create |
| Tenant | search select | ✅ | must exist | link to tenant detail |
| Status | badge | — | readonly | system-managed |
| Effective From | date picker | ✅ | future or today | |
| Effective To | date picker | ✅ | after effective_from | |
| Billing Frequency | select | ✅ | monthly/quarterly/annually | |
| Responsible Owner | select (admin users) | ❌ | | |

**Tab 2: Areas**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Area selector | tree checkbox | ✅ min 1 | Area hierarchy tree with checkboxes. Only unit-level selectable |
| Selected areas summary | tag list | — | Shows selected unit codes + m² |

**Tab 3: Services & Charges**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Add Service | button → modal | ✅ min 1 | Select from published services |
| Service list | table (inline edit) | — | Service name, formula, override options |
| Override Formula | select (optional) | ❌ | Override default formula |
| Custom Parameters | JSON form | ❌ | rate_per_m2, share_rate, etc. Key-value editor |

**Custom Parameters Key-Value Editor:**
```
┌─────────────────────────────────────────┐
│ Parameter Name    │ Value               │
├───────────────────┼─────────────────────┤
│ rate_per_m2       │ 150                 │
│ share_rate        │ 0.08                │
│ base_amount       │ 45000               │
│ + Add Parameter                         │
└─────────────────────────────────────────┘
```

**Tab 4: MAG & Escalation**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Annual MAG | currency input | ❌ | TRY, decimal(15,2) |
| Index Rate (%) | number input | ❌ | Manual escalation rate |
| Escalation Rule | JSON / structured | ❌ | Phase 2: auto TÜİK |

**Tab 5: Financial (Phase 2 - readonly placeholders)**

| Field | Type | Notes |
|-------|------|-------|
| Deposit Amount | currency (readonly) | Phase 2 |
| Guarantee Type | select (disabled) | Phase 2 |

**Tab 6: Obligations (view mode only)**

Obligation schedule table (after publish):

| Column | Type | Notes |
|--------|------|-------|
| Period | date range | "Mar 2026" |
| Charge Type | badge | base_rent, revenue_share |
| Status | badge | scheduled, pending_input, ready, etc. |
| Amount | currency | null for pending_input |
| Due Date | date | |

**Page Actions:**
- Draft: Save Draft, Submit for Review, Delete
- In Review: Approve (different user), Reject → Draft
- Published: (waiting for activation conditions)
- Active: Amend, Suspend, Terminate
- View: Back to list

---

### PAGE A04: Service Definition List

**URL:** `/services`
**Roles:** View: All | CRUD: Commercial Mgr + Admin

**Table Columns:**

| Column | Sortable | Filterable |
|--------|:--------:|:----------:|
| Code | ✅ | text |
| Name | ✅ | text |
| Type | ✅ | dropdown (rent, revenue_share, service_charge, utility) |
| Status | ✅ | multi-select |
| Formula | link | dropdown |
| Billing Freq | ✅ | dropdown |
| Version | ✅ | — |
| Actions | — | — |

---

### PAGE A05: Service Definition Create/Edit

**URL:** `/services/new`, `/services/:id/edit`

| Field | Type | Required |
|-------|------|:--------:|
| Code | text | ✅ |
| Name | text | ✅ |
| Service Type | select | ✅ |
| Formula | search select (published formulas) | ✅ |
| Default Billing Frequency | select | ✅ |
| Default Currency | select (TRY locked in Phase 1) | ✅ |
| Tax Class | select | ❌ |
| Effective From | date | ✅ |

**Actions:** Save Draft, Publish (→ immutable), Deprecate (published only)

---

### PAGE A06: Formula List

**URL:** `/formulas`

**Table Columns:** Code, Name, Type, Expression (truncated), Status, Version, Actions

---

### PAGE A07: Formula Create/Edit

**URL:** `/formulas/new`, `/formulas/:id/edit`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Code | text | ✅ | |
| Name | text | ✅ | |
| Formula Type | select | ✅ | arithmetic, conditional, step_band, etc. |
| Expression | code editor (monospace) | ✅ | Syntax highlighting, max 2000 chars |
| Variables | key-value editor | ✅ | Variable name + description + sample value |

**Special Feature: Dry-Run Panel**
```
┌─────────────────────────────────────────────────┐
│ Formula Expression:                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ area_m2 * rate_per_m2 * days_in_period / 365│ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Test Variables:          [Run Test]             │
│ area_m2: [300    ]                              │
│ rate_per_m2: [150    ]                          │
│ days_in_period: [31     ]                       │
│                                                 │
│ Result: ₺3,821.92                               │
│ Trace:                                          │
│   area_m2 * rate_per_m2 = 45,000               │
│   45,000 * days_in_period = 1,395,000          │
│   1,395,000 / 365 = 3,821.92                   │
│ Execution time: 2ms ✅                          │
└─────────────────────────────────────────────────┘
```

---

### PAGE A08: Tenant List

**URL:** `/tenants`

**Table Columns:** Code, Name, Type/Category, Status (active/suspended), Active Contracts count, Email, Phone, Actions

---

### PAGE A09: Tenant Detail

**URL:** `/tenants/:id`

**Tabs:** Overview (info + Stripe sync status), Contracts (table), Declarations (table), Invoices (table), Payments (table)

---

### PAGE A10: Billing Run List

**URL:** `/billing/runs`
**Roles:** Finance + Admin

**Table Columns:**

| Column | Type | Notes |
|--------|------|-------|
| Run ID | link | BR-YYYY-MM-NNN |
| Period | date range | "Mar 2026" |
| Status | badge | initiated → completed |
| Run Mode | badge | full / delta |
| Total Obligations | number | |
| Total Amount | currency | |
| Total Invoices | number | |
| Created By | user link | |
| Approved By | user link | SoD: must differ |
| Created At | datetime | |

**Page Action:** + New Billing Run (button)

---

### PAGE A11: Billing Run Create

**URL:** `/billing/runs/new`

**Step 1: Configuration**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Period Start | date | ✅ | |
| Period End | date | ✅ | |
| Run Mode | select | ✅ | Full / Delta. Delta requires previous run ref |
| Previous Run | select | conditional | Only when delta mode |
| Charge Types | multi-select checkbox | ✅ | base_rent, revenue_share, mag_settlement |
| Tenant Selection | radio: All / Select specific | ✅ | |
| Specific Tenants | multi-select (if selected) | conditional | Searchable tenant list |

**Step 2: Preview (after queue processing)**
```
┌─────────────────────────────────────────────────┐
│ Billing Run Preview — BR-2026-03-001            │
│ Period: March 2026 | Mode: Full                 │
├─────────────────────────────────────────────────┤
│ Summary                                         │
│ Total Obligations: 12                           │
│ Total Amount: ₺245,000.00                       │
│ Invoices to Create: 8                           │
│                                                 │
│ By Charge Type:                                 │
│   Base Rent: 5 obligations, ₺95,000            │
│   Revenue Share: 3 obligations, ₺150,000       │
│                                                 │
│ Skipped:                                        │
│   Missing Declaration: 2 ⚠️                     │
│   On Hold: 1                                    │
├─────────────────────────────────────────────────┤
│ Obligation Details                              │
│ ┌──────────────────────────────────────────┐    │
│ │ Tenant    │Type      │Amount   │Status   │    │
│ │ TNT-001   │Rent      │₺45,000  │Ready    │    │
│ │ TNT-001   │Rev Share │₺96,000  │Ready    │    │
│ │ TNT-002   │Rent      │₺12,000  │Ready    │    │
│ │ ...                                      │    │
│ └──────────────────────────────────────────┘    │
├─────────────────────────────────────────────────┤
│              [Reject]    [Approve & Invoice]    │
└─────────────────────────────────────────────────┘
```

---

### PAGE A12: Billing Run Detail

**URL:** `/billing/runs/:id`

**Sections:**
1. Status header (with progress bar for invoicing state)
2. Summary stats
3. Invoices table (with Stripe links)
4. Obligation breakdown
5. Error log (if any)

**Actions:** Cancel (partial/full), Retry Failed, Re-Run

---

### PAGE A13: Obligation List

**URL:** `/billing/obligations`

**Table Columns:** ID, Contract #, Tenant, Charge Type, Period, Amount, Status, Due Date, Invoice Ref, Actions (hold/release)

**Filters:** Status (multi), Charge Type (multi), Tenant, Period, Amount Range

---

### PAGE A14: Invoice List

**URL:** `/invoices`

**Table Columns:**

| Column | Notes |
|--------|-------|
| Invoice # | Stripe invoice number |
| Tenant | link |
| Charge Type | badge |
| Period | "Mar 2026" |
| Amount | currency |
| Status | paid, past_due, voided, etc. |
| Due Date | date |
| Paid At | date or "—" |
| Stripe Link | external link icon |

---

### PAGE A15: Invoice Detail

**URL:** `/invoices/:id`

**Sections:**
1. Invoice header (number, tenant, amounts, dates)
2. Line items (from obligation details)
3. Audit trail (obligation → formula → contract chain)
4. Payment info (Stripe status, timestamps)
5. Actions: View on Stripe (external link)

---

### PAGE A16: Reports — Revenue Dashboard

**URL:** `/reports/revenue`

**Components:**
- Period selector (month/quarter/year)
- Revenue summary cards (total billed, collected, outstanding)
- Revenue by charge type (bar chart or table)
- Revenue by tenant (table, sortable)
- Trend chart (monthly revenue, line chart)

---

### PAGE A17: Reports — MAG Status

**URL:** `/reports/mag-status`

**Table per contract with MAG:**

| Column | Notes |
|--------|-------|
| Contract # | link |
| Tenant | |
| Annual MAG | ₺1,200,000 |
| YTD Revenue Share | ₺850,000 |
| YTD MAG Accrued | ₺1,000,000 |
| Shortfall YTD | ₺150,000 |
| Months Remaining | 2 |
| Projected Year-End | "shortfall" / "surplus" (color-coded) |

---

### PAGE A18: Reports — Audit Trail

**URL:** `/reports/audit`

**Search by:** Entity type (contract, obligation, invoice, billing_run), Entity ID, Date range, Actor

**Audit Log Table:** Timestamp, Entity, Action, Actor, Changes (expandable JSON diff)

---

### PAGE A19: Billing Policy

**URL:** `/settings/billing-policy`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Cut-Off Day | number (1-28) | ✅ | Day of month |
| Issue Day | number (1-28) | ✅ | Day invoice is issued |
| Due Date Days | number | ✅ | Net days (e.g., 30) |
| Lead Days | number | ✅ | Days before due date → scheduled→ready |
| Grace Period Days | number | ❌ | Before marking overdue |
| Declaration Reminder Days | number | ✅ | Days before cut-off to send reminder |
| Fiscal Year Start Month | select (1-12) | ✅ | |

**Actions:** Save Draft, Submit for Approval, Approve (different user)

---

### PAGE A20: User Management

**URL:** `/settings/users`

**Table:** Name, Email, Role, Status (active/locked), Last Login, Actions (edit, deactivate)

**Create/Edit Form:** Name, Email, Role (select), Airport (select, super_admin only)

---

### PAGE A21: Notification Center (Admin)

**URL:** Slide-over panel from bell icon

**Layout:** List of notifications, grouped by date. Each item: icon, title, body (truncated), timestamp, read/unread indicator. Click → navigates to relevant entity. "Mark all as read" button.

---

## 3. TENANT PORTAL PAGES

### PAGE T01: Tenant Dashboard

**URL:** `/` (tenant portal root)

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ Welcome, Aegean Duty Free                        │
├──────────┬──────────┬────────────────────────────┤
│ Due Now  │ Upcoming │ Last Payment               │
│ 2 inv.   │ 3 inv.   │ ₺45,000 paid Feb 15       │
│ ₺141,000 │ ₺135,000 │                            │
├──────────┴──────────┴────────────────────────────┤
│                                                  │
│ ⚠️ Declaration Pending                           │
│ March 2026 revenue declaration is due in 5 days  │
│ [Submit Declaration →]                           │
│                                                  │
│ Recent Invoices                         View All │
│ ┌──────────────────────────────────────────────┐ │
│ │ INV-2026-02-001  Feb Rent    ₺45,000  Paid  │ │
│ │ INV-2026-02-002  Feb RevSh  ₺96,000  Due   │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

### PAGE T02: Declaration List

**URL:** `/declarations`

**Table Columns:** Period, Status (draft/submitted/validated/frozen), Total Amount, Submitted At, Actions (edit, view, upload attachment)

**Page Action:** + New Declaration

---

### PAGE T03: Declaration Create/Edit

**URL:** `/declarations/new`, `/declarations/:id/edit`

**Step 1: Period & Header**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Contract | select (own contracts) | ✅ | Auto-selected if single contract |
| Period | month picker | ✅ | Cannot select frozen/submitted periods |

**Step 2: Revenue Lines**

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Category | text or select | ❌ | E.g., "Duty Free Sales", "Perfume", "Tobacco" |
| Gross Amount (KDV Dahil) | currency | ✅ | Label clearly: "KDV Dahil Brüt Satış Tutarı" |
| Deductions | currency | ❌ | Bilgi amaçlı (iade/void) |
| Notes | text | ❌ | |

**+ Add Line** button for multiple categories.

**Validation Warnings (shown inline):**
- ⚠️ "Önceki aya göre %65 sapma tespit edildi" (yellow banner)
- ⚠️ "Sıfır satış tutarı girdiniz" (yellow banner)
- ❌ "Negatif tutar girilemez" (red, blocks submit)
- ❌ "Bu dönem için zaten beyan mevcut" (red, blocks submit)

**Step 3: Attachments**

```
┌─────────────────────────────────────────────────┐
│ Kanıt Dokümanları                               │
│                                                 │
│ 📎 POS_Report_Mar2026.pdf (2.3 MB)    [🗑️]    │
│ 📎 Z_Report_Mar2026.xlsx (1.1 MB)     [🗑️]    │
│                                                 │
│ [+ Dosya Yükle]                                 │
│ İzin verilen: PDF, JPEG, PNG, XLSX (max 10MB)   │
└─────────────────────────────────────────────────┘
```

**Step 4: Review & Submit**

Summary of all lines + total. Warning banners if any.

**Actions:** Save Draft, Submit

---

### PAGE T04: Declaration Detail (Frozen/View)

**URL:** `/declarations/:id`

Read-only view of submitted/frozen declaration. Lines, attachments, validation results, submission timestamp, frozen token.

---

### PAGE T05: Excel Upload

**URL:** `/declarations/upload`

1. **Download template:** Button to download XLSX template with headers
2. **Upload:** Drag-and-drop zone or file picker
3. **Preview:** Parsed lines shown in table, validation applied
4. **Confirm:** Create declaration from parsed data

**Template columns:** category, gross_amount, deductions, notes

---

### PAGE T06: Invoice List (Tenant)

**URL:** `/invoices`

**Table Columns:** Invoice #, Charge Type, Period, Amount, Status, Due Date, Actions (View on Stripe, Download PDF)

---

### PAGE T07: Invoice Detail (Tenant)

**URL:** `/invoices/:id`

Stripe hosted invoice URL embedded or linked. Line items, amounts, due date, payment status.

**Action:** Pay Now (link to Stripe payment page)

---

### PAGE T08: Payment History

**URL:** `/payments`

**Table Columns:** Invoice #, Amount, Payment Date, Payment Method, Status

---

### PAGE T09: My Contract (Tenant View)

**URL:** `/contract`

Read-only contract summary: areas, services, MAG, effective dates. Obligation schedule (upcoming periods).

*Note: Only Tenant Admin can see this page.*

---

### PAGE T10: Notification Center (Tenant)

**URL:** `/notifications`

Full-page notification list. Grouped by date. Types: declaration reminders, invoice created, payment confirmation, overdue warnings.

---

## 4. SHARED COMPONENTS

### 4.1 Notification Bell (Top Bar)

**Behavior:**
- Badge shows unread count
- Click opens slide-over panel
- Notifications list (infinite scroll)
- Click notification → navigate to entity + mark as read
- "Mark all read" action

**Implementation:** SSE (Server-Sent Events) for real-time count update. Polling fallback every 30s.

### 4.2 Status Badge Component

**Color Mapping:**
```
draft: gray        │ scheduled: gray
in_review: yellow  │ pending_input: yellow
published: blue    │ pending_calculation: orange
active: green      │ ready: blue
amended: orange    │ invoiced: indigo
suspended: red/muted│ settled: green
terminated: red    │ skipped: gray/strikethrough
                   │ on_hold: amber
                   │ cancelled: red
```

### 4.3 Currency Input

- Format: `₺ 1,234,567.89`
- Thousand separator: comma
- Decimal: dot (2 places)
- Currency prefix: ₺ (TRY, locked in Phase 1)
- Negative: not allowed (validation)

### 4.4 Date Picker

- Format display: `dd MMM yyyy` (e.g., "15 Mar 2026")
- Locale: tr-TR
- Week starts: Monday

### 4.5 Data Table (TanStack Table)

**Standard features on all tables:**
- Column sorting (click header)
- Column filtering (dropdown or text in filter bar)
- Pagination (25 / 50 / 100 per page)
- Row selection (checkbox, for bulk actions)
- Export CSV (button, admin only)
- Empty state: "Kayıt bulunamadı" with illustration

### 4.6 Audit Trail Viewer

**Used in:** Invoice Detail, Obligation Detail, Contract Detail

```
┌─────────────────────────────────────────────────┐
│ Audit Trail                                     │
│                                                 │
│ 📋 Contract CTR-2026-001 (v3)                   │
│ ├── 📐 Formula: revenue_share_flat (v2)         │
│ │   └── Expression: sales_amount * 0.08         │
│ ├── 📊 Declaration DEC-2026-03-TNT001           │
│ │   └── Gross Amount: ₺1,200,000               │
│ ├── 🔢 Obligation OBL-2026-03-RS-001           │
│ │   ├── Calculation: 1,200,000 * 0.08 = 96,000 │
│ │   └── Status: invoiced → settled              │
│ └── 🧾 Stripe Invoice in_1AbcXyz               │
│     ├── Amount: ₺96,000                         │
│     └── Paid: 2026-04-02                        │
└─────────────────────────────────────────────────┘
```

---

## 5. RESPONSIVE BREAKPOINTS

| Breakpoint | Admin Portal | Tenant Portal |
|------------|-------------|---------------|
| Desktop (≥1280px) | Full layout, sidebar expanded | Full layout |
| Tablet (768-1279px) | Sidebar collapsed (icons), tables horizontal scroll | Full layout, sidebar collapsed |
| Mobile (<768px) | N/A (desktop-first, basic support) | **Primary target.** Bottom tab nav, stacked forms, card-based lists |

**Tenant Portal Mobile Priority:** Declaration form, invoice view, notification center must work perfectly on mobile.

---

## 6. LOADING & ERROR STATES

### Loading
- Page load: skeleton loader (Shadcn Skeleton)
- Table load: skeleton rows
- Form submit: button spinner + disabled
- Billing run processing: progress indicator with status text

### Error
- Form validation: inline error messages below field (red text)
- API error: toast notification (Shadcn Toast) + error boundary
- 404: "Sayfa bulunamadı" with back button
- 403: "Bu sayfaya erişim yetkiniz yok"
- Network error: retry banner at top

### Empty States
- Tables: centered illustration + "Henüz kayıt yok" + action button
- Dashboard cards: "—" for zero values
- Notifications: "Bildirim yok" with checkmark icon
