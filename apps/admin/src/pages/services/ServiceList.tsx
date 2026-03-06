import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  getServices,
  createService,
  publishService,
  newServiceVersion,
  deprecateService,
  type ServiceDefinition,
} from '@/api/services';
import { getFormulas, type Formula } from '@/api/formulas';
import { ServiceType, ServiceStatus, BillingFrequency } from '@shared-types/enums';

const typeOptions = Object.values(ServiceType);
const statusOptions = Object.values(ServiceStatus);
const frequencyOptions = Object.values(BillingFrequency);

const serviceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  description: z.string().optional(),
  billingFrequency: z.string().min(1, 'Billing frequency is required'),
  formulaId: z.string().optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

export function ServiceList() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['services', typeFilter, statusFilter],
    queryFn: () =>
      getServices({
        ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      }),
  });

  const { data: formulasData } = useQuery({
    queryKey: ['formulas-published'],
    queryFn: () => getFormulas({ status: 'published', limit: 100 }),
  });

  const publishedFormulas: Formula[] = formulasData?.data ?? [];

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service published');
    },
    onError: () => {
      toast.error('Failed to publish service');
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: (id: string) => newServiceVersion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('New version created');
    },
    onError: () => {
      toast.error('Failed to create new version');
    },
  });

  const deprecateMutation = useMutation({
    mutationFn: (id: string) => deprecateService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service deprecated');
    },
    onError: () => {
      toast.error('Failed to deprecate service');
    },
  });

  const columns: ColumnDef<ServiceDefinition, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
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
      accessorFn: (row) => row.formula?.name ?? '-',
      id: 'formulaName',
      header: 'Linked Formula',
    },
    {
      accessorKey: 'billingFrequency',
      header: 'Frequency',
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return val
          ? val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : '-';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const svc = row.original;
        return (
          <div className="flex items-center gap-1">
            {svc.status === ServiceStatus.draft && (
              <ConfirmDialog
                title="Publish Service?"
                description="This will make the service available for use."
                onConfirm={() => publishMutation.mutate(svc.id)}
                trigger={
                  <Button variant="outline" size="sm">
                    Publish
                  </Button>
                }
              />
            )}
            {svc.status === ServiceStatus.published && (
              <>
                <ConfirmDialog
                  title="New Version?"
                  description="Create a new draft version of this service."
                  onConfirm={() => newVersionMutation.mutate(svc.id)}
                  trigger={
                    <Button variant="outline" size="sm">
                      New Version
                    </Button>
                  }
                />
                <ConfirmDialog
                  title="Deprecate Service?"
                  description="Deprecated services cannot be assigned to new contracts."
                  variant="destructive"
                  onConfirm={() => deprecateMutation.mutate(svc.id)}
                  trigger={
                    <Button variant="destructive" size="sm">
                      Deprecate
                    </Button>
                  }
                />
              </>
            )}
          </div>
        );
      },
    },
  ];

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      type: ServiceType.rent,
      description: '',
      billingFrequency: BillingFrequency.monthly,
      formulaId: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ServiceFormValues) =>
      createService({
        name: data.name,
        type: data.type,
        description: data.description || undefined,
        billingFrequency: data.billingFrequency,
        formulaId: data.formulaId || undefined,
      } as Partial<ServiceDefinition>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service created');
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast.error('Failed to create service');
    },
  });

  function onSubmit(values: ServiceFormValues) {
    createMutation.mutate(values);
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Services"
        description="Manage service definitions"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Service
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
        <p className="text-muted-foreground">Loading services...</p>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          searchKey="name"
        />
      )}

      {/* Create Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Service</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Service name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {typeOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Frequency</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {frequencyOptions.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="formulaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked Formula (optional)</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select formula" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {publishedFormulas.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name} ({f.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Service'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
