---
phase: 07-admin-portal
plan: 02
subsystem: ui
tags: [react, tanstack-query, tanstack-table, react-hook-form, zod, axios, sse, shadcn-ui]

# Dependency graph
requires:
  - phase: 07-admin-portal
    provides: Shadcn/ui components, AppShell layout, DataTable, StatusBadge, ConfirmDialog, PageHeader, auth store, API client, useSSE hooks, route placeholders
  - phase: 03-contract-domain
    provides: Contract CRUD API, state machine, amendment, area/service assignments
  - phase: 02-master-data
    provides: Tenant, Formula, Service, Area CRUD APIs
  - phase: 05-billing
    provides: BillingRun API, SSE progress endpoint, approve/reject/cancel/rerun
provides:
  - Contract management pages (list, detail with state transitions, create/edit with area/service assignment)
  - Tenant management pages (list with status actions, create/edit with immutable taxId)
  - Formula management pages (list with type/status filters, builder with expression editor and dry-run preview)
  - Service management pages (list with create dialog, publish/version/deprecate actions)
  - Billing operations pages (list with action buttons, run modal with SSE progress and approve/reject)
  - 6 API modules (contracts, tenants, areas, formulas, services, billing)
affects: [07-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [FormField render prop for all forms, useMutation with invalidateQueries+toast, Select+FormControl for dropdowns, two-panel layout for formula builder, Dialog for create/edit at demo scope]

key-files:
  created:
    - apps/admin/src/api/contracts.ts
    - apps/admin/src/api/tenants.ts
    - apps/admin/src/api/areas.ts
    - apps/admin/src/api/formulas.ts
    - apps/admin/src/api/services.ts
    - apps/admin/src/api/billing.ts
    - apps/admin/src/pages/contracts/ContractList.tsx
    - apps/admin/src/pages/contracts/ContractDetail.tsx
    - apps/admin/src/pages/contracts/ContractForm.tsx
    - apps/admin/src/pages/tenants/TenantList.tsx
    - apps/admin/src/pages/tenants/TenantForm.tsx
    - apps/admin/src/pages/formulas/FormulaList.tsx
    - apps/admin/src/pages/formulas/FormulaBuilder.tsx
    - apps/admin/src/pages/services/ServiceList.tsx
    - apps/admin/src/pages/billing/BillingList.tsx
    - apps/admin/src/pages/billing/BillingRunModal.tsx
  modified:
    - apps/admin/src/router/index.tsx

key-decisions:
  - "Services API module created in Task 1 (ahead of plan) because ContractForm imports getServices for service assignment"
  - "Router coordinated with parallel 07-03: preserved Dashboard, InvoiceList, Settings imports added by 07-03"
  - "ServiceList uses Dialog for create/edit at demo scope rather than separate page route"
  - "BillingRunModal uses useBillingSSE hook from 07-01 for real-time progress tracking"
  - "Separation of duties: publish button disabled when user.role=commercial_manager and user created the contract"

patterns-established:
  - "API module pattern: typed interfaces + PaginatedResponse<T> generic + async functions using apiClient"
  - "Page pattern: useQuery for data, useMutation with invalidateQueries + toast for mutations"
  - "Form pattern: react-hook-form + zodResolver + FormField render prop (never register)"
  - "Status action pattern: ConfirmDialog wrapping Button with variant for destructive actions"
  - "Filter pattern: Select with 'all' default value, queryKey includes filter values"

requirements-completed: [R12.2, R12.3, R12.4, R12.5]

# Metrics
duration: 7min
completed: 2026-03-06
---

# Phase 7 Plan 2: Admin Feature Pages Summary

**Four core admin feature areas: Contract CRUD with 8-state machine transitions, Tenant lifecycle management, Formula builder with dry-run preview, and Billing operations with real-time SSE progress tracking**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-06T06:53:46Z
- **Completed:** 2026-03-06T07:01:43Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Built complete contract management: list with status filters, detail with state transition buttons (draft->review->publish->active->suspend/terminate), create/edit form with tenant select and area/service assignment for draft contracts
- Built tenant management: list with inline status transition actions (activate/suspend/deactivate via ConfirmDialog), create/edit form with immutable taxId on edit
- Built formula management: list with type/status filters, two-panel builder with expression textarea (font-mono) and dry-run preview panel showing result/error/trace, publish/version/deprecate lifecycle actions
- Built service management: list with create dialog, publish/new-version/deprecate actions per service, linked formula display
- Built billing operations: list with approve/reject/cancel/rerun buttons, run modal with form -> SSE progress bar (useBillingSSE hook) -> approve/reject on completion
- Created 6 API modules (contracts, tenants, areas, formulas, services, billing) with full typed interfaces

## Task Commits

Each task was committed atomically:

1. **Task 1: Contract management pages + Tenant management pages with API modules** - `1158f2b` (feat)
2. **Task 2: Formula/Service pages + Billing operations pages with SSE progress** - `7b51656` (feat)

## Files Created/Modified
- `apps/admin/src/api/contracts.ts` - Contract CRUD, transitions, amend, areas, services API functions
- `apps/admin/src/api/tenants.ts` - Tenant CRUD with status transition via updateTenant
- `apps/admin/src/api/areas.ts` - Area list, roots, tree API functions
- `apps/admin/src/api/formulas.ts` - Formula CRUD, publish, version, deprecate, dry-run
- `apps/admin/src/api/services.ts` - Service CRUD, publish, version, deprecate
- `apps/admin/src/api/billing.ts` - BillingRun CRUD, approve, reject, cancel, cancel-tenants, rerun
- `apps/admin/src/pages/contracts/ContractList.tsx` - Contract list with DataTable, status filter, "New Contract" button
- `apps/admin/src/pages/contracts/ContractDetail.tsx` - Contract detail with state transitions, tabs (areas/services/versions), amend dialog
- `apps/admin/src/pages/contracts/ContractForm.tsx` - Contract create/edit form with tenant select, area/service assignment
- `apps/admin/src/pages/tenants/TenantList.tsx` - Tenant list with inline status action buttons
- `apps/admin/src/pages/tenants/TenantForm.tsx` - Tenant create/edit form with immutable taxId
- `apps/admin/src/pages/formulas/FormulaList.tsx` - Formula list with type/status filters
- `apps/admin/src/pages/formulas/FormulaBuilder.tsx` - Two-panel formula editor with dry-run preview
- `apps/admin/src/pages/services/ServiceList.tsx` - Service list with create dialog and lifecycle actions
- `apps/admin/src/pages/billing/BillingList.tsx` - Billing run list with action buttons
- `apps/admin/src/pages/billing/BillingRunModal.tsx` - Billing run create + SSE progress + approve/reject
- `apps/admin/src/router/index.tsx` - Updated with all feature page imports and routes

## Decisions Made
- Services API module created in Task 1 (ahead of schedule) because ContractForm imports getServices for the service assignment select dropdown
- Router file coordinated with parallel 07-03 execution: preserved Dashboard, InvoiceList, and Settings imports that 07-03 had already added
- ServiceList uses Dialog for create/edit at demo scope rather than a separate page route (keeping routing simple)
- BillingRunModal leverages useBillingSSE hook from 07-01 for real-time progress display
- Separation of duties enforced in UI: publish button disabled when user is commercial_manager and created the contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Services API module created early for ContractForm import**
- **Found during:** Task 1 (ContractForm implementation)
- **Issue:** ContractForm imports `getServices` from `@/api/services` for the service assignment dropdown, but the plan schedules the services API module for Task 2
- **Fix:** Created the full services API module in Task 1 so ContractForm compiles
- **Files modified:** apps/admin/src/api/services.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 1158f2b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Moved services API creation from Task 2 to Task 1 to resolve import dependency. No scope creep.

## Issues Encountered
- Router file was concurrently modified by parallel 07-03 execution (added Dashboard, InvoiceList, Settings imports). Detected and preserved 07-03's changes while adding 07-02 imports. No conflicts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 core admin feature areas fully functional with real page components replacing all route placeholders
- TypeScript compiles with zero errors across all new files
- All pages use shared components from 07-01 (DataTable, StatusBadge, ConfirmDialog, PageHeader)
- API modules ready for integration testing with backend
- Router has no more placeholder routes except Dashboard (07-03)

## Self-Check: PASSED

- All 17 key files verified present on disk
- Both task commits (1158f2b, 7b51656) verified in git log
- TypeScript compilation: zero errors in 07-02 files

---
*Phase: 07-admin-portal*
*Completed: 2026-03-06*
