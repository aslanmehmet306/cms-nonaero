import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ObligationsService } from './obligations.service';
import { ContractPublishedEvent } from './events/contract-published.event';

/**
 * ObligationsListener — listens for the `contract.published` event and
 * triggers obligation schedule generation asynchronously.
 *
 * Using { async: true } ensures the publish endpoint returns immediately
 * while schedule generation continues in the background.
 */
@Injectable()
export class ObligationsListener {
  private readonly logger = new Logger(ObligationsListener.name);

  constructor(private readonly obligationsService: ObligationsService) {}

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
}
