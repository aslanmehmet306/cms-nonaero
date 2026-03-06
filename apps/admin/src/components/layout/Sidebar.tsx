import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Building2,
  Wrench,
  Calculator,
  CreditCard,
  Receipt,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Contracts', path: '/contracts', icon: FileText },
  { label: 'Tenants', path: '/tenants', icon: Building2 },
  { label: 'Services', path: '/services', icon: Wrench },
  { label: 'Formulas', path: '/formulas', icon: Calculator },
  { label: 'Billing', path: '/billing', icon: CreditCard },
  { label: 'Invoices', path: '/invoices', icon: Receipt },
  { label: 'Settings', path: '/settings', icon: Settings },
] as const;

export function Sidebar() {
  const location = useLocation();

  function isActive(path: string) {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  }

  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* App title */}
      <div className="flex h-14 items-center border-b px-6">
        <h1 className="text-lg font-semibold tracking-tight">ADB Revenue</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
