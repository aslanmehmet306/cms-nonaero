import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ObligationsService } from './obligations.service';
import { ContractPublishedEvent } from './events/contract-published.event';
import { DeclarationSubmittedEvent } from '../declarations/events/declaration-submitted.event';
import { ChargeType, DeclarationType, ObligationStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';

/**
 * ObligationsListener — listens for system events and triggers obligation lifecycle actions:
 *
 * 1. `contract.published`   → Generate obligation schedule for the contract
 * 2. `declaration.submitted` → Transition matching obligations to pending_calculation
 *                              and trigger formula evaluation
 *
 * Both handlers use { async: true } so the originating endpoint returns immediately.
 * Errors are caught and logged — event handlers must not throw to protect callers.
 */
@Injectable()
export class ObligationsListener {
  private readonly logger = new Logger(ObligationsListener.name);

  constructor(
    private readonly obligationsService: ObligationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('contract.published', { async: true })
  async handleContractPublished(payload: ContractPublishedEvent): Promise<void> {
    this.logger.log(`Received contract.published event for contract ${payload.contractId}`);
    try {
      const count = await this.obligationsService.generateSchedule(payload.contractId);
      this.logger.log(`Generated ${count} obligations for contract ${payload.contractId}`);
    } catch (error) {
      // Log error but don't rethrow — this is a background listener, errors
      // must not affect the caller that emitted the event.
      this.logger.error(
        `Failed to generate obligation schedule for contract ${payload.contractId}`,
        error,
      );
    }
  }

  /**
   * Handle declaration.submitted event.
   *
   * Logic:
   *   - If declarationType=revenue: look for revenue_share obligations
   *   - If declarationType=meter_reading: look for utility obligations
   *   - Transition matching obligations from scheduled/pending_input -> pending_calculation
   *   - Then trigger formula evaluation for each
   */
  @OnEvent('declaration.submitted', { async: true })
  async handleDeclarationSubmitted(event: DeclarationSubmittedEvent): Promise<void> {
    this.logger.log(
      `Received declaration.submitted event for declaration ${event.declarationId} ` +
        `(contract ${event.contractId}, type=${event.declarationType})`,
    );

    try {
      // Determine which chargeType to look for based on declarationType
      let targetChargeType: ChargeType | undefined;
      if (event.declarationType === DeclarationType.revenue) {
        targetChargeType = ChargeType.revenue_share;
      } else if (event.declarationType === DeclarationType.meter_reading) {
        targetChargeType = ChargeType.utility;
      }

      if (!targetChargeType) {
        this.logger.log(
          `Declaration ${event.declarationId} type=${event.declarationType} has no matching obligation chargeType — skipping`,
        );
        return;
      }

      // Find matching obligations: same contract + period + chargeType, in triggerable statuses
      const obligations = await this.prisma.obligation.findMany({
        where: {
          contractId: event.contractId,
          chargeType: targetChargeType,
          periodStart: event.periodStart,
          status: {
            in: [ObligationStatus.scheduled, ObligationStatus.pending_input],
          },
        },
      });

      if (obligations.length === 0) {
        this.logger.log(
          `No matching obligations found for contract ${event.contractId}, ` +
            `chargeType=${targetChargeType}, periodStart=${event.periodStart.toISOString()}`,
        );
        return;
      }

      this.logger.log(
        `Found ${obligations.length} obligation(s) to calculate for contract ${event.contractId}`,
      );

      // For each matching obligation: transition to pending_calculation, then calculate
      for (const obligation of obligations) {
        try {
          // Transition to pending_calculation
          await this.obligationsService.transitionObligation(
            obligation.id,
            ObligationStatus.pending_calculation,
          );

          // Trigger formula evaluation
          await this.obligationsService.calculateObligation(obligation.id, event.declarationId);
        } catch (err) {
          this.logger.error(
            `Failed to calculate obligation ${obligation.id} for declaration ${event.declarationId}`,
            err,
          );
          // Continue with remaining obligations even if one fails
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle declaration.submitted for declaration ${event.declarationId}`,
        error,
      );
    }
  }
}
