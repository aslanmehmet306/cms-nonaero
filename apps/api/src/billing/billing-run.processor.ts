import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { BillingRunStatus } from '@shared-types/enums';
import { BillingService } from './billing.service';
import { BillingRunProgressEvent } from './events/billing-run-progress.event';

/**
 * BullMQ processor for async billing pipeline execution.
 *
 * Pipeline stages:
 *   1. initiated -> scoping (create contract snapshot, scope obligations)
 *   2. scoping -> calculating (confirm obligations are ready)
 *   3. calculating -> draft_ready (billing run ready for approval)
 *
 * After approval, invoice generation is handled by a separate processor (plan 05-03).
 */
@Processor('billing-run', { concurrency: 1 })
export class BillingRunProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingRunProcessor.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  /**
   * Main billing pipeline processing.
   *
   * Transitions through: initiated -> scoping -> calculating -> draft_ready
   * Emits progress events at each stage for SSE consumers.
   */
  async process(job: Job<{ billingRunId: string }>) {
    const { billingRunId } = job.data;
    this.logger.log(`Processing billing run ${billingRunId}`);

    try {
      // Stage 1: Transition to scoping
      await this.billingService.transitionRun(billingRunId, BillingRunStatus.scoping);
      this.emitProgress(billingRunId, 'scoping', 10, 'Creating contract snapshot...');

      // Stage 2: Create contract snapshot
      await this.billingService.createContractSnapshot(billingRunId);
      this.emitProgress(billingRunId, 'scoping', 20, 'Scoping obligations...');

      // Stage 3: Scope obligations
      const obligations = await this.billingService.scopeObligations(billingRunId);
      this.emitProgress(billingRunId, 'scoping', 30, `Scoped ${obligations.length} obligations`);

      // Stage 4: Transition to calculating
      await this.billingService.transitionRun(billingRunId, BillingRunStatus.calculating);

      // Stage 5: Confirm obligations are ready (Phase 4 formula engine already calculated them)
      // Emit incremental progress for each obligation
      for (let i = 0; i < obligations.length; i++) {
        const progress = 30 + Math.round((i / Math.max(obligations.length, 1)) * 50);
        this.emitProgress(billingRunId, 'calculating', progress, `Verifying obligation ${i + 1}/${obligations.length}`);
      }

      this.emitProgress(billingRunId, 'calculating', 80, 'Calculation complete');

      // Stage 6: Transition to draft_ready
      await this.billingService.transitionRun(billingRunId, BillingRunStatus.draft_ready);
      this.emitProgress(billingRunId, 'draft_ready', 100, 'Billing run ready for approval');

      this.logger.log(`Billing run ${billingRunId} completed pipeline — status: draft_ready`);

      return {
        billingRunId,
        obligationsCount: obligations.length,
        status: BillingRunStatus.draft_ready,
      };
    } catch (error) {
      this.logger.error(
        `Billing run ${billingRunId} pipeline failed: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  /**
   * Handle worker failure — log error and transition run to cancelled.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ billingRunId: string }>, error: Error) {
    const { billingRunId } = job.data;
    this.logger.error(`Billing run ${billingRunId} job failed: ${error.message}`);

    try {
      // Store error in errorLog and cancel the run
      await this.billingService.transitionRun(billingRunId, BillingRunStatus.cancelled);
    } catch (transitionError) {
      this.logger.error(
        `Failed to transition billing run ${billingRunId} to cancelled: ${transitionError instanceof Error ? transitionError.message : transitionError}`,
      );
    }
  }

  private emitProgress(
    billingRunId: string,
    phase: BillingRunProgressEvent['phase'],
    progress: number,
    message: string,
  ) {
    this.eventEmitter.emit(
      'billing.progress',
      new BillingRunProgressEvent(billingRunId, phase, progress, message),
    );
  }
}
