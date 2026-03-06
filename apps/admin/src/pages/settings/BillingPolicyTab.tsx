import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import {
  getBillingPolicies,
  createBillingPolicy,
  updateBillingPolicy,
  activateBillingPolicy,
  type BillingPolicy,
} from '@/api/billing-policies';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const billingPolicySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cutoffDay: z.number().min(1).max(28, 'Must be 1-28'),
  issueDay: z.number().min(1).max(28, 'Must be 1-28'),
  dueDateDays: z.number().min(1, 'Must be at least 1 day'),
  fiscalYearStartMonth: z.number().min(1).max(12),
  fiscalYearStartDay: z.number().min(1).max(28, 'Must be 1-28'),
});

type BillingPolicyFormValues = z.infer<typeof billingPolicySchema>;

export function BillingPolicyTab() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: policies, isLoading } = useQuery({
    queryKey: ['billing-policies', { airportId: user?.airportId }],
    queryFn: () => getBillingPolicies({ airportId: user?.airportId }),
    staleTime: 30_000,
  });

  const activePolicy = policies?.find((p) => p.status === 'active');
  const editPolicy = activePolicy || policies?.[0];

  const form = useForm<BillingPolicyFormValues>({
    resolver: zodResolver(billingPolicySchema),
    values: editPolicy
      ? {
          name: editPolicy.name,
          cutoffDay: editPolicy.cutoffDay,
          issueDay: editPolicy.issueDay,
          dueDateDays: editPolicy.dueDateDays,
          fiscalYearStartMonth: editPolicy.fiscalYearStartMonth,
          fiscalYearStartDay: editPolicy.fiscalYearStartDay,
        }
      : {
          name: '',
          cutoffDay: 25,
          issueDay: 1,
          dueDateDays: 30,
          fiscalYearStartMonth: 1,
          fiscalYearStartDay: 1,
        },
  });

  const createMutation = useMutation({
    mutationFn: (data: BillingPolicyFormValues) =>
      createBillingPolicy({
        ...data,
        airportId: user?.airportId ?? '',
      }),
    onSuccess: () => {
      toast.success('Billing policy created');
      queryClient.invalidateQueries({ queryKey: ['billing-policies'] });
    },
    onError: () => toast.error('Failed to create billing policy'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: BillingPolicyFormValues) =>
      updateBillingPolicy(editPolicy!.id, data),
    onSuccess: () => {
      toast.success('Billing policy updated');
      queryClient.invalidateQueries({ queryKey: ['billing-policies'] });
    },
    onError: () => toast.error('Failed to update billing policy'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateBillingPolicy(id),
    onSuccess: () => {
      toast.success('Billing policy activated');
      queryClient.invalidateQueries({ queryKey: ['billing-policies'] });
    },
    onError: () => toast.error('Failed to activate billing policy'),
  });

  function onSubmit(values: BillingPolicyFormValues) {
    if (editPolicy) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Policy Display */}
      {activePolicy && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>Active Policy</CardTitle>
              <StatusBadge status={activePolicy.status} />
            </div>
            <CardDescription>{activePolicy.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Cutoff Day:</span>{' '}
                <span className="font-medium">{activePolicy.cutoffDay}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Issue Day:</span>{' '}
                <span className="font-medium">{activePolicy.issueDay}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Due Date Days:</span>{' '}
                <span className="font-medium">{activePolicy.dueDateDays}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Fiscal Year Start:</span>{' '}
                <span className="font-medium">
                  {MONTHS[activePolicy.fiscalYearStartMonth - 1]}{' '}
                  {activePolicy.fiscalYearStartDay}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policy Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {editPolicy ? 'Edit Billing Policy' : 'Create Billing Policy'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Standard Monthly" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="cutoffDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cutoff Day</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="issueDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Day</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDateDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fiscalYearStartMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiscal Year Start Month</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(parseInt(v, 10))}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MONTHS.map((month, idx) => (
                            <SelectItem key={month} value={String(idx + 1)}>
                              {month}
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
                  name="fiscalYearStartDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiscal Year Start Day</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : 'Save'}
                </Button>

                {editPolicy && editPolicy.status !== 'active' && (
                  <ConfirmDialog
                    title="Activate Policy"
                    description="Activating this policy will archive the current active policy. Are you sure?"
                    onConfirm={() => activateMutation.mutate(editPolicy.id)}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={activateMutation.isPending}
                      >
                        {activateMutation.isPending
                          ? 'Activating...'
                          : 'Activate'}
                      </Button>
                    }
                  />
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
