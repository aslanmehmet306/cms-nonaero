import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
