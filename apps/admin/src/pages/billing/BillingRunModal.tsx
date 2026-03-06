import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  createBillingRun,
  approveBillingRun,
  rejectBillingRun,
  cancelBillingRun,
} from '@/api/billing';
import { useBillingSSE } from '@/hooks/useSSE';
import { BillingRunMode, BillingRunStatus } from '@shared-types/enums';

interface BillingRunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const TERMINAL_STATUSES = [
  BillingRunStatus.completed,
  BillingRunStatus.partial,
  BillingRunStatus.cancelled,
  BillingRunStatus.draft_ready,
  BillingRunStatus.rejected,
];

export function BillingRunModal({
  open,
  onOpenChange,
  onSuccess,
}: BillingRunModalProps) {
  const queryClient = useQueryClient();
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [mode, setMode] = useState<string>(BillingRunMode.full);
  const [billingRunId, setBillingRunId] = useState<string | null>(null);

  const progress = useBillingSSE(billingRunId);

  const createMutation = useMutation({
    mutationFn: () =>
      createBillingRun({
        airportId: 'default',
        periodStart,
        periodEnd,
        mode,
      }),
    onSuccess: (result) => {
      setBillingRunId(result.id);
      toast.success('Billing run started');
    },
    onError: () => {
      toast.error('Failed to create billing run');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveBillingRun(billingRunId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      onSuccess();
      toast.success('Billing run approved');
      handleClose();
    },
    onError: () => {
      toast.error('Failed to approve billing run');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectBillingRun(billingRunId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      onSuccess();
      toast.success('Billing run rejected');
      handleClose();
    },
    onError: () => {
      toast.error('Failed to reject billing run');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBillingRun(billingRunId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-runs'] });
      onSuccess();
      toast.success('Billing run cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel billing run');
    },
  });

  function handleClose() {
    setBillingRunId(null);
    setPeriodStart('');
    setPeriodEnd('');
    setMode(BillingRunMode.full);
    onOpenChange(false);
  }

  const isTerminal = progress?.status
    ? TERMINAL_STATUSES.includes(progress.status as BillingRunStatus)
    : false;

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  const isDraftReady = progress?.status === BillingRunStatus.draft_ready;
  const isRunning = billingRunId && !isTerminal;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {billingRunId ? 'Billing Run Progress' : 'New Billing Run'}
          </DialogTitle>
        </DialogHeader>

        {!billingRunId ? (
          /* Form phase */
          <div className="space-y-4">
            <div>
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mode">Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BillingRunMode.full}>Full</SelectItem>
                  <SelectItem value={BillingRunMode.delta}>Delta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={
                  !periodStart ||
                  !periodEnd ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending
                  ? 'Starting...'
                  : 'Start Billing Run'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Progress phase */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {progress ? (
                <StatusBadge status={progress.status} />
              ) : (
                <span className="text-sm text-muted-foreground">
                  Connecting...
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{progress?.message ?? 'Processing...'}</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} />
              {progress && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {progress.processed} / {progress.total} obligations processed
                </p>
              )}
            </div>

            {/* Run ID */}
            <div>
              <span className="text-xs text-muted-foreground">Run ID: </span>
              <span className="font-mono text-xs">{billingRunId}</span>
            </div>

            {/* Actions based on terminal state */}
            <DialogFooter>
              {isRunning && (
                <ConfirmDialog
                  title="Cancel Billing Run?"
                  description="This will cancel the in-progress billing run."
                  variant="destructive"
                  onConfirm={() => cancelMutation.mutate()}
                  trigger={
                    <Button variant="destructive">Cancel Run</Button>
                  }
                />
              )}

              {isDraftReady && (
                <>
                  <ConfirmDialog
                    title="Reject Billing Run?"
                    description="This will reject the billing run results."
                    variant="destructive"
                    onConfirm={() => rejectMutation.mutate()}
                    trigger={
                      <Button variant="destructive">Reject</Button>
                    }
                  />
                  <ConfirmDialog
                    title="Approve Billing Run?"
                    description="This will approve the billing run and start invoice generation."
                    onConfirm={() => approveMutation.mutate()}
                    trigger={<Button>Approve</Button>}
                  />
                </>
              )}

              {isTerminal && !isDraftReady && (
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
