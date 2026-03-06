import { Module } from '@nestjs/common';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';

/**
 * ExchangeRatesModule — exchange rate CRUD and effective-date rate lookup.
 *
 * Exports ExchangeRatesService so downstream modules (e.g. ReportsModule
 * in Phase 6 Plan 03) can convert amounts using getRate()/convert().
 *
 * DatabaseModule is global, so no explicit import needed.
 */
@Module({
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService],
  exports: [ExchangeRatesService],
})
export class ExchangeRatesModule {}
