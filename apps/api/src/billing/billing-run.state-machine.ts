import { BillingRunStatus } from '@shared-types/enums';

/**
 * Valid state transitions for billing runs (10 states).
 *
 * Terminal states: completed, partial, rejected, cancelled — have empty transition arrays.
 * Cancelled is reachable from any non-terminal state.
 */
export const BILLING_RUN_TRANSITIONS: Record<BillingRunStatus, BillingRunStatus[]> = {
  [BillingRunStatus.initiated]:    [BillingRunStatus.scoping, BillingRunStatus.cancelled],
  [BillingRunStatus.scoping]:      [BillingRunStatus.calculating, BillingRunStatus.cancelled],
  [BillingRunStatus.calculating]:  [BillingRunStatus.draft_ready, BillingRunStatus.cancelled],
  [BillingRunStatus.draft_ready]:  [BillingRunStatus.approved, BillingRunStatus.rejected, BillingRunStatus.cancelled],
  [BillingRunStatus.approved]:     [BillingRunStatus.invoicing, BillingRunStatus.cancelled],
  [BillingRunStatus.rejected]:     [],
  [BillingRunStatus.invoicing]:    [BillingRunStatus.completed, BillingRunStatus.partial, BillingRunStatus.cancelled],
  [BillingRunStatus.completed]:    [],
  [BillingRunStatus.partial]:      [],
  [BillingRunStatus.cancelled]:    [],
};

/**
 * Terminal statuses — billing run has reached a final state and cannot transition further.
 */
export const TERMINAL_STATUSES: BillingRunStatus[] = [
  BillingRunStatus.completed,
  BillingRunStatus.partial,
  BillingRunStatus.rejected,
  BillingRunStatus.cancelled,
];

/**
 * Check if a billing run status is terminal (no further transitions possible).
 */
export function isTerminalStatus(status: BillingRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Validate whether a transition from one status to another is allowed.
 *
 * @param from - Current billing run status
 * @param to   - Target billing run status
 * @returns true if the transition is valid
 */
export function validateBillingRunTransition(from: BillingRunStatus, to: BillingRunStatus): boolean {
  const allowed = BILLING_RUN_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
