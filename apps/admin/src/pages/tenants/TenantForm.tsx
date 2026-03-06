import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { getTenant, createTenant, updateTenant } from '@/api/tenants';

const tenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  taxId: z.string().min(1, 'Tax ID is required'),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

export function TenantForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => getTenant(id!),
    enabled: isEdit,
  });

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: '',
      taxId: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      currency: 'TRY',
    },
    values: isEdit && tenant
      ? {
          name: tenant.name,
          taxId: tenant.taxId,
          contactName: tenant.contactName ?? '',
          contactEmail: tenant.contactEmail ?? '',
          contactPhone: tenant.contactPhone ?? '',
          currency: tenant.currency,
        }
      : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: TenantFormValues) =>
      createTenant({
        ...data,
        contactEmail: data.contactEmail || undefined,
        airportId: 'default', // Single airport demo — server resolves
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant created');
      navigate('/tenants');
    },
    onError: () => {
      toast.error('Failed to create tenant');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TenantFormValues) =>
      updateTenant(id!, {
        name: data.name,
        contactName: data.contactName || undefined,
        contactEmail: data.contactEmail || undefined,
        contactPhone: data.contactPhone || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant updated');
      navigate('/tenants');
    },
    onError: () => {
      toast.error('Failed to update tenant');
    },
  });

  function onSubmit(values: TenantFormValues) {
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
        title={isEdit ? 'Edit Tenant' : 'New Tenant'}
        actions={
          <Button variant="outline" onClick={() => navigate('/tenants')}>
            Cancel
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Tenant Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Tenant name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Tax identification number"
                        disabled={isEdit}
                        {...field}
                      />
                    </FormControl>
                    {isEdit && (
                      <p className="text-xs text-muted-foreground">
                        Tax ID cannot be changed after creation
                      </p>
                    )}
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
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEdit}
                    >
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

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact person name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+90 555 123 4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : isEdit
                    ? 'Update Tenant'
                    : 'Create Tenant'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
