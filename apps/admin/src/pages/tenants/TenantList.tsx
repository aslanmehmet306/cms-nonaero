import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getTenants, updateTenant, type Tenant } from '@/api/tenants';
import { TenantStatus } from '@shared-types/enums';

// Status transition config per current status
const statusActions: Record<string, { label: string; target: string; variant?: 'destructive' }[]> = {
  [TenantStatus.active]: [
    { label: 'Suspend', target: TenantStatus.suspended, variant: 'destructive' },
    { label: 'Deactivate', target: TenantStatus.deactivated, variant: 'destructive' },
  ],
  [TenantStatus.suspended]: [
    { label: 'Activate', target: TenantStatus.active },
    { label: 'Deactivate', target: TenantStatus.deactivated, variant: 'destructive' },
  ],
  [TenantStatus.deactivated]: [
    { label: 'Activate', target: TenantStatus.active },
  ],
};

export function TenantList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => getTenants(),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateTenant(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant status updated');
    },
    onError: () => {
      toast.error('Failed to update tenant status');
    },
  });

  const columns: ColumnDef<Tenant, unknown>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
    },
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: 'currency',
      header: 'Currency',
    },
    {
      accessorKey: 'contactEmail',
      header: 'Contact Email',
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const tenant = row.original;
        const actions = statusActions[tenant.status] ?? [];

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/tenants/${tenant.id}`)}
            >
              Edit
            </Button>
            {actions.map((a) => (
              <ConfirmDialog
                key={a.target}
                title={`${a.label} Tenant?`}
                description={`Are you sure you want to ${a.label.toLowerCase()} "${tenant.name}"?`}
                variant={a.variant}
                onConfirm={() =>
                  transitionMutation.mutate({
                    id: tenant.id,
                    status: a.target,
                  })
                }
                trigger={
                  <Button
                    variant={a.variant === 'destructive' ? 'destructive' : 'outline'}
                    size="sm"
                  >
                    {a.label}
                  </Button>
                }
              />
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Tenants"
        description="Manage airport tenants"
        actions={
          <Button onClick={() => navigate('/tenants/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Tenant
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading tenants...</p>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          searchKey="name"
        />
      )}
    </div>
  );
}
