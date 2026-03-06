import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getContracts, type Contract } from '@/api/contracts';
import { useIsReadOnly } from '@/hooks/useRoleAccess';
import { ContractStatus } from '@shared-types/enums';

const statusOptions = Object.values(ContractStatus);

const columns: ColumnDef<Contract, unknown>[] = [
  {
    accessorKey: 'contractNumber',
    header: 'Contract #',
  },
  {
    accessorFn: (row) => row.tenant?.name ?? row.tenantId,
    id: 'tenantName',
    header: 'Tenant',
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
    accessorKey: 'effectiveFrom',
    header: 'Effective From',
    cell: ({ getValue }) => {
      const val = getValue() as string;
      return val ? new Date(val).toLocaleDateString() : '-';
    },
  },
  {
    accessorKey: 'effectiveTo',
    header: 'Effective To',
    cell: ({ getValue }) => {
      const val = getValue() as string;
      return val ? new Date(val).toLocaleDateString() : '-';
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Link to={`/contracts/${row.original.id}`}>
        <Button variant="ghost" size="sm">
          View
        </Button>
      </Link>
    ),
  },
];

export function ContractList() {
  const navigate = useNavigate();
  const readOnly = useIsReadOnly();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', statusFilter],
    queryFn: () =>
      getContracts(
        statusFilter !== 'all' ? { status: statusFilter } : undefined,
      ),
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Contracts"
        description="Manage airport tenant contracts"
        actions={
          !readOnly ? (
            <Button onClick={() => navigate('/contracts/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Contract
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading contracts...</p>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          searchKey="contractNumber"
        />
      )}
    </div>
  );
}
