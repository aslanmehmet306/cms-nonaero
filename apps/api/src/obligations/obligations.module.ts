import { Module } from '@nestjs/common';
import { ObligationsService } from './obligations.service';
import { ObligationsListener } from './obligations.listener';
import { ObligationsController } from './obligations.controller';

/**
 * ObligationsModule — obligation schedule generation and read-only queries.
 *
 * ObligationsListener handles the `contract.published` event asynchronously,
 * keeping the publish endpoint responsive.
 *
 * Exports ObligationsService for potential use by downstream billing modules.
 * DatabaseModule is global, so no explicit import needed.
 * EventEmitterModule is registered globally in AppModule.
 */
@Module({
  controllers: [ObligationsController],
  providers: [ObligationsService, ObligationsListener],
  exports: [ObligationsService],
})
export class ObligationsModule {}
