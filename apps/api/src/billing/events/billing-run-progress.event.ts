/**
 * Event emitted during billing run processing to report progress.
 * Consumed by SSE endpoints (plan 05-02) for real-time UI updates.
 */
export class BillingRunProgressEvent {
  constructor(
    public readonly billingRunId: string,
    public readonly phase: 'scoping' | 'calculating' | 'draft_ready' | 'invoicing' | 'completed',
    public readonly progress: number,
    public readonly message?: string,
    public readonly tenantProgress?: Record<string, { status: string; progress: number }>,
  ) {}
}
