import { createBrowserRouter, type RouterProviderProps } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { InvoiceList } from '@/pages/invoices/InvoiceList';
import { Settings } from '@/pages/settings/Settings';

// Contract pages (07-02)
import { ContractList } from '@/pages/contracts/ContractList';
import { ContractDetail } from '@/pages/contracts/ContractDetail';
import { ContractForm } from '@/pages/contracts/ContractForm';

// Tenant pages (07-02)
import { TenantList } from '@/pages/tenants/TenantList';
import { TenantForm } from '@/pages/tenants/TenantForm';

// Placeholder component for routes not yet built
function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">Coming soon</p>
    </div>
  );
}

export const router: RouterProviderProps['router'] = createBrowserRouter([
  // Public route — Login page renders OUTSIDE AppShell (no sidebar)
  {
    path: '/login',
    element: <Login />,
  },
  // Protected routes — all wrapped in ProtectedRoute + AppShell
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Dashboard /> },
          // Contract routes (07-02)
          { path: 'contracts', element: <ContractList /> },
          { path: 'contracts/new', element: <ContractForm /> },
          { path: 'contracts/:id', element: <ContractDetail /> },
          // Tenant routes (07-02)
          { path: 'tenants', element: <TenantList /> },
          { path: 'tenants/new', element: <TenantForm /> },
          { path: 'tenants/:id', element: <TenantForm /> },
          // Formula/Service/Billing routes — placeholders for 07-02 Task 2
          { path: 'formulas', element: <Placeholder title="Formulas" /> },
          { path: 'formulas/new', element: <Placeholder title="New Formula" /> },
          { path: 'formulas/:id', element: <Placeholder title="Formula Builder" /> },
          { path: 'services', element: <Placeholder title="Services" /> },
          { path: 'billing', element: <Placeholder title="Billing" /> },
          // 07-03 routes
          { path: 'invoices', element: <InvoiceList /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
]);
