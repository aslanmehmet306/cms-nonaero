import { Module } from '@nestjs/common';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';

/**
 * CreditNotesModule -- Credit note / adjustment lifecycle management.
 *
 * Exports CreditNotesService for use by other modules.
 * DatabaseModule is global, so no explicit import needed.
 * EventEmitterModule is registered globally.
 */
@Module({
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
