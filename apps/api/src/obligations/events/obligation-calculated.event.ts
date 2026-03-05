import { ChargeType } from '@shared-types/enums';

/**
 * Event emitted after formula evaluation completes for an obligation.
 * Consumed by Plan 04-04 MAG settlement listener.
 */
export class ObligationCalculatedEvent {
  constructor(
    public readonly obligationId: string,
    public readonly contractId: string,
    public readonly chargeType: ChargeType,
    public readonly amount: string,
    public readonly periodStart: Date,
    public readonly periodEnd: Date,
  ) {}
}
