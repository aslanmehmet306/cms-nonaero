import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  getContract,
  transitionContract,
  amendContract,
  getContractAreas,
  getContractServices,
  getContractVersions,
  removeContractArea,
  removeContractService,
  type ContractArea,
  type ContractService,
  type ContractVersion,
} from '@/api/contracts';
import { useAuthStore } from '@/store/authStore';
import { useIsReadOnly } from '@/hooks/useRoleAccess';
import { ContractStatus } from '@shared-types/enums';

// Valid transitions map
const validTransitions: Record<string, { label: string; target: string; variant?: 'destructive' }[]> = {
  [ContractStatus.draft]: [
    { label: 'Submit for Review', target: ContractStatus.in_review },
  ],
  [ContractStatus.in_review]: [
    { label: 'Publish', target: ContractStatus.published },
    { label: 'Return to Draft', target: ContractStatus.draft },
  ],
  [ContractStatus.active]: [
    { label: 'Suspend', target: ContractStatus.suspended, variant: 'destructive' },
    { label: 'Terminate', target: ContractStatus.terminated, variant: 'destructive' },
  ],
  [ContractStatus.suspended]: [
    { label: 'Reactivate', target: ContractStatus.active },
    { label: 'Terminate', target: ContractStatus.terminated, variant: 'destructive' },
  ],
};

export function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const readOnly = useIsReadOnly();

  const [amendOpen, setAmendOpen] = useState(false);
  const [amendDate, setAmendDate] = useState('');

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => getContract(id!),
    enabled: !!id,
  });

  const { data: areas } = useQuery({
    queryKey: ['contract-areas', id],
    queryFn: () => getContractAreas(id!),
    enabled: !!id,
  });

  const { data: services } = useQuery({
    queryKey: ['contract-services', id],
    queryFn: () => getContractServices(id!),
    enabled: !!id,
  });

  const { data: versions } = useQuery({
    queryKey: ['contract-versions', id],
    queryFn: () => getContractVersions(id!),
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ status }: { status: string }) =>
      transitionContract(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract status updated');
    },
    onError: () => {
      toast.error('Failed to update contract status');
    },
  });

  const amendMutation = useMutation({
    mutationFn: (effectiveFrom: string) => amendContract(id!, effectiveFrom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setAmendOpen(false);
      toast.success('Amendment created');
    },
    onError: () => {
      toast.error('Failed to create amendment');
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

  const removeServiceMutation = useMutation({
    mutationFn: (serviceId: string) => removeContractService(id!, serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-services', id] });
      toast.success('Service removed');
    },
    onError: () => {
      toast.error('Failed to remove service');
    },
  });

  if (isLoading || !contract) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading contract...</p>
      </div>
    );
  }

  const transitions = validTransitions[contract.status] ?? [];

  // Separation of duties: publish button disabled for contract creator
  const isCreator = user?.sub === contract.createdBy;
  const isPublishDisabled = (target: string) =>
    readOnly ||
    (target === ContractStatus.published &&
      isCreator &&
      user?.role === 'commercial_manager');

  return (
    <div className="p-6">
      <PageHeader
        title={`Contract ${contract.contractNumber}`}
        description={`Version ${contract.version}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/contracts')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {contract.status === ContractStatus.draft && !readOnly && (
              <Button
                variant="outline"
                onClick={() => navigate(`/contracts/${id}`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {contract.status === ContractStatus.active && !readOnly && (
              <Button variant="outline" onClick={() => setAmendOpen(true)}>
                Amend
              </Button>
            )}
          </div>
        }
      />

      {/* Contract info card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <StatusBadge status={contract.status} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tenant</p>
              <p className="font-medium">
                {contract.tenant?.name ?? contract.tenantId}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Currency</p>
              <p className="font-medium">{contract.currency}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Effective From</p>
              <p className="font-medium">
                {contract.effectiveFrom
                  ? new Date(contract.effectiveFrom).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Effective To</p>
              <p className="font-medium">
                {contract.effectiveTo
                  ? new Date(contract.effectiveTo).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            {contract.title && (
              <div>
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-medium">{contract.title}</p>
              </div>
            )}
            {contract.description && (
              <div className="col-span-full">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{contract.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* State transition buttons */}
      {transitions.length > 0 && (
        <div className="mb-6 flex gap-2">
          {transitions.map((t) => (
            <ConfirmDialog
              key={t.target}
              title={`${t.label}?`}
              description={`Are you sure you want to transition this contract to "${t.target.replace(/_/g, ' ')}"?`}
              variant={t.variant}
              onConfirm={() => transitionMutation.mutate({ status: t.target })}
              trigger={
                <Button
                  variant={t.variant === 'destructive' ? 'destructive' : 'default'}
                  disabled={isPublishDisabled(t.target)}
                  title={
                    isPublishDisabled(t.target)
                      ? 'You cannot publish a contract you created (separation of duties)'
                      : undefined
                  }
                >
                  {t.label}
                </Button>
              }
            />
          ))}
        </div>
      )}

      {/* Tabs: Areas, Services, Versions */}
      <Tabs defaultValue="areas">
        <TabsList>
          <TabsTrigger value="areas">
            Areas ({(areas ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="services">
            Services ({(services ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="versions">
            Versions ({(versions ?? []).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="areas" className="mt-4">
          <AreasTab
            areas={areas ?? []}
            isDraft={contract.status === ContractStatus.draft}
            onRemove={(areaId) => removeAreaMutation.mutate(areaId)}
          />
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <ServicesTab
            services={services ?? []}
            isDraft={contract.status === ContractStatus.draft}
            onRemove={(serviceId) => removeServiceMutation.mutate(serviceId)}
          />
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          <VersionsTab versions={versions ?? []} />
        </TabsContent>
      </Tabs>

      {/* Amend dialog */}
      <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Amendment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amendDate">Effective From</Label>
              <Input
                id="amendDate"
                type="date"
                value={amendDate}
                onChange={(e) => setAmendDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmendOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => amendMutation.mutate(amendDate)}
              disabled={!amendDate || amendMutation.isPending}
            >
              {amendMutation.isPending ? 'Creating...' : 'Create Amendment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Sub-components ----

function AreasTab({
  areas,
  isDraft,
  onRemove,
}: {
  areas: ContractArea[];
  isDraft: boolean;
  onRemove: (areaId: string) => void;
}) {
  if (areas.length === 0) {
    return <p className="text-muted-foreground">No areas assigned.</p>;
  }

  return (
    <div className="space-y-2">
      {areas.map((ca) => (
        <div
          key={ca.id}
          className="flex items-center justify-between rounded-md border p-3"
        >
          <div>
            <p className="font-medium">
              {ca.area?.name ?? ca.areaId}
            </p>
            <p className="text-sm text-muted-foreground">
              {ca.area?.code} - {ca.area?.type}
              {ca.areaM2 ? ` (${ca.areaM2} m2)` : ''}
            </p>
          </div>
          {isDraft && (
            <ConfirmDialog
              title="Remove Area"
              description="Are you sure you want to remove this area from the contract?"
              variant="destructive"
              onConfirm={() => onRemove(ca.areaId)}
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive">
                  Remove
                </Button>
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ServicesTab({
  services,
  isDraft,
  onRemove,
}: {
  services: ContractService[];
  isDraft: boolean;
  onRemove: (serviceId: string) => void;
}) {
  if (services.length === 0) {
    return <p className="text-muted-foreground">No services assigned.</p>;
  }

  return (
    <div className="space-y-2">
      {services.map((cs) => (
        <div
          key={cs.id}
          className="flex items-center justify-between rounded-md border p-3"
        >
          <div>
            <p className="font-medium">
              {cs.serviceDefinition?.name ?? cs.serviceDefinitionId}
            </p>
            <p className="text-sm text-muted-foreground">
              {cs.serviceDefinition?.type}
              {cs.overrideFormula
                ? ` (Override: ${cs.overrideFormula.name})`
                : ''}
            </p>
          </div>
          {isDraft && (
            <ConfirmDialog
              title="Remove Service"
              description="Are you sure you want to remove this service from the contract?"
              variant="destructive"
              onConfirm={() => onRemove(cs.id)}
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive">
                  Remove
                </Button>
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function VersionsTab({ versions }: { versions: ContractVersion[] }) {
  if (versions.length === 0) {
    return <p className="text-muted-foreground">No version history.</p>;
  }

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.id} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="font-medium">
              Version {v.version} - {v.contractNumber}
            </p>
            <p className="text-sm text-muted-foreground">
              {new Date(v.effectiveFrom).toLocaleDateString()} -{' '}
              {new Date(v.effectiveTo).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge status={v.status} />
        </div>
      ))}
    </div>
  );
}
