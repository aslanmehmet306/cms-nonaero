import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditLogInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditService, AuditLogInterceptor],
})
export class AuditModule {}
