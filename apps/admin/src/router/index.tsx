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

// Formula/Service pages (07-02)
import { FormulaList } from '@/pages/formulas/FormulaList';
import { FormulaBuilder } from '@/pages/formulas/FormulaBuilder';
import { ServiceList } from '@/pages/services/ServiceList';

// Area pages
import { AreaList } from '@/pages/areas/AreaList';

// Billing pages (07-02)
import { BillingList } from '@/pages/billing/BillingList';

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
          // Area routes
          { path: 'areas', element: <AreaList /> },
          // Contract routes (07-02)
          { path: 'contracts', element: <ContractList /> },
          { path: 'contracts/new', element: <ContractForm /> },
          { path: 'contracts/:id', element: <ContractDetail /> },
          // Tenant routes (07-02)
          { path: 'tenants', element: <TenantList /> },
          { path: 'tenants/new', element: <TenantForm /> },
          { path: 'tenants/:id', element: <TenantForm /> },
          // Formula routes (07-02)
          { path: 'formulas', element: <FormulaList /> },
          { path: 'formulas/new', element: <FormulaBuilder /> },
          { path: 'formulas/:id', element: <FormulaBuilder /> },
          // Service routes (07-02)
          { path: 'services', element: <ServiceList /> },
          // Billing routes (07-02)
          { path: 'billing', element: <BillingList /> },
          // 07-03 routes
          { path: 'invoices', element: <InvoiceList /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
]);
