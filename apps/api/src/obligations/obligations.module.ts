import { Module } from '@nestjs/common';
import { ObligationsService } from './obligations.service';
import { ObligationsListener } from './obligations.listener';
import { ObligationsController } from './obligations.controller';
import { SettlementModule } from '../settlement/settlement.module';

/**
 * ObligationsModule — obligation schedule generation, state transitions,
 * formula evaluation, and event-driven lifecycle.
 *
 * ObligationsListener handles:
 *   - `contract.published`    → generate obligation schedule
 *   - `declaration.submitted` → trigger formula evaluation
 *   - `obligation.calculated` → trigger monthly MAG settlement
 *
 * Imports SettlementModule so SettlementService is available for MAG calculations.
 * Exports ObligationsService for potential use by downstream billing modules.
 * DatabaseModule is global, so no explicit import needed.
 * EventEmitterModule is registered globally in AppModule.
 */
@Module({
  imports: [SettlementModule],
  controllers: [ObligationsController],
  providers: [ObligationsService, ObligationsListener],
  exports: [ObligationsService],
})
export class ObligationsModule {}
