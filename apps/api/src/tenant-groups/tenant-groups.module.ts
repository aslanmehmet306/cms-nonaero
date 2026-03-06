import { Module } from '@nestjs/common';
import { TenantGroupsService } from './tenant-groups.service';
import { TenantGroupsController } from './tenant-groups.controller';

@Module({
  controllers: [TenantGroupsController],
  providers: [TenantGroupsService],
  exports: [TenantGroupsService],
})
export class TenantGroupsModule {}
