import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditLogInterceptor],
  exports: [AuditService, AuditLogInterceptor],
})
export class AuditModule {}
