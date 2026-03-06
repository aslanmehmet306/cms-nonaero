import { Module } from '@nestjs/common';
import { DeclarationsController } from './declarations.controller';
import { DeclarationsService } from './declarations.service';
import { DeclarationLinesController } from './declaration-lines.controller';
import { DeclarationLinesService } from './declaration-lines.service';

/**
 * DeclarationsModule — Declaration lifecycle management.
 *
 * - Provides: DeclarationsService, DeclarationLinesService
 * - Exports: DeclarationsService (for future obligation listeners)
 * - DatabaseModule is global (no explicit import needed)
 * - EventEmitterModule is global (registered in AppModule)
 * - Both controllers registered here
 */
@Module({
  controllers: [DeclarationsController, DeclarationLinesController],
  providers: [DeclarationsService, DeclarationLinesService],
  exports: [DeclarationsService],
})
export class DeclarationsModule {}
