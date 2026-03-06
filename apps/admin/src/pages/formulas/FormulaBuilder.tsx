import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
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
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  getFormula,
  createFormula,
  updateFormula,
  publishFormula,
  newFormulaVersion,
  deprecateFormula,
  dryRunFormula,
  type DryRunResult,
} from '@/api/formulas';
import { FormulaType, FormulaStatus } from '@shared-types/enums';

const typeOptions = Object.values(FormulaType);

const formulaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.string().min(1, 'Type is required'),
  expression: z.string().min(1, 'Expression is required'),
  customParameters: z.string().optional(),
});

type FormulaFormValues = z.infer<typeof formulaSchema>;

export function FormulaBuilder() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  const { data: formula } = useQuery({
    queryKey: ['formula', id],
    queryFn: () => getFormula(id!),
    enabled: isEdit,
  });

  const form = useForm<FormulaFormValues>({
    resolver: zodResolver(formulaSchema),
    defaultValues: {
      name: '',
      description: '',
      type: FormulaType.arithmetic,
      expression: '',
      customParameters: '',
    },
    values: isEdit && formula
      ? {
          name: formula.name,
          description: formula.description ?? '',
          type: formula.type,
          expression: formula.expression,
          customParameters: formula.customParameters
            ? JSON.stringify(formula.customParameters, null, 2)
            : '',
        }
      : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormulaFormValues) => {
      const params = data.customParameters
        ? JSON.parse(data.customParameters)
        : undefined;
      return createFormula({
        name: data.name,
        description: data.description || undefined,
        type: data.type,
        expression: data.expression,
        customParameters: params,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      toast.success('Formula created');
      navigate(`/formulas/${result.id}`);
    },
    onError: () => {
      toast.error('Failed to create formula');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormulaFormValues) => {
      const params = data.customParameters
        ? JSON.parse(data.customParameters)
        : undefined;
      return updateFormula(id!, {
        name: data.name,
        description: data.description || undefined,
        expression: data.expression,
        customParameters: params,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formula', id] });
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      toast.success('Formula updated');
    },
    onError: () => {
      toast.error('Failed to update formula');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishFormula(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formula', id] });
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      toast.success('Formula published');
    },
    onError: () => {
      toast.error('Failed to publish formula');
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: () => newFormulaVersion(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      toast.success('New version created');
      navigate(`/formulas/${result.id}`);
    },
    onError: () => {
      toast.error('Failed to create new version');
    },
  });

  const deprecateMutation = useMutation({
    mutationFn: () => deprecateFormula(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formula', id] });
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      toast.success('Formula deprecated');
    },
    onError: () => {
      toast.error('Failed to deprecate formula');
    },
  });

  const dryRunMutation = useMutation({
    mutationFn: () => {
      const paramsStr = form.getValues('customParameters');
      const variables = paramsStr ? JSON.parse(paramsStr) : undefined;
      return dryRunFormula(id!, variables);
    },
    onSuccess: (result) => {
      setDryRunResult(result);
    },
    onError: (err) => {
      setDryRunResult({ result: 0, error: String(err) });
    },
  });

  function onSubmit(values: FormulaFormValues) {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isDraft = !isEdit || formula?.status === FormulaStatus.draft;
  const isPublished = formula?.status === FormulaStatus.published;

  return (
    <div className="p-6">
      <PageHeader
        title={isEdit ? `Formula: ${formula?.name ?? ''}` : 'New Formula'}
        description={
          isEdit && formula ? `Version ${formula.version}` : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {formula && <StatusBadge status={formula.status} />}
            {isEdit && isDraft && (
              <ConfirmDialog
                title="Publish Formula?"
                description="Publishing will make this formula available for use in services. This action cannot be undone."
                onConfirm={() => publishMutation.mutate()}
                trigger={<Button>Publish</Button>}
              />
            )}
            {isEdit && isPublished && (
              <>
                <ConfirmDialog
                  title="Create New Version?"
                  description="This will create a new draft version of the formula."
                  onConfirm={() => newVersionMutation.mutate()}
                  trigger={<Button variant="outline">New Version</Button>}
                />
                <ConfirmDialog
                  title="Deprecate Formula?"
                  description="Deprecated formulas cannot be used in new services."
                  variant="destructive"
                  onConfirm={() => deprecateMutation.mutate()}
                  trigger={<Button variant="destructive">Deprecate</Button>}
                />
              </>
            )}
            <Button variant="outline" onClick={() => navigate('/formulas')}>
              Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left panel: Form */}
        <Card>
          <CardHeader>
            <CardTitle>Formula Editor</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Formula name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional description"
                          {...field}
                        />
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
                        disabled={isEdit}
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
                  name="expression"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expression</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. area_m2 * rate_per_m2"
                          className="font-mono min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customParameters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Parameters (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"rate_per_m2": 50, "min_charge": 1000}'
                          className="font-mono min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending
                      ? 'Saving...'
                      : isEdit
                        ? 'Update Formula'
                        : 'Create Formula'}
                  </Button>
                  {isEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => dryRunMutation.mutate()}
                      disabled={dryRunMutation.isPending}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {dryRunMutation.isPending ? 'Running...' : 'Run Preview'}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Right panel: Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Dry Run Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {!dryRunResult && !dryRunMutation.isPending && (
              <p className="text-muted-foreground">
                Click "Run Preview" to test the formula with the current
                parameters.
              </p>
            )}
            {dryRunMutation.isPending && (
              <p className="text-muted-foreground">Running formula...</p>
            )}
            {dryRunResult && (
              <div className="space-y-4">
                {dryRunResult.error ? (
                  <div className="rounded-md border border-destructive bg-destructive/10 p-4">
                    <p className="font-medium text-destructive">Error</p>
                    <p className="mt-1 text-sm">{dryRunResult.error}</p>
                  </div>
                ) : (
                  <div className="rounded-md border bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Result</p>
                    <p className="text-2xl font-bold">{dryRunResult.result}</p>
                  </div>
                )}
                {dryRunResult.trace && dryRunResult.trace.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">
                      Calculation Trace
                    </p>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <ul className="space-y-1 text-sm font-mono">
                        {dryRunResult.trace.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
