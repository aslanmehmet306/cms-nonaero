import { Module } from '@nestjs/common';
import { AreaAllocationsService } from './area-allocations.service';
import { AreaAllocationsController } from './area-allocations.controller';

@Module({
  controllers: [AreaAllocationsController],
  providers: [AreaAllocationsService],
  exports: [AreaAllocationsService],
})
export class AreaAllocationsModule {}
