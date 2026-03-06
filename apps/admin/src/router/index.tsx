import { createBrowserRouter, type RouterProviderProps } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { InvoiceList } from '@/pages/invoices/InvoiceList';

// Placeholder component for routes built in 07-02
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
          { path: 'contracts', element: <Placeholder title="Contracts" /> },
          { path: 'contracts/new', element: <Placeholder title="New Contract" /> },
          { path: 'contracts/:id', element: <Placeholder title="Contract Detail" /> },
          { path: 'tenants', element: <Placeholder title="Tenants" /> },
          { path: 'tenants/new', element: <Placeholder title="New Tenant" /> },
          { path: 'tenants/:id', element: <Placeholder title="Edit Tenant" /> },
          { path: 'formulas', element: <Placeholder title="Formulas" /> },
          { path: 'formulas/:id', element: <Placeholder title="Formula Builder" /> },
          { path: 'services', element: <Placeholder title="Services" /> },
          { path: 'billing', element: <Placeholder title="Billing" /> },
          { path: 'invoices', element: <InvoiceList /> },
          { path: 'settings', element: <Placeholder title="Settings" /> },
        ],
      },
    ],
  },
]);
