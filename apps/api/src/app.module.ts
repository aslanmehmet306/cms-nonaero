import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
