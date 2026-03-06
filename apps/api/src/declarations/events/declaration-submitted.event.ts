import { DeclarationType } from '@shared-types/enums';

/**
 * Event emitted when a declaration transitions from draft to submitted.
 * Consumed by obligation calculation listeners to trigger revenue share computation.
 */
export class DeclarationSubmittedEvent {
  constructor(
    public readonly declarationId: string,
    public readonly contractId: string,
    public readonly tenantId: string,
    public readonly periodStart: Date,
    public readonly periodEnd: Date,
    public readonly declarationType: DeclarationType,
  ) {}
}
