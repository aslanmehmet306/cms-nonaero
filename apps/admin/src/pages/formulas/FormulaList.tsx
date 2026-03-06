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
import { getFormulas, type Formula } from '@/api/formulas';
import { FormulaType, FormulaStatus } from '@shared-types/enums';

const typeOptions = Object.values(FormulaType);
const statusOptions = Object.values(FormulaStatus);

const columns: ColumnDef<Formula, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        to={`/formulas/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => {
      const val = getValue() as string;
      return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
  },
  {
    accessorKey: 'expression',
    header: 'Expression',
    cell: ({ getValue }) => {
      const val = getValue() as string;
      return (
        <code className="max-w-[200px] truncate block font-mono text-xs">
          {val.length > 50 ? val.slice(0, 50) + '...' : val}
        </code>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Link to={`/formulas/${row.original.id}`}>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </Link>
    ),
  },
];

export function FormulaList() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['formulas', typeFilter, statusFilter],
    queryFn: () =>
      getFormulas({
        ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      }),
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Formulas"
        description="Manage billing formulas and expressions"
        actions={
          <Button onClick={() => navigate('/formulas/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Formula
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
        <p className="text-muted-foreground">Loading formulas...</p>
      ) : (
        <DataTable columns={columns} data={data?.data ?? []} searchKey="name" />
      )}
    </div>
  );
}
