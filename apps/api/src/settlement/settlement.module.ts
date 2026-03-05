import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';

/**
 * SettlementModule — monthly MAG settlement and year-end true-up.
 *
 * Exports SettlementService for injection into ObligationsListener
 * (via ObligationsModule importing this module).
 * DatabaseModule is global, no explicit import needed.
 */
@Module({
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
