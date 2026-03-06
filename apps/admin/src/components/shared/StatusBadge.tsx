import { Badge } from '@/components/ui/badge';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

// Map status values to badge variants
const statusVariantMap: Record<string, BadgeVariant> = {
  // ContractStatus
  draft: 'secondary',
  in_review: 'outline',
  published: 'outline',
  active: 'default',
  pending_amendment: 'outline',
  amended: 'secondary',
  suspended: 'destructive',
  terminated: 'destructive',

  // TenantStatus
  // active: 'default', (already defined)
  // suspended: 'destructive', (already defined)
  deactivated: 'destructive',

  // BillingRunStatus
  initiated: 'secondary',
  scoping: 'outline',
  calculating: 'outline',
  draft_ready: 'outline',
  approved: 'default',
  rejected: 'destructive',
  invoicing: 'outline',
  completed: 'default',
  partial: 'outline',
  cancelled: 'destructive',

  // InvoiceStatus
  created: 'secondary',
  finalized: 'outline',
  sent: 'outline',
  paid: 'default',
  past_due: 'destructive',
  voided: 'destructive',
  uncollectible: 'destructive',

  // ObligationStatus
  scheduled: 'secondary',
  pending_input: 'outline',
  pending_calculation: 'outline',
  ready: 'default',
  invoiced: 'default',
  settled: 'default',
  skipped: 'secondary',
  on_hold: 'outline',
  // cancelled: 'destructive', (already defined)
};

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusVariantMap[status] ?? 'secondary';

  return (
    <Badge variant={variant} className={className}>
      {formatStatus(status)}
    </Badge>
  );
}
