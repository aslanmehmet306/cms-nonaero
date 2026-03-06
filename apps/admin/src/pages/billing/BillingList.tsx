import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  getBillingRuns,
  approveBillingRun,
  rejectBillingRun,
  cancelBillingRun,
  rerunBillingRun,
  type BillingRun,
} from '@/api/billing';
import { BillingRunModal } from './BillingRunModal';
import { useIsReadOnly } from '@/hooks/useRoleAccess';
import { BillingRunStatus } from '@shared-types/enums';

export function BillingList() {
  const queryClient = useQueryClient();
  const readOnly = useIsReadOnly();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['billing-runs'],
    queryFn: () => getBillingRuns(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveBillingRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      toast.success('Billing run approved');
    },
    onError: () => {
      toast.error('Failed to approve billing run');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectBillingRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      toast.success('Billing run rejected');
    },
    onError: () => {
      toast.error('Failed to reject billing run');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBillingRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      toast.success('Billing run cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel billing run');
    },
  });

  const rerunMutation = useMutation({
    mutationFn: (id: string) => rerunBillingRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      toast.success('Billing run re-triggered');
    },
    onError: () => {
      toast.error('Failed to re-run billing');
    },
  });

  const columns: ColumnDef<BillingRun, unknown>[] = [
    {
      accessorKey: 'id',
      header: 'Run ID',
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return <span className="font-mono text-xs">{val.slice(0, 8)}...</span>;
      },
    },
    {
      accessorKey: 'periodStart',
      header: 'Period',
      cell: ({ row }) => {
        const start = new Date(row.original.periodStart).toLocaleDateString();
        const end = new Date(row.original.periodEnd).toLocaleDateString();
        return `${start} - ${end}`;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: 'mode',
      header: 'Mode',
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return val
          ? val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : '-';
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) =>
        new Date(getValue() as string).toLocaleDateString(),
    },
    {
      accessorKey: 'completedAt',
      header: 'Completed',
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        return val ? new Date(val).toLocaleDateString() : '-';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const run = row.original;
        if (readOnly) return <span className="text-xs text-muted-foreground">View only</span>;
        return (
          <div className="flex items-center gap-1">
            {run.status === BillingRunStatus.draft_ready && (
              <>
                <ConfirmDialog
                  title="Approve Billing Run?"
                  description="This will approve the billing run and start invoice generation."
                  onConfirm={() => approveMutation.mutate(run.id)}
                  trigger={
                    <Button variant="default" size="sm">
                      Approve
                    </Button>
                  }
                />
                <ConfirmDialog
                  title="Reject Billing Run?"
                  description="This will reject the billing run."
                  variant="destructive"
                  onConfirm={() => rejectMutation.mutate(run.id)}
                  trigger={
                    <Button variant="destructive" size="sm">
                      Reject
                    </Button>
                  }
                />
              </>
            )}
            {(run.status === BillingRunStatus.initiated ||
              run.status === BillingRunStatus.scoping ||
              run.status === BillingRunStatus.calculating) && (
              <ConfirmDialog
                title="Cancel Billing Run?"
                description="This will cancel the in-progress billing run."
                variant="destructive"
                onConfirm={() => cancelMutation.mutate(run.id)}
                trigger={
                  <Button variant="destructive" size="sm">
                    Cancel
                  </Button>
                }
              />
            )}
            {(run.status === BillingRunStatus.completed ||
              run.status === BillingRunStatus.cancelled ||
              run.status === BillingRunStatus.partial) && (
              <ConfirmDialog
                title="Re-run Billing?"
                description="This will create a new billing run based on this one."
                onConfirm={() => rerunMutation.mutate(run.id)}
                trigger={
                  <Button variant="outline" size="sm">
                    Rerun
                  </Button>
                }
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Billing Runs"
        description="Manage billing runs and invoicing"
        actions={
          !readOnly ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Billing Run
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading billing runs...</p>
      ) : (
        <DataTable columns={columns} data={data?.data ?? []} />
      )}

      <BillingRunModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
        }}
      />
    </div>
  );
}
