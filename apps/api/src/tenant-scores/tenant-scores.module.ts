import { Module } from '@nestjs/common';
import { TenantScoresController } from './tenant-scores.controller';
import { TenantScoresService } from './tenant-scores.service';

@Module({
  controllers: [TenantScoresController],
  providers: [TenantScoresService],
  exports: [TenantScoresService],
})
export class TenantScoresModule {}
