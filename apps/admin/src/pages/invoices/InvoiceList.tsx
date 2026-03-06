import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getInvoices, type Invoice } from '@/api/invoices';
import { InvoiceStatus } from '@shared-types/enums';

function formatCurrency(amount: string | number, currency: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency.toUpperCase()} ${num.toFixed(2)}`;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return format(new Date(dateStr), 'dd MMM yyyy');
}

const columns: ColumnDef<Invoice, unknown>[] = [
  {
    accessorKey: 'id',
    header: 'Invoice ID',
    cell: ({ row }) => {
      const stripeId = row.original.stripeInvoiceId;
      const id = stripeId || row.original.id;
      return (
        <span className="font-mono text-xs">
          {id.length > 16 ? `${id.slice(0, 16)}...` : id}
        </span>
      );
    },
  },
  {
    accessorKey: 'tenant.name',
    header: 'Tenant',
    cell: ({ row }) => row.original.tenant?.name ?? '-',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) =>
      formatCurrency(row.original.amount, row.original.currency),
  },
  {
    accessorKey: 'currency',
    header: 'Currency',
    cell: ({ row }) => row.original.currency.toUpperCase(),
  },
  {
    id: 'period',
    header: 'Period',
    cell: ({ row }) =>
      `${formatDate(row.original.periodStart)} - ${formatDate(row.original.periodEnd)}`,
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: ({ row }) => {
      const dueDate = row.original.dueDate;
      const isPastDue = row.original.status === 'past_due';
      return (
        <span className={isPastDue ? 'font-semibold text-destructive' : ''}>
          {formatDate(dueDate)}
        </span>
      );
    },
  },
  {
    accessorKey: 'issuedAt',
    header: 'Issued',
    cell: ({ row }) => formatDate(row.original.issuedAt),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const url = row.original.stripeInvoiceUrl;
      if (!url) return null;
      return (
        <Button variant="ghost" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-4 w-4" />
            View in Stripe
          </a>
        </Button>
      );
    },
  },
];

export function InvoiceList() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: [
      'invoices',
      {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        tenantId: tenantFilter !== 'all' ? tenantFilter : undefined,
      },
    ],
    queryFn: () =>
      getInvoices({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        tenantId: tenantFilter !== 'all' ? tenantFilter : undefined,
      }),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const invoices = data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Invoices"
        description="View and manage billing invoices"
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(InvoiceStatus).map((status) => (
              <SelectItem key={status} value={status}>
                {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tenantFilter} onValueChange={setTenantFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tenant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tenants</SelectItem>
            {/* Tenants will be loaded from unique values in data */}
            {Array.from(
              new Map(
                invoices
                  .filter((inv) => inv.tenant)
                  .map((inv) => [inv.tenant!.id, inv.tenant!]),
              ).values(),
            ).map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {invoices.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-md border">
          <p className="text-muted-foreground">No invoices found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={invoices} pageSize={10} />
        </div>
      )}
    </div>
  );
}
