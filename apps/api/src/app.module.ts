import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { TenantsModule } from './tenants/tenants.module';
import { AirportsModule } from './airports/airports.module';
import { AreasModule } from './areas/areas.module';
import { FormulasModule } from './formulas/formulas.module';
import { ServicesModule } from './services/services.module';
import { BillingPoliciesModule } from './billing-policies/billing-policies.module';
import { ContractsModule } from './contracts/contracts.module';
import { ContractAreasModule } from './contract-areas/contract-areas.module';
import { ContractServicesModule } from './contract-services/contract-services.module';
import { ObligationsModule } from './obligations/obligations.module';
import { ContractSchedulerModule } from './scheduler/contract-scheduler.module';
import { DeclarationsModule } from './declarations/declarations.module';
import { SettlementModule } from './settlement/settlement.module';
import { BillingModule } from './billing/billing.module';
import { InvoicesModule } from './invoices/invoices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { ReportsModule } from './reports/reports.module';
import { EquipmentModule } from './equipment/equipment.module';
import { TenantGroupsModule } from './tenant-groups/tenant-groups.module';
import { AreaOccupanciesModule } from './area-occupancies/area-occupancies.module';
import { ContractEquipmentModule } from './contract-equipment/contract-equipment.module';
import { AreaAllocationsModule } from './area-allocations/area-allocations.module';
import { TenantScoresModule } from './tenant-scores/tenant-scores.module';
import { CreditNotesModule } from './credit-notes/credit-notes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ClsModule.forRoot({
      middleware: { mount: true },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    // EventEmitterModule enables @OnEvent decorators — registers globally so
    // ContractsService.transition() can emit 'contract.published' and
    // ObligationsListener receives it.
    EventEmitterModule.forRoot(),
    // ScheduleModule enables @Cron decorators for daily contract lifecycle transitions
    ScheduleModule.forRoot(),
    // BullMQ: creates its own Redis connections (separate from REDIS_CLIENT ioredis instance)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    // Bull Board dashboard at /admin/queues
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    AuditModule,
    HealthModule,
    TenantsModule,
    AirportsModule,
    AreasModule,
    FormulasModule,
    ServicesModule,
    BillingPoliciesModule,
    // Phase 3: Contract Domain
    ContractsModule,
    ContractAreasModule,
    ContractServicesModule,
    ObligationsModule,
    // Phase 3: Contract lifecycle scheduler
    ContractSchedulerModule,
    // Phase 4: Obligation & Declaration
    DeclarationsModule,
    SettlementModule,
    // Phase 5: Billing & Invoice
    BillingModule,
    InvoicesModule,
    // Phase 5: Notifications
    NotificationsModule,
    // Phase 6: Multi-Currency & Reporting
    ExchangeRatesModule,
    // Phase 6: Reporting
    ReportsModule,
    // Phase 8: V2 Enterprise Service Layer
    TenantGroupsModule,
    EquipmentModule,
    AreaOccupanciesModule,
    ContractEquipmentModule,
    AreaAllocationsModule,
    TenantScoresModule,
    CreditNotesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
