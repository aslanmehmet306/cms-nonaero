import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  getContract,
  createContract,
  updateContract,
  getContractAreas,
  getContractServices,
  addContractArea,
  addContractService,
  removeContractArea,
  removeContractService,
  type ContractArea,
  type ContractService,
} from '@/api/contracts';
import { getTenants, type Tenant } from '@/api/tenants';
import { getAreas, type Area } from '@/api/areas';
import { getServices, type ServiceDefinition } from '@/api/services';
import { ContractStatus } from '@shared-types/enums';

const contractSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  tenantId: z.string().min(1, 'Tenant is required'),
  currency: z.string().min(1, 'Currency is required'),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().min(1, 'Effective to date is required'),
  description: z.string().optional(),
});

type ContractFormValues = z.infer<typeof contractSchema>;

export function ContractForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Area / service assignment state
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedOverrideFormulaId, setSelectedOverrideFormulaId] = useState('');

  // Load contract for edit
  const { data: contract } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => getContract(id!),
    enabled: isEdit,
  });

  // Load tenants for select
  const { data: tenantsData } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => getTenants({ limit: 100 }),
  });

  // Load areas for assignment
  const { data: allAreas } = useQuery({
    queryKey: ['areas'],
    queryFn: () => getAreas(),
  });

  // Load published services
  const { data: allServices } = useQuery({
    queryKey: ['services-published'],
    queryFn: () => getServices({ status: 'published' }),
  });

  // Contract areas/services (edit mode)
  const { data: contractAreas } = useQuery({
    queryKey: ['contract-areas', id],
    queryFn: () => getContractAreas(id!),
    enabled: isEdit,
  });

  const { data: contractServices } = useQuery({
    queryKey: ['contract-services', id],
    queryFn: () => getContractServices(id!),
    enabled: isEdit,
  });

  const tenants: Tenant[] = tenantsData?.data ?? [];
  const areas: Area[] = allAreas ?? [];
  const servicesList: ServiceDefinition[] = allServices?.data ?? [];
  const isDraft = !isEdit || contract?.status === ContractStatus.draft;

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      title: '',
      tenantId: '',
      currency: 'TRY',
      effectiveFrom: '',
      effectiveTo: '',
      description: '',
    },
    values: isEdit && contract
      ? {
          title: contract.title ?? '',
          tenantId: contract.tenantId,
          currency: contract.currency,
          effectiveFrom: contract.effectiveFrom
            ? contract.effectiveFrom.split('T')[0]
            : '',
          effectiveTo: contract.effectiveTo
            ? contract.effectiveTo.split('T')[0]
            : '',
          description: contract.description ?? '',
        }
      : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: ContractFormValues) => createContract(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract created');
      navigate(`/contracts/${result.id}`);
    },
    onError: () => {
      toast.error('Failed to create contract');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContractFormValues) =>
      updateContract(id!, {
        title: data.title,
        currency: data.currency,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        description: data.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract updated');
    },
    onError: () => {
      toast.error('Failed to update contract');
    },
  });

  const addAreaMutation = useMutation({
    mutationFn: (areaId: string) => addContractArea(id!, { areaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-areas', id] });
      setSelectedAreaId('');
      toast.success('Area added');
    },
    onError: () => {
      toast.error('Failed to add area');
    },
  });

  const removeAreaMutation = useMutation({
    mutationFn: (areaId: string) => removeContractArea(id!, areaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-areas', id] });
      toast.success('Area removed');
    },
    onError: () => {
      toast.error('Failed to remove area');
    },
  });

  const addServiceMutation = useMutation({
    mutationFn: () =>
      addContractService(id!, {
        serviceDefinitionId: selectedServiceId,
        overrideFormulaId: selectedOverrideFormulaId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-services', id] });
      setSelectedServiceId('');
      setSelectedOverrideFormulaId('');
      toast.success('Service added');
    },
    onError: () => {
      toast.error('Failed to add service');
    },
  });

  const removeServiceMutation = useMutation({
    mutationFn: (serviceId: string) =>
      removeContractService(id!, serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-services', id] });
      toast.success('Service removed');
    },
    onError: () => {
      toast.error('Failed to remove service');
    },
  });

  function onSubmit(values: ContractFormValues) {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      <PageHeader
        title={isEdit ? 'Edit Contract' : 'New Contract'}
        actions={
          <Button variant="outline" onClick={() => navigate('/contracts')}>
            Cancel
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Contract Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Contract title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tenantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEdit}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select tenant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.code})
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
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TRY">TRY</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective From</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="effectiveTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective To</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Contract description (optional)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : isEdit
                    ? 'Update Contract'
                    : 'Create Contract'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Area assignment (edit mode, draft only) */}
      {isEdit && isDraft && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Area Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-end gap-2">
              <div className="flex-1">
                <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.code}) - {a.areaType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => addAreaMutation.mutate(selectedAreaId)}
                disabled={!selectedAreaId || addAreaMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Area
              </Button>
            </div>

            <div className="space-y-2">
              {(contractAreas ?? []).map((ca: ContractArea) => (
                <div
                  key={ca.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span>
                    {ca.area?.name ?? ca.areaId}
                    {ca.areaM2 ? ` (${ca.areaM2} m2)` : ''}
                  </span>
                  <ConfirmDialog
                    title="Remove Area"
                    description="Remove this area from the contract?"
                    variant="destructive"
                    onConfirm={() => removeAreaMutation.mutate(ca.areaId)}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    }
                  />
                </div>
              ))}
              {(contractAreas ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No areas assigned yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service assignment (edit mode, draft only) */}
      {isEdit && isDraft && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Service Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-end gap-2">
              <div className="flex-1">
                <Select
                  value={selectedServiceId}
                  onValueChange={setSelectedServiceId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicesList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => addServiceMutation.mutate()}
                disabled={!selectedServiceId || addServiceMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </div>

            <div className="space-y-2">
              {(contractServices ?? []).map((cs: ContractService) => (
                <div
                  key={cs.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span>
                    {cs.serviceDefinition?.name ?? cs.serviceDefinitionId}
                    {cs.overrideFormula
                      ? ` (Override: ${cs.overrideFormula.name})`
                      : ''}
                  </span>
                  <ConfirmDialog
                    title="Remove Service"
                    description="Remove this service from the contract?"
                    variant="destructive"
                    onConfirm={() => removeServiceMutation.mutate(cs.id)}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    }
                  />
                </div>
              ))}
              {(contractServices ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No services assigned yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
