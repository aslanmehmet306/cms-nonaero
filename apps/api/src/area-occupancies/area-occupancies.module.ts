import { Module } from '@nestjs/common';
import { AreaOccupanciesController } from './area-occupancies.controller';
import { AreaOccupanciesService } from './area-occupancies.service';

@Module({
  controllers: [AreaOccupanciesController],
  providers: [AreaOccupanciesService],
  exports: [AreaOccupanciesService],
})
export class AreaOccupanciesModule {}
