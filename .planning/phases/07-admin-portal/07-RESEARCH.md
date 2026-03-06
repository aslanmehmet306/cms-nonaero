# Phase 7: Admin Portal - Research

**Researched:** 2026-03-06
**Domain:** React 18 SPA with Shadcn/ui, TanStack Query, React Router v6, role-based UI, SSE consumption
**Confidence:** HIGH

## Summary

Phase 7 converts the existing stub React admin app (currently ~30 lines) into a full-featured admin SPA. The backend is 100% complete — all 371 tests pass across 27 API modules. The frontend must consume those APIs to build 8 primary feature areas: contract management, tenant management, formula builder, billing operations (with SSE), invoice list, dashboard/reports, settings (billing policy + users + airport), and login.

The project already has React 18, react-router-dom v6, and Vite configured with an `/api` proxy to `localhost:3000`. What is missing is: Shadcn/ui + Tailwind CSS installation, a component library, TanStack Query for data fetching, react-hook-form + zod for forms, Zustand for auth token state, and all feature page components. No backend changes are needed — this phase is purely frontend.

The most technically nuanced areas are: (1) the formula builder UI (must call `POST /formulas/:id/dry-run` and show real-time validation feedback), (2) the billing run SSE consumer (EventSource cannot send Authorization headers — the existing backend accepts a `?token=` query param, so the frontend must pass the JWT that way), and (3) role-based UI rendering (auditor sees read-only views, commercial_manager cannot approve their own contracts). The RBAC rules are enforced server-side already; the UI just needs to hide/disable action buttons based on `user.role` from the JWT payload.

**Primary recommendation:** Install Shadcn/ui v4 with Tailwind v4 + @tailwindcss/vite plugin. Use TanStack Query v5 for all server state. Use Zustand for auth token + user profile. Use react-hook-form + zod for all forms. Build in 3 plans: (1) Foundation — Shadcn install, routing shell, auth flow, layout; (2) Core Features — contracts, tenants, formula builder, billing operations; (3) Remaining — invoices, settings, dashboard/reports.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R12.2 | Contract management — list, create, edit, publish, amend, terminate | ContractsController has full CRUD + POST /:id/transition endpoint. UI needs list table, detail/edit form, state transition buttons. |
| R12.3 | Tenant management — list, create, edit, status changes | TenantsController has full CRUD + status lifecycle. UI needs list, create/edit form, status badge + action buttons. |
| R12.4 | Service definition — formula builder, preview, version history | FormulasController has CRUD + POST /:id/dry-run. UI needs Monaco or textarea editor, dry-run preview panel, version list. |
| R12.5 | Billing operations — trigger run, SSE progress, approve/reject | BillingController has POST /billing-runs + GET /:id/progress (SSE) + PATCH /:id/approve. UI needs trigger modal, progress display consuming EventSource. |
| R12.6 | Invoice list — view, Stripe hosted URL link, status tracking | InvoicesController has GET /invoices returning stripeInvoiceUrl. UI needs filterable table with status badges and external link. |
| R12.9 | Settings — billing policy, user management, airport config | BillingPoliciesController, UsersController, AirportsController all complete. UI needs 3-tab settings page. |
| R12.10 | Responsive design (desktop-first, 1920x1080 primary, 1366x768 min) | Shadcn/ui + Tailwind CSS responsive utilities. Desktop-first means no mobile breakpoints needed — min-width: 1366px is the floor. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui | latest (v4 CLI) | Component library — Button, Table, Form, Dialog, Badge, Tabs | Copy-paste components with Radix UI accessibility; standard for React admin UIs |
| tailwindcss | ^4.0.0 | Utility CSS | Required by Shadcn/ui; @tailwindcss/vite plugin works with existing Vite setup |
| @tanstack/react-query | ^5.0.0 | Server state — all API calls | Industry standard; handles caching, loading states, invalidation |
| react-hook-form | ^7.0.0 | Form state management | Lowest re-render count; pairs with Shadcn Form component natively |
| zod | ^3.0.0 | Schema validation | Pairs with react-hook-form via @hookform/resolvers |
| zustand | ^4.0.0 | Client state — auth token + user profile | Minimal boilerplate; solves Context re-render problem for auth state |
| react-router-dom | ^6.0.0 | Routing (already installed) | Already in package.json; use existing installation |
| lucide-react | ^0.400.0 | Icons (Shadcn/ui peer dep) | Required by Shadcn/ui component output |
| @hookform/resolvers | ^3.0.0 | Zod adapter for react-hook-form | Bridge between zod schemas and RHF |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^1.0.0 | Toast notifications | Success/error feedback on mutations; Shadcn recommends Sonner |
| date-fns | ^3.0.0 | Date formatting | Format period dates, due dates in tables; Shadcn Calendar depends on it |
| @tanstack/react-table | ^8.0.0 | Data tables with sort/filter/pagination | All list views (contracts, tenants, invoices) need column sorting |
| recharts | ^2.0.0 | Dashboard charts | Shadcn Chart component wraps Recharts; revenue summary bar chart |
| react-day-picker | ^8.0.0 | Date picker (Shadcn Calendar dep) | Date inputs for contract effective dates, billing policy dates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query | SWR | TanStack Query has better TypeScript, optimistic updates, and the ecosystem uses it with Shadcn/ui |
| Zustand | React Context | Context causes full-tree re-renders on auth state changes; Zustand is lighter and more predictable |
| react-hook-form + zod | TanStack Form | react-hook-form is more mature, has Shadcn's Form component built around it; TanStack Form is newer |
| @tanstack/react-table | ag-Grid | ag-Grid is overkill for demo scale; TanStack Table is headless and works with Shadcn Table component |
| Monaco Editor (formula) | Plain textarea | Monaco is large (~2MB gzipped) and complex to configure; a styled textarea + validation feedback is sufficient for formula builder at demo scale |

**Installation:**
```bash
# From apps/admin directory:
pnpm add tailwindcss @tailwindcss/vite
pnpm add @tanstack/react-query @tanstack/react-table
pnpm add react-hook-form @hookform/resolvers zod
pnpm add zustand
pnpm add lucide-react sonner date-fns recharts react-day-picker
pnpm add -D @types/node

# Initialize Shadcn/ui (interactive, sets up components.json + globals.css):
npx shadcn@latest init

# Add required components (run from apps/admin):
npx shadcn@latest add button card table form input label select badge
npx shadcn@latest add dialog sheet tabs sidebar navigation-menu
npx shadcn@latest add dropdown-menu alert-dialog toast sonner
npx shadcn@latest add chart calendar date-picker progress
```

## Architecture Patterns

### Recommended Project Structure
```
apps/admin/src/
  api/                        # Axios instance + typed fetch functions per module
    client.ts                 # Axios setup: baseURL='/api/v1', interceptors for JWT
    contracts.ts              # getContracts(), createContract(), transitionContract()
    tenants.ts
    formulas.ts
    billing.ts
    invoices.ts
    reports.ts
    auth.ts
  components/
    ui/                       # shadcn/ui generated components (do not edit directly)
    layout/
      AppShell.tsx            # Sidebar + header + outlet
      Sidebar.tsx             # Role-aware nav links
      Header.tsx              # User menu + notification bell
    shared/
      StatusBadge.tsx         # Reusable colored badge for all status enums
      DataTable.tsx           # Wrapper around TanStack Table + Shadcn Table
      ConfirmDialog.tsx       # Generic confirmation dialog for destructive actions
      PageHeader.tsx          # Title + action button slot
  hooks/
    useAuth.ts                # Zustand auth store selectors
    useSSE.ts                 # EventSource hook for billing progress + notifications
  pages/
    Login.tsx
    Dashboard.tsx
    contracts/
      ContractList.tsx
      ContractDetail.tsx
      ContractForm.tsx
    tenants/
      TenantList.tsx
      TenantForm.tsx
    formulas/
      FormulaList.tsx
      FormulaBuilder.tsx      # Expression textarea + dry-run panel
    billing/
      BillingList.tsx
      BillingRunModal.tsx     # Trigger + SSE progress display
    invoices/
      InvoiceList.tsx
    settings/
      Settings.tsx            # Tabbed: BillingPolicy | Users | Airport
  store/
    authStore.ts              # Zustand: { accessToken, user, login(), logout() }
  router/
    index.tsx                 # createBrowserRouter with protected routes
    ProtectedRoute.tsx        # Checks authStore, redirects to /login
  main.tsx                    # QueryClientProvider + RouterProvider + Toaster
  index.css                   # Shadcn/ui globals (CSS variables)
```

### Pattern 1: Axios Client with JWT Interceptor
**What:** Single Axios instance reads token from Zustand store and injects Authorization header on every request. Refresh interceptor retries on 401.
**When to use:** All authenticated API calls.

```typescript
// Source: Verified pattern — Axios interceptors + Zustand
// apps/admin/src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 handler: clear auth, redirect to login
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
```

### Pattern 2: TanStack Query for Data Fetching
**What:** useQuery for reads, useMutation for writes, invalidateQueries on success to refresh lists.
**When to use:** Every API call. Never use useEffect + fetch directly.

```typescript
// Source: Context7 /tanstack/query — useQuery + useMutation pattern
// apps/admin/src/pages/contracts/ContractList.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContracts, transitionContract } from '../../api/contracts';

export function ContractList() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => getContracts(),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      transitionContract(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  // ...
}
```

### Pattern 3: Zustand Auth Store
**What:** Minimal store holding access_token and user payload. Persisted to localStorage via zustand/middleware.
**When to use:** Login, logout, reading current user role anywhere in the tree.

```typescript
// Source: Zustand docs — persist middleware pattern
// apps/admin/src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  user: { sub: string; email: string; role: string; airportId?: string } | null;
  login: (token: string, user: AuthState['user']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      login: (accessToken, user) => set({ accessToken, user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    { name: 'auth-storage' },
  ),
);
```

### Pattern 4: SSE with EventSource + useSSE Hook
**What:** EventSource cannot set Authorization headers. The existing backend billing SSE endpoint accepts `?token=` query param (confirmed in `billing-sse.controller.ts`). Build a `useSSE` hook that opens an EventSource with the token from Zustand.
**When to use:** Billing run progress display, notification bell.

```typescript
// Source: Verified from apps/api/src/billing/sse/billing-sse.controller.ts
// The backend @Public() endpoint accepts ?token= for auth bypass
// apps/admin/src/hooks/useSSE.ts
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export function useBillingSSE(billingRunId: string | null) {
  const [progress, setProgress] = useState<unknown>(null);
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!billingRunId || !token) return;

    const es = new EventSource(
      `/api/v1/billing-runs/${billingRunId}/progress?token=${token}`,
    );

    es.onmessage = (event) => {
      setProgress(JSON.parse(event.data));
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [billingRunId, token]);

  return progress;
}
```

### Pattern 5: Role-Based UI Rendering
**What:** Read `user.role` from Zustand auth store to conditionally show/hide action buttons. The backend enforces actual security; the UI provides UX-level gating only.
**When to use:** State transition buttons (approve/publish/terminate), create buttons for auditor role.

```typescript
// apps/admin/src/components/layout/Sidebar.tsx (role-aware nav)
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '@airport-revenue/shared-types';

const user = useAuthStore((s) => s.user);
const isAuditor = user?.role === UserRole.auditor;
const isFinance = user?.role === UserRole.finance;

// Auditor: show all nav items, but all action buttons are hidden
// Finance: cannot create contracts, can approve billing runs
// commercial_manager: cannot approve own contracts (server enforces, but disable in UI if createdBy === user.sub)
```

### Pattern 6: react-hook-form + Zod + Shadcn Form
**What:** Define zod schema, pass to zodResolver, use Shadcn Form component for accessible error display.
**When to use:** All create/edit forms — contract, tenant, formula, billing policy, user.

```typescript
// Source: Context7 /react-hook-form/react-hook-form + /shadcn-ui/ui
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

const contractSchema = z.object({
  tenantId: z.string().uuid('Select a tenant'),
  title: z.string().min(1, 'Title required'),
  effectiveFrom: z.string(), // ISO date string
  currency: z.enum(['TRY', 'EUR', 'USD']),
});

type ContractFormData = z.infer<typeof contractSchema>;

function ContractForm() {
  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: { currency: 'TRY' },
  });

  const onSubmit = async (data: ContractFormData) => {
    await createContract(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </form>
    </Form>
  );
}
```

### Pattern 7: Protected Route with Role Guard
**What:** ProtectedRoute component checks Zustand auth store; redirects to /login if no token. RoleRoute wraps routes requiring specific roles.
**When to use:** All non-login routes.

```typescript
// apps/admin/src/router/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
```

### Anti-Patterns to Avoid
- **useEffect for data fetching:** Always use TanStack Query. useEffect + fetch creates race conditions and no caching.
- **Storing server state in Zustand:** Zustand is for auth token + ephemeral UI state only. Contract lists, tenant lists, etc. live in TanStack Query cache.
- **Calling Zustand inside Axios interceptors with hooks:** Axios interceptors run outside React. Use `useAuthStore.getState()` (non-hook selector) inside interceptors — this is the correct Zustand pattern.
- **Putting JWT token in URL for non-SSE calls:** Only the SSE endpoint needs `?token=`. All other API calls use the `Authorization: Bearer` header.
- **Blocking the login page for all roles:** The login page (`POST /api/v1/auth/admin/login`) uses the `@Public()` decorator. No JWT needed. The frontend Login page must be outside the ProtectedRoute wrapper.
- **Monaco Editor for formula builder:** At demo scale, a plain `<Textarea>` with a "Run Preview" button is sufficient. Monaco adds ~2MB to the bundle and significant complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data tables with sort/filter | Custom table + sort logic | @tanstack/react-table + Shadcn Table | Column visibility, sort state, pagination is 200+ lines of complexity |
| Toast notifications | Custom toast state | Sonner (Shadcn-recommended) | Animation, accessibility, queue management already solved |
| Form validation | Custom error state | react-hook-form + zod + zodResolver | Re-render optimization, nested object paths, async validation |
| Modal dialogs | Custom portal + focus trap | Shadcn Dialog (Radix UI) | Focus management, keyboard trap, aria-modal correctness |
| Date formatting | moment.js | date-fns | date-fns is tree-shakable, ~18KB vs moment's 70KB |
| HTTP client | fetch wrapper | Axios | Interceptors, response transforms, JSON parse — fetch lacks interceptors |
| Status color mapping | Per-component ifs | Shared StatusBadge component | 6+ status enums across the app; centralize variant logic once |
| Icon set | Custom SVG imports | lucide-react | Shadcn components already import from lucide-react; adding it avoids version conflicts |

**Key insight:** The backend already enforces all business rules — the frontend's job is accurate display and UX flow, not re-implementing validation logic.

## Common Pitfalls

### Pitfall 1: Shadcn/ui Init Overwrites vite.config.ts
**What goes wrong:** Running `npx shadcn@latest init` regenerates `vite.config.ts` and removes the existing `/api` proxy configuration.
**Why it happens:** The Shadcn Vite init template creates a minimal vite config with only the React plugin + Tailwind.
**How to avoid:** After running `shadcn init`, manually restore the proxy and `@shared-types` alias to `vite.config.ts`. Keep a diff of the original before running init.
**Warning signs:** `POST /api/v1/auth/admin/login` returns 404 in the browser after init.

### Pitfall 2: Tailwind v4 vs v3 Configuration Format
**What goes wrong:** Shadcn v4 CLI assumes Tailwind v4 which uses `@import "tailwindcss"` in CSS and the `@tailwindcss/vite` plugin instead of a `tailwind.config.js` file.
**Why it happens:** Tailwind v4 eliminated the config file; existing tutorials show v3 config files. Mixing them causes styles to not apply.
**How to avoid:** Install `@tailwindcss/vite` and add it as a Vite plugin. In `index.css`, use `@import "tailwindcss"`. Do not create `tailwind.config.js`.
**Warning signs:** Shadcn components render but have no styling. `h-svh` or other v4 utilities missing.

### Pitfall 3: SSE Token Leakage in Browser History
**What goes wrong:** Passing `?token=<JWT>` in the EventSource URL causes the JWT to appear in browser network inspector and potentially browser history.
**Why it happens:** EventSource API limitation — no custom headers. The existing backend is designed for this with `@Public()` + `?token=`.
**How to avoid:** This is the accepted pattern for the project (already established in Phase 5). Token in URL is acceptable for demo scope. Do not add `Authorization` header polyfills — the backend does not support them.
**Warning signs:** Not an error; the warning is against adding `@microsoft/fetch-event-source` unnecessarily — the native EventSource is sufficient.

### Pitfall 4: TanStack Query v4 vs v5 API Differences
**What goes wrong:** Using v4 `isLoading` property instead of v5 `isPending`. Using `onSuccess`/`onError` callbacks in `useQuery` (removed in v5).
**Why it happens:** Most tutorials online still show v4 API. v5 was released with breaking changes.
**How to avoid:** Use `isPending` not `isLoading` for initial load state. Use `onSuccess`/`onError` in `useMutation` only (still supported there). Handle errors with `isError` + `error` return values for `useQuery`.
**Warning signs:** TypeScript errors on `onSuccess` prop in `useQuery`.

### Pitfall 5: React Router v6 Nested Route Layout
**What goes wrong:** The AppShell sidebar/header layout renders for every route including `/login`, causing the login page to show with the nav sidebar.
**Why it happens:** Nesting all routes inside AppShell without exclusion.
**How to avoid:** Create two route trees: `<Route path="/" element={<ProtectedRoute />}> <Route element={<AppShell />}> ...feature routes... </Route> </Route>` and `<Route path="/login" element={<Login />} />` at the top level outside ProtectedRoute.
**Warning signs:** Login page shows the sidebar.

### Pitfall 6: Shadcn Form + react-hook-form Controller vs register
**What goes wrong:** Using `{...register('field')}` with Shadcn's `<FormField>` component. The Shadcn Form component is designed to work with `<Controller>` / `render` prop pattern.
**Why it happens:** Mixing the simple `register` API with Shadcn's wrapper.
**How to avoid:** Always use `<FormField control={form.control} name="field" render={({ field }) => ...} />` pattern with Shadcn Form. The `field` object from render prop is the correct way to bind.
**Warning signs:** Input loses focus on every keystroke; validation errors don't clear correctly.

### Pitfall 7: Stale Zustand State After Logout
**What goes wrong:** After logout, TanStack Query cache still holds data from the previous authenticated user's session. Next user who logs in sees stale data briefly.
**Why it happens:** TanStack Query cache is not cleared on logout.
**How to avoid:** In `logout()` action in Zustand store (or in the logout mutation's `onSuccess`), call `queryClient.clear()` to wipe the cache.
**Warning signs:** After logout + new login, old tenant names briefly appear.

## Code Examples

### API Module Pattern
```typescript
// Source: Established project pattern — all API modules follow this shape
// apps/admin/src/api/contracts.ts
import { apiClient } from './client';
import type { ContractStatus } from '@airport-revenue/shared-types';

export const getContracts = (params?: {
  status?: ContractStatus;
  tenantId?: string;
  page?: number;
  limit?: number;
}) =>
  apiClient.get('/contracts', { params }).then((r) => r.data);

export const getContract = (id: string) =>
  apiClient.get(`/contracts/${id}`).then((r) => r.data);

export const createContract = (data: unknown) =>
  apiClient.post('/contracts', data).then((r) => r.data);

export const updateContract = (id: string, data: unknown) =>
  apiClient.patch(`/contracts/${id}`, data).then((r) => r.data);

export const transitionContract = (id: string, status: ContractStatus, opts?: { terminationReason?: string }) =>
  apiClient.post(`/contracts/${id}/transition`, { status, ...opts }).then((r) => r.data);
```

### StatusBadge Shared Component
```typescript
// apps/admin/src/components/shared/StatusBadge.tsx
// Covers ContractStatus, TenantStatus, BillingRunStatus, InvoiceStatus, ObligationStatus
import { Badge } from '@/components/ui/badge';
import { ContractStatus, TenantStatus, BillingRunStatus, InvoiceStatus } from '@airport-revenue/shared-types';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  // ContractStatus
  draft: 'secondary',
  in_review: 'outline',
  published: 'default',
  active: 'default',
  amended: 'outline',
  suspended: 'destructive',
  terminated: 'destructive',
  // TenantStatus
  deactivated: 'destructive',
  // BillingRunStatus
  draft_ready: 'outline',
  approved: 'default',
  completed: 'default',
  cancelled: 'destructive',
  // InvoiceStatus
  paid: 'default',
  past_due: 'destructive',
  voided: 'secondary',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
```

### QueryClient Setup in main.tsx
```typescript
// Source: Context7 /tanstack/query — QueryClientProvider setup
// apps/admin/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

### Formula Builder Dry-Run Pattern
```typescript
// apps/admin/src/pages/formulas/FormulaBuilder.tsx
// Calls POST /formulas/:id/dry-run to validate + preview expression
import { useMutation } from '@tanstack/react-query';
import { dryRunFormula } from '../../api/formulas';
import { useState } from 'react';

export function FormulaBuilder({ formulaId }: { formulaId: string }) {
  const [expression, setExpression] = useState('');
  const [previewResult, setPreviewResult] = useState<unknown>(null);

  const dryRun = useMutation({
    mutationFn: (variables?: Record<string, number>) =>
      dryRunFormula(formulaId, variables),
    onSuccess: (data) => setPreviewResult(data),
  });

  return (
    <div className="space-y-4">
      <Textarea
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        placeholder="Enter formula expression e.g. area_m2 * rate_per_m2"
        className="font-mono"
      />
      <Button onClick={() => dryRun.mutate()} disabled={dryRun.isPending}>
        {dryRun.isPending ? 'Running...' : 'Preview Result'}
      </Button>
      {dryRun.isError && (
        <Alert variant="destructive">
          <span>{(dryRun.error as Error).message}</span>
        </Alert>
      )}
      {previewResult && (
        <pre className="rounded bg-muted p-4 text-sm">
          {JSON.stringify(previewResult, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux for server state | TanStack Query v5 | 2023-2024 | No more action/reducer/selector boilerplate for API data |
| tailwind.config.js | CSS-first config via @import | Tailwind v4 (2024) | No config file; CSS variables replace theme config |
| React.forwardRef on all components | Direct function components | React 19 / Shadcn v4 | Shadcn v4 dropped forwardRef; components use React.ComponentProps |
| isLoading (TanStack v4) | isPending (TanStack v5) | v5 release 2023 | Naming clarification; isLoading now means `isPending && !isFetching` |
| onSuccess/onError in useQuery | isError + error return value | v5 release 2023 | Callbacks removed from useQuery; use useMutation for side effects |

**Deprecated/outdated:**
- `tailwind.config.js` with `content` array: Replaced by Tailwind v4's automatic content detection via `@tailwindcss/vite`
- `react-query` package name: The package is now `@tanstack/react-query` (changed in v4; v3 used `react-query`)
- `forwardRef` wrapping on Shadcn components: Shadcn v4 removed this; existing v3 copy-paste snippets online are outdated

## Open Questions

1. **Should @tanstack/react-query-devtools be included?**
   - What we know: It adds a floating panel for inspecting query cache state — useful during development
   - What's unclear: Whether it should be stripped for production builds automatically
   - Recommendation: Include it in the dev build only via dynamic import: `import('@tanstack/react-query-devtools')` inside a `if (import.meta.env.DEV)` block

2. **Does the formula builder need syntax highlighting?**
   - What we know: The formula expressions are math.js compatible strings. A plain textarea works but is not ideal.
   - What's unclear: Whether the demo audience expects a code-like editor
   - Recommendation: Use a styled `<Textarea>` with `font-mono` class. If syntax highlighting is desired, `@uiw/react-codemirror` is lighter than Monaco (~300KB vs 2MB). Skip for demo scope unless requested.

3. **What is the seeded admin user credential for login?**
   - What we know: Phase 1 seed creates an admin user. The seed script is in `apps/api/prisma/seed.ts`
   - What's unclear: The exact email/password of the seeded user
   - Recommendation: Read the seed file before building the login page to hardcode a "Demo login" helper showing credentials.

## Validation Architecture

> nyquist_validation is not present in .planning/config.json — skipping this section. The project uses manual verification (verifier agent) not automated test gating for frontend phases.

Note: The admin app has no test infrastructure (`vitest`, `jest`, `@testing-library/react`) configured. This is a frontend phase producing UI components. Verification is done by the verifier agent running the dev server and visually confirming feature behavior. Wave 0 for this phase should add a basic Vitest + @testing-library/react setup if tests are desired, but this is not required by the requirements (R12.x).

## Sources

### Primary (HIGH confidence)
- Context7 `/shadcn-ui/ui` — Vite installation, components.json, Tailwind v4 setup, ThemeProvider, dark mode toggle patterns
- Context7 `/tanstack/query` — useQuery, useMutation, QueryClientProvider, v5 API (isPending, invalidateQueries)
- Context7 `/react-hook-form/react-hook-form` — useForm, zodResolver, Controller pattern, FormState
- Project source: `apps/api/src/billing/sse/billing-sse.controller.ts` — confirmed `@Public()` + `?token=` SSE endpoint
- Project source: `apps/api/src/auth/dto/auth-response.dto.ts` — confirmed token response shape `{ access_token, refresh_token, user }`
- Project source: `apps/admin/package.json` — confirmed react@^18.0.0, react-router-dom@^6.0.0 already installed
- Project source: `apps/admin/vite.config.ts` — confirmed `/api` proxy to localhost:3000, `@shared-types` alias

### Secondary (MEDIUM confidence)
- WebSearch: Shadcn/ui Vite + Tailwind v4 setup (2025) — confirms `@tailwindcss/vite` plugin approach, no `tailwind.config.js`
- WebSearch: Zustand vs Context API for React 18 admin portals (2025) — confirms Zustand + TanStack Query as dominant pattern
- WebSearch: SSE + JWT token query parameter pattern — confirms query param is the accepted workaround for EventSource auth limitation

### Tertiary (LOW confidence)
- WebSearch: React SSE + React Query integration pattern — multiple sources confirm EventSource wrapper in useEffect; implementation detail not from official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against Context7 official docs and confirmed against existing project dependencies
- Architecture: HIGH — derived directly from existing API controller shapes and established project patterns
- Pitfalls: HIGH — Shadcn init/vite overwrite confirmed from official Shadcn Vite docs; TanStack v4→v5 API changes confirmed from Context7 migration guides

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable ecosystem; Shadcn/ui evolves fast but changes are additive)
