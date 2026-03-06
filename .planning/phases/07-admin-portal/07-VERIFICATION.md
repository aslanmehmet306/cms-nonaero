---
phase: 07-admin-portal
verified: 2026-03-06T08:45:00Z
status: gaps_found
score: 6/8 success criteria verified
re_verification: false
gaps:
  - truth: "Formula builder UI allows user to write expressions, preview with sample data, and see validation errors before saving"
    status: partial
    reason: "Dry-run 'Run Preview' button only renders when isEdit=true (line 357 of FormulaBuilder.tsx). A new formula cannot be previewed before it is saved to the server. The plan states 'preview...before saving' but the implementation requires a database-persisted formula ID to call POST /formulas/:id/dry-run."
    artifacts:
      - path: "apps/admin/src/pages/formulas/FormulaBuilder.tsx"
        issue: "Run Preview button conditionally rendered with {isEdit && (...)} guard (line 357). No preview is possible in create mode."
    missing:
      - "Allow dry-run preview in create mode by POSTing the expression and parameters inline without requiring a persisted formula ID — either by calling a stateless evaluate endpoint or by creating a temporary formula and deleting it, or by validating the expression client-side first"
  - truth: "Role-based access control enforces separation of duties (contract creator cannot approve own contracts, auditor is read-only)"
    status: failed
    reason: "Auditor read-only enforcement is completely absent from the codebase. The only role check present is disabling the 'Publish' button for commercial_manager who created the contract (ContractDetail.tsx lines 148-152). Auditor users can trigger billing runs, approve/reject results, terminate contracts, and perform all destructive actions in the UI. The server enforces RBAC but the UI provides no visual separation or protection."
    artifacts:
      - path: "apps/admin/src/router/index.tsx"
        issue: "ProtectedRoute only checks accessToken — no role-based route guarding exists"
      - path: "apps/admin/src/pages/billing/BillingList.tsx"
        issue: "No role check on Approve/Reject buttons — auditor can click these"
      - path: "apps/admin/src/pages/contracts/ContractDetail.tsx"
        issue: "Only commercial_manager+creator check; auditor role receives full transition button set"
    missing:
      - "Add auditor role detection in ProtectedRoute or a RoleGuard component"
      - "Disable all mutation action buttons (state transitions, approve/reject, create/edit) when user.role === 'auditor'"
      - "Optionally: add a read-only banner when auditor is logged in to communicate their role constraints"
human_verification:
  - test: "Open admin app at 1366x768 viewport, navigate to all pages"
    expected: "No horizontal scrollbar, layout does not overflow — sidebar + content fit in 1366px"
    why_human: "Cannot verify CSS layout constraints programmatically without a browser"
  - test: "Log in as commercial_manager user who created a contract, navigate to that contract's detail page"
    expected: "Publish button appears disabled with tooltip explaining separation of duties"
    why_human: "Requires actual authenticated session with specific user data"
  - test: "Navigate to /invoices and check a paid invoice row"
    expected: "'View in Stripe' button appears and opens Stripe hosted invoice URL in new tab"
    why_human: "Requires real invoice data with stripeInvoiceUrl populated"
  - test: "Trigger a billing run through BillingRunModal"
    expected: "Real-time progress bar updates via SSE, showing percentage and message; approve/reject buttons appear when status reaches draft_ready"
    why_human: "Requires live backend with SSE endpoint and billing run orchestration"
---

# Phase 7: Admin Portal Verification Report

**Phase Goal:** Deliver React 18 admin frontend with Shadcn/ui components for contract management, billing operations, invoice tracking, and role-based access control across all admin workflows.
**Verified:** 2026-03-06T08:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | User can create, edit, publish, amend, and terminate contracts through intuitive UI with state transition buttons | VERIFIED | ContractList.tsx, ContractDetail.tsx (lines 38-54 validTransitions map), ContractForm.tsx all substantive. ConfirmDialog gates every transition. |
| 2  | User can create and manage tenants with status lifecycle controls (activate, suspend, deactivate) | VERIFIED | TenantList.tsx has statusActions map with all three transitions, TenantForm.tsx has create/edit modes with immutable taxId. |
| 3  | Formula builder UI allows user to write expressions, preview with sample data, and see validation errors before saving | PARTIAL | Two-panel layout exists with dry-run result/error display. However, "Run Preview" button is gated by `isEdit` — preview is impossible in create mode before first save. SC says "before saving." |
| 4  | User can trigger billing runs, view real-time progress via SSE updates, and approve/reject draft results | VERIFIED | BillingRunModal.tsx: creates run -> setBillingRunId -> useBillingSSE(billingRunId) -> Progress bar -> Approve/Reject on draft_ready. BillingList.tsx also has approve/reject/cancel/rerun actions. |
| 5  | Invoice list displays all invoices with status, amount, due date, and provides Stripe hosted URL link for payment | VERIFIED | InvoiceList.tsx has all required columns. stripeInvoiceUrl renders as `<a href={url} target="_blank">View in Stripe</a>` with ExternalLink icon. Uses actual InvoiceStatus enum values (created/finalized/sent/paid/past_due/voided/uncollectible). |
| 6  | Settings page allows configuration of billing policy (cut-off day, issue day, due date), user management with role assignment, and airport configuration | VERIFIED | Settings.tsx with 3 tabs. BillingPolicyTab has cutoffDay, issueDay, dueDateDays fields + activate. UserManagementTab has DataTable + Dialog with role select. AirportConfigTab has editable fields with read-only IATA/ICAO. |
| 7  | Responsive design works on desktop (1920x1080 primary, 1366x768 minimum) with consistent Shadcn/ui theming | HUMAN NEEDED | AppShell has `style={{ minWidth: 1366 }}` and `min-h-screen`. DataTable wrapped in `overflow-x-auto`. Dashboard KPIs use `grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`. Needs browser verification. |
| 8  | Role-based access control enforces separation of duties (contract creator cannot approve own contracts, auditor is read-only) | FAILED | Only one role check exists: ContractDetail disables Publish button for `commercial_manager` creators. Auditor role has zero UI enforcement — auditors can trigger billing runs, approve/reject, terminate contracts. |

**Score:** 6/8 success criteria verified (5 full, 1 partial, 1 human-needed, 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/admin/src/store/authStore.ts` | Zustand auth store with login/logout and localStorage persistence | VERIFIED | persist middleware with `name: 'auth-storage'`, logout() dynamically imports queryClient to clear cache, 42 lines of substance |
| `apps/admin/src/api/client.ts` | Axios instance with JWT interceptor and 401 redirect | VERIFIED | Request interceptor uses `useAuthStore.getState().accessToken`, response interceptor catches 401 and redirects |
| `apps/admin/src/router/index.tsx` | React Router v6 route tree with protected and public routes | VERIFIED | createBrowserRouter with /login outside ProtectedRoute, 14 feature routes inside AppShell |
| `apps/admin/src/components/layout/AppShell.tsx` | Main layout shell with sidebar + header + Outlet | VERIFIED | Flex layout with w-64 Sidebar, Header, main overflow-auto with minWidth:1366 |
| `apps/admin/src/components/shared/DataTable.tsx` | Reusable TanStack Table wrapper with Shadcn Table | VERIFIED | useReactTable with getCoreRowModel, getPaginationRowModel, getSortedRowModel, getFilteredRowModel; sorting, pagination, filter working |
| `apps/admin/src/components/shared/StatusBadge.tsx` | Colored badge for all status enums | VERIFIED | Maps ContractStatus, TenantStatus, BillingRunStatus, InvoiceStatus (actual enum: created/finalized/sent), ObligationStatus |
| `apps/admin/src/pages/contracts/ContractList.tsx` | Contract list with DataTable, status filter, create button | VERIFIED | useQuery(['contracts', statusFilter]), DataTable with columns, status Select filter, New Contract button |
| `apps/admin/src/pages/contracts/ContractForm.tsx` | Contract create/edit form with tenant select, area/service assignment | VERIFIED | react-hook-form+zod, tenant Select from query, area assignment section, service assignment section |
| `apps/admin/src/pages/contracts/ContractDetail.tsx` | Contract detail view with state transition buttons and version history | VERIFIED | validTransitions map, ConfirmDialog per transition, 3 tabs (areas/services/versions), amend dialog |
| `apps/admin/src/pages/tenants/TenantList.tsx` | Tenant list with status badges and action buttons | VERIFIED | statusActions map, inline ConfirmDialog buttons per tenant row |
| `apps/admin/src/pages/formulas/FormulaBuilder.tsx` | Formula expression editor with dry-run preview panel | PARTIAL | Two-panel layout, expression textarea (font-mono), dry-run preview panel with error display. Run Preview ONLY available in edit mode (isEdit guard) |
| `apps/admin/src/pages/billing/BillingRunModal.tsx` | Billing run trigger dialog with SSE progress display | VERIFIED | Form -> setBillingRunId -> useBillingSSE -> Progress bar -> Approve/Reject buttons on draft_ready |
| `apps/admin/src/pages/invoices/InvoiceList.tsx` | Invoice table with status badges, amounts, Stripe URL links | VERIFIED | All columns present, `<a href={stripeInvoiceUrl} target="_blank">` with ExternalLink icon |
| `apps/admin/src/pages/Dashboard.tsx` | Dashboard with KPI cards, revenue chart, aging report table | VERIFIED | 6 KPI cards, Recharts BarChart, 5-bucket aging table |
| `apps/admin/src/pages/settings/Settings.tsx` | Tabbed settings page with billing policy, user management, airport config | VERIFIED | Shadcn Tabs with 3 children: BillingPolicyTab, UserManagementTab, AirportConfigTab |
| `apps/admin/src/hooks/useSSE.ts` | useBillingSSE and useNotificationSSE hooks | VERIFIED | EventSource opened with token as query param, onmessage parses JSON, cleanup on unmount |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/admin/src/api/client.ts` | `apps/admin/src/store/authStore.ts` | `useAuthStore.getState()` in Axios interceptor | WIRED | Line 14: `useAuthStore.getState().accessToken` in request interceptor |
| `apps/admin/src/router/ProtectedRoute.tsx` | `apps/admin/src/store/authStore.ts` | `useAuthStore` selector for `accessToken` | WIRED | Line 5: `useAuthStore((s) => s.accessToken)` |
| `apps/admin/src/pages/Login.tsx` | `apps/admin/src/api/auth.ts` | POST /auth/admin/login on form submit | WIRED | `adminLogin(values.email, values.password)` called in onSubmit handler |
| `apps/admin/src/pages/contracts/ContractList.tsx` | `/api/v1/contracts` | `useQuery` with `getContracts()` | WIRED | `useQuery({ queryKey: ['contracts', statusFilter], queryFn: () => getContracts(...) })` |
| `apps/admin/src/pages/contracts/ContractDetail.tsx` | `/api/v1/contracts/:id/transition` | `useMutation` with `transitionContract()` | WIRED | `transitionMutation = useMutation({ mutationFn: transitionContract(id!, status) })` line 89-100 |
| `apps/admin/src/pages/formulas/FormulaBuilder.tsx` | `/api/v1/formulas/:id/dry-run` | `useMutation` with `dryRunFormula()` | WIRED (edit mode only) | `dryRunMutation = useMutation({ mutationFn: () => dryRunFormula(id!, variables) })` — but button only shown when `isEdit=true` |
| `apps/admin/src/pages/billing/BillingRunModal.tsx` | `/api/v1/billing-runs/:id/progress` | `useBillingSSE` hook from 07-01 | WIRED | `const progress = useBillingSSE(billingRunId)` — EventSource opens when billingRunId is set |
| `apps/admin/src/pages/invoices/InvoiceList.tsx` | `/api/v1/invoices` | `useQuery` with `getInvoices()` | WIRED | `useQuery({ queryKey: ['invoices', {...}], queryFn: () => getInvoices({...}) })` |
| `apps/admin/src/pages/Dashboard.tsx` | `/api/v1/reports/dashboard` | `useQuery` with `getDashboard()` | WIRED | `useQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard() })` |
| `apps/admin/src/pages/settings/BillingPolicyTab.tsx` | `/api/v1/billing-policies` | `useQuery` + `useMutation` for billing policy CRUD | WIRED | `getBillingPolicies`, `createBillingPolicy`, `updateBillingPolicy`, `activateBillingPolicy` all called with proper invalidation |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R12.2 | 07-02 | Contract management — list, create, edit, publish, amend, terminate | SATISFIED | ContractList, ContractDetail (8-state machine transitions), ContractForm with area/service assignment |
| R12.3 | 07-02 | Tenant management — list, create, edit, status changes | SATISFIED | TenantList with statusActions map (activate/suspend/deactivate), TenantForm with immutable taxId |
| R12.4 | 07-02 | Service definition — formula builder, preview, version history | PARTIAL | FormulaBuilder has expression editor + dry-run panel + publish/version/deprecate; preview only in edit mode |
| R12.5 | 07-02 | Billing operations — trigger run, view progress (SSE), approve/reject | SATISFIED | BillingRunModal creates run, tracks SSE progress, shows approve/reject on draft_ready; BillingList has action buttons |
| R12.6 | 07-03 | Invoice list — view details, Stripe hosted URL link, status tracking | SATISFIED | InvoiceList with all columns including `<a href={stripeInvoiceUrl}>View in Stripe</a>` |
| R12.9 | 07-03 | Settings — billing policy, user management, airport config | SATISFIED | 3-tab Settings page with full CRUD for each domain |
| R12.10 | 07-01, 07-03 | Responsive design (desktop-first for admin) | HUMAN NEEDED | minWidth:1366 in AppShell, overflow-x-auto on DataTables, responsive KPI grid — needs browser verification |
| R12.7 | NOT CLAIMED | Obligation list — filter by tenant/period/status, calculation trace drill-down | ORPHANED | No plan in Phase 7 claimed R12.7. No obligation list page exists in the codebase (`apps/admin/src/pages/` has no obligations directory). |
| R12.8 | NOT CLAIMED | Reports — revenue by tenant, by service type, billing history, audit trail | ORPHANED | No plan in Phase 7 claimed R12.8. Dashboard has revenue-by-service-type via getDashboard/getRevenueSummary API, but the full reports module (audit trail, billing history by tenant) is not implemented. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/admin/src/pages/formulas/FormulaBuilder.tsx` | 357 | `{isEdit && (...)}` gates Run Preview button | Warning | User cannot preview formula expression before first save — violates the "before saving" part of SC3 |
| `apps/admin/src/pages/contracts/ContractDetail.tsx` | 174 | Amend button only shown for `ContractStatus.active`; "pending_amendment" state has no explicit UI handling | Info | Minor: `pending_amendment` status exists in enum but validTransitions map has no entry for it |
| `apps/admin/src/components/shared/StatusBadge.tsx` | 12-13 | Maps `expired` from PLAN context but actual enum uses different values | Info | Non-blocking: StatusBadge falls back to `'secondary'` for unknown statuses — handles gracefully |

No TODO/FIXME/PLACEHOLDER anti-patterns found in any page files. All placeholder comments from 07-01 router setup have been replaced with real page components in 07-02 and 07-03.

### Human Verification Required

#### 1. Responsive Layout at 1366x768

**Test:** Open Chrome DevTools, set viewport to 1366x768, navigate through Contracts, Billing, Dashboard, Settings pages
**Expected:** No horizontal scrollbar appears; sidebar (256px) + main content area fit within 1366px; DataTables show overflow-x-auto when content is wide
**Why human:** CSS layout behavior requires a rendered browser environment; cannot assert absence of horizontal scrollbar from static code analysis

#### 2. Separation of Duties — Publish Button Disabled

**Test:** Log in as a user with role `commercial_manager`, create a new contract, then navigate to that contract's detail page
**Expected:** "Publish" button is visible but disabled, with tooltip text "You cannot publish a contract you created (separation of duties)"
**Why human:** Requires authenticated session with `user.sub === contract.createdBy` data match in Zustand state

#### 3. Stripe URL Link Opens Correct Page

**Test:** Navigate to /invoices, find an invoice with `status: 'finalized'` or `'sent'`, click "View in Stripe"
**Expected:** New tab opens to the Stripe hosted invoice page for that specific invoice
**Why human:** Requires real Stripe-integrated invoice data with populated `stripeInvoiceUrl` field

#### 4. Real-Time Billing Progress via SSE

**Test:** Click "New Billing Run", fill in a valid period, click "Start Billing Run"
**Expected:** Dialog transitions to progress phase; progress bar updates in real-time showing current status message and percentage; when status reaches `draft_ready`, Approve and Reject buttons appear
**Why human:** Requires live backend with SSE endpoint (`GET /api/v1/billing-runs/:id/progress`) and running billing orchestration

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — Formula builder preview before saving (SC3, R12.4 partial):**
The FormulaBuilder correctly implements the dry-run preview panel — it renders results, errors, and calculation traces. However, the "Run Preview" button is conditionally rendered only in edit mode (`{isEdit && ...}`). When a user is creating a new formula, they cannot test their expression before clicking "Create Formula". The success criterion explicitly states "preview with sample data...before saving." This is a UX workflow gap: the user must save first, then preview, which creates friction and risks creating invalid formulas that need to be deleted.

The fix is straightforward: either (a) expose a stateless expression evaluation endpoint the frontend can call without a formula ID, or (b) always show the Run Preview button and in create mode make a temporary POST /formulas call, get the ID, run dry-run, then clean up — or (c) implement client-side expression evaluation as a preview-only feature.

**Gap 2 — Auditor read-only enforcement absent (SC8, R12.10):**
The only role-based UI control in the entire admin app is a single disabled button for the contract publisher separation of duties check. The "auditor is read-only" requirement from SC8 has no implementation. Auditor users can:
- Trigger new billing runs via BillingRunModal
- Approve or reject billing run results in BillingList
- Terminate or suspend contracts via ContractDetail
- Create or edit tenants via TenantForm
- Manage users in UserManagementTab

The server API likely rejects these requests with 403, so there is no data corruption risk. However, the UI presents all action buttons to auditors, providing a confusing and incorrect user experience that contradicts the stated RBAC goal.

The fix requires adding a role check (e.g., `const isAuditor = user?.role === UserRole.auditor`) and conditionally disabling or hiding mutation buttons across all feature pages.

**Orphaned Requirements — R12.7 and R12.8:**
These requirements (Obligation list and full Reports module) were not claimed by any plan in Phase 7 and have no corresponding UI pages in the codebase. They are out of scope for this phase but should be tracked for a follow-up phase. The Dashboard does expose a revenue summary chart and aging report from the reports API, which partially satisfies R12.8 but not the full audit trail or billing history by tenant.

---

_Verified: 2026-03-06T08:45:00Z_
_Verifier: Claude (gsd-verifier)_
