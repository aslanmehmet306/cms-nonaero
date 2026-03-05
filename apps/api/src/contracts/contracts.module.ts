import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

/**
 * ContractsModule — Contract lifecycle management.
 *
 * Exports ContractsService for use by ObligationsModule (Phase 03-03+).
 * DatabaseModule is global, so no explicit import needed.
 * EventEmitterModule will be registered globally in a later plan.
 */
@Module({
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
