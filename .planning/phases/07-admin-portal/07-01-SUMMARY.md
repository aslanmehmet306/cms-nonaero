---
phase: 07-admin-portal
plan: 01
subsystem: ui
tags: [react, shadcn-ui, tailwind-v4, zustand, tanstack-query, tanstack-table, axios, react-hook-form, zod, vite, sonner, lucide-react]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Vite admin app scaffold, shared-types enums, tsconfig
  - phase: 05-billing
    provides: SSE billing progress endpoint
  - phase: 05-notifications
    provides: SSE notification endpoint
provides:
  - Shadcn/ui + Tailwind v4 design system with 20+ UI components
  - Zustand auth store with localStorage persistence and TanStack Query cache clearing
  - Axios API client with Bearer token interceptor and 401 auto-redirect
  - Login page with react-hook-form + zod validation
  - AppShell layout (sidebar + header + Outlet) for all feature pages
  - Role-aware sidebar with 8 navigation links and active route highlighting
  - Header with user avatar dropdown and sign-out action
  - DataTable (generic TanStack Table wrapper with sorting, pagination, search)
  - StatusBadge (maps all status enums to colored Badge variants)
  - ConfirmDialog (AlertDialog wrapper for destructive actions)
  - PageHeader (consistent title + description + action layout)
  - useSSE hooks for billing progress and notification SSE streams
  - React Router v6 with ProtectedRoute guard and 13 feature route placeholders
affects: [07-02-PLAN, 07-03-PLAN]

# Tech tracking
tech-stack:
  added: [tailwindcss v4, @tailwindcss/vite, shadcn-ui, @tanstack/react-query, @tanstack/react-table, zustand, axios, react-hook-form, @hookform/resolvers, zod, lucide-react, sonner, date-fns, recharts, react-day-picker]
  patterns: [Zustand outside-React getState() for interceptors, Shadcn/ui New York style with Zinc base, Tailwind v4 @import format, RouterProviderProps router typing]

key-files:
  created:
    - apps/admin/src/store/authStore.ts
    - apps/admin/src/api/client.ts
    - apps/admin/src/api/auth.ts
    - apps/admin/src/router/index.tsx
    - apps/admin/src/router/ProtectedRoute.tsx
    - apps/admin/src/pages/Login.tsx
    - apps/admin/src/components/layout/AppShell.tsx
    - apps/admin/src/components/layout/Sidebar.tsx
    - apps/admin/src/components/layout/Header.tsx
    - apps/admin/src/components/shared/StatusBadge.tsx
    - apps/admin/src/components/shared/DataTable.tsx
    - apps/admin/src/components/shared/ConfirmDialog.tsx
    - apps/admin/src/components/shared/PageHeader.tsx
    - apps/admin/src/hooks/useSSE.ts
    - apps/admin/components.json
    - apps/admin/src/index.css
    - apps/admin/src/lib/utils.ts
  modified:
    - apps/admin/package.json
    - apps/admin/vite.config.ts
    - apps/admin/tsconfig.json
    - apps/admin/src/main.tsx

key-decisions:
  - "Shadcn init aliases fixed from @shared-types to @/ after auto-detection pointed to wrong package"
  - "RouterProviderProps['router'] explicit type annotation avoids TS2742 cross-package inferred type error"
  - "TooltipProvider wraps entire app in main.tsx per Shadcn sidebar component requirement"
  - "Zustand logout uses dynamic import('../main') for queryClient to avoid circular dependency"
  - "useSSE hooks pass token via query param (not Authorization header) since EventSource cannot send headers"

patterns-established:
  - "Zustand getState() for outside-React access: useAuthStore.getState().accessToken in Axios interceptors"
  - "Shadcn/ui component import path: @/components/ui/{component}"
  - "Shared component import path: @/components/shared/{component}"
  - "Layout component import path: @/components/layout/{component}"
  - "Protected route pattern: ProtectedRoute > AppShell > feature routes"
  - "Login page outside AppShell: separate top-level route without sidebar"

requirements-completed: [R12.10]

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 7 Plan 1: Admin Portal Foundation Summary

**Shadcn/ui + Tailwind v4 design system with Zustand auth, JWT-intercepted Axios client, login page, AppShell layout, and 4 reusable shared components (DataTable, StatusBadge, ConfirmDialog, PageHeader)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T06:43:23Z
- **Completed:** 2026-03-06T06:49:37Z
- **Tasks:** 2
- **Files modified:** 46

## Accomplishments
- Installed and configured Shadcn/ui (New York style, Zinc base) with Tailwind CSS v4, 20+ UI components generated
- Built complete auth flow: Zustand store with localStorage persistence, Axios client with Bearer token interceptor and 401 auto-redirect, login page with form validation
- Created AppShell layout with 256px sidebar (8 nav links with lucide-react icons, active route highlighting) and header (avatar dropdown, role badge, sign-out)
- Delivered 4 reusable shared components: DataTable (sorting/pagination/search), StatusBadge (all enum variants), ConfirmDialog (destructive action confirmation), PageHeader (title + actions layout)
- Set up React Router v6 with ProtectedRoute guard and 13 feature route placeholders ready for 07-02 and 07-03
- Created useSSE hooks for billing progress and notification streams via EventSource

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, configure Shadcn/ui + Tailwind v4, set up core infrastructure** - `bae1258` (feat)
2. **Task 2: Auth store, API client, login page, routing, layout shell, and shared components** - `bc6e679` (feat)

## Files Created/Modified
- `apps/admin/package.json` - Updated with 14 runtime + 1 dev dependency
- `apps/admin/vite.config.ts` - Added @tailwindcss/vite plugin and @ alias
- `apps/admin/tsconfig.json` - Added baseUrl and @/* path alias
- `apps/admin/components.json` - Shadcn/ui configuration (New York, Zinc, CSS vars)
- `apps/admin/src/index.css` - Tailwind v4 @import + Shadcn CSS variables (zinc theme)
- `apps/admin/src/main.tsx` - QueryClientProvider + TooltipProvider + RouterProvider + Toaster
- `apps/admin/src/lib/utils.ts` - cn() utility (clsx + tailwind-merge)
- `apps/admin/src/store/authStore.ts` - Zustand auth store with persist middleware
- `apps/admin/src/api/client.ts` - Axios instance with JWT interceptor and 401 handling
- `apps/admin/src/api/auth.ts` - adminLogin, refreshToken, getMe API functions
- `apps/admin/src/router/index.tsx` - createBrowserRouter with 13 feature routes + login
- `apps/admin/src/router/ProtectedRoute.tsx` - Auth guard redirecting to /login
- `apps/admin/src/pages/Login.tsx` - Centered card login form with zod validation
- `apps/admin/src/components/layout/AppShell.tsx` - Sidebar + Header + Outlet layout
- `apps/admin/src/components/layout/Sidebar.tsx` - 8 nav links with icons, active highlighting
- `apps/admin/src/components/layout/Header.tsx` - User dropdown with role badge and sign-out
- `apps/admin/src/components/shared/StatusBadge.tsx` - Maps status enums to Badge variants
- `apps/admin/src/components/shared/DataTable.tsx` - TanStack Table wrapper with sorting/pagination
- `apps/admin/src/components/shared/ConfirmDialog.tsx` - AlertDialog wrapper for confirmations
- `apps/admin/src/components/shared/PageHeader.tsx` - Page title + description + actions layout
- `apps/admin/src/hooks/useSSE.ts` - useBillingSSE and useNotificationSSE hooks
- `apps/admin/src/components/ui/*.tsx` - 20+ Shadcn UI components (button, card, table, form, etc.)

## Decisions Made
- Shadcn init auto-detected aliases pointing to `@shared-types` package; fixed to `@/` for admin app's own `src/` directory
- Used `RouterProviderProps['router']` explicit type annotation to avoid TS2742 cross-package type inference error with @remix-run/router
- Wrapped entire app in `TooltipProvider` in main.tsx as required by Shadcn sidebar component
- Zustand `logout()` uses dynamic `import('../main')` to access queryClient and avoid circular dependency between authStore and main.tsx
- SSE hooks pass auth token via URL query parameter since browser EventSource API cannot send Authorization headers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shadcn init required Tailwind CSS config to exist before running**
- **Found during:** Task 1 (Shadcn init)
- **Issue:** `npx shadcn@latest init` failed with "No Tailwind CSS configuration found" because index.css with `@import "tailwindcss"` and vite.config.ts with @tailwindcss/vite plugin did not exist yet
- **Fix:** Created index.css and updated vite.config.ts before running shadcn init (reversed step order from plan)
- **Files modified:** apps/admin/src/index.css, apps/admin/vite.config.ts
- **Verification:** shadcn init succeeded on retry
- **Committed in:** bae1258

**2. [Rule 1 - Bug] Fixed Shadcn component aliases pointing to wrong package**
- **Found during:** Task 1 (Post shadcn init)
- **Issue:** components.json aliases auto-resolved to `@shared-types/components` instead of `@/components` because the `@` vite alias was mapped alongside `@shared-types`
- **Fix:** Updated components.json aliases from `@shared-types/*` to `@/*`, moved generated utils.ts from packages/shared-types/src/lib/ to apps/admin/src/lib/
- **Files modified:** apps/admin/components.json, apps/admin/src/lib/utils.ts
- **Verification:** Subsequent shadcn add commands generated components in correct location
- **Committed in:** bae1258

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for correct Shadcn/ui initialization. No scope creep.

## Issues Encountered
- `npx shadcn@latest init` CLI flags changed from plan's assumed `--style` to `-b`/`-t` flags; adapted to current shadcn CLI API
- Shadcn init created utils.ts in `packages/shared-types/src/lib/` due to alias resolution; moved to correct admin app location

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 13 feature routes have placeholder content ready for 07-02 (contract, tenant, formula, service pages) and 07-03 (billing, invoice, dashboard pages)
- DataTable, StatusBadge, ConfirmDialog, PageHeader shared components ready for use in feature pages
- Auth store and API client ready for authenticated API calls
- useSSE hooks ready for billing progress and notification streams
- TypeScript compiles cleanly with zero errors

## Self-Check: PASSED

- All 17 key files verified present on disk
- Both task commits (bae1258, bc6e679) verified in git log
- TypeScript compilation: zero errors

---
*Phase: 07-admin-portal*
*Completed: 2026-03-06*
