import { Module } from '@nestjs/common';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * ReportsModule — dashboard KPIs, revenue summaries, aging report,
 * obligation list, and billing history endpoints.
 *
 * Imports ExchangeRatesModule for currency conversion via
 * ExchangeRatesService.convert() (display-only, R10.4).
 *
 * DatabaseModule is global, so no explicit import needed.
 */
@Module({
  imports: [ExchangeRatesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
