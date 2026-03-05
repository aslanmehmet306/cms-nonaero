import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DecimalHelper } from '../common/utils/decimal-helper';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';
import { QueryExchangeRatesDto } from './dto/query-exchange-rates.dto';
import Decimal from 'decimal.js';

/**
 * ExchangeRatesService — CRUD for exchange rates plus effective-date
 * rate lookup and currency conversion helpers.
 *
 * Core method: getRate(from, to, date) returns the most recent rate
 * on or before the given effective date. Same-currency lookup returns
 * identity rate (1.0) without hitting the database.
 *
 * convert() wraps getRate() with DecimalHelper.multiply + roundMoney
 * so callers never deal with native JS float math.
 */
@Injectable()
export class ExchangeRatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new exchange rate record.
   * The Prisma @@unique([fromCurrency, toCurrency, effectiveDate, source])
   * constraint prevents duplicate entries.
   */
  async create(dto: CreateExchangeRateDto) {
    return this.prisma.exchangeRate.create({
      data: {
        airportId: dto.airportId,
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        rate: new Decimal(dto.rate),
        effectiveDate: new Date(dto.effectiveDate),
        source: dto.source,
        notes: dto.notes,
        createdBy: dto.createdBy,
      },
    });
  }

  /**
   * Update mutable fields only: rate, notes, source.
   */
  async update(id: string, dto: UpdateExchangeRateDto) {
    await this.findOne(id); // throws NotFoundException if missing

    const data: Record<string, unknown> = {};
    if (dto.rate !== undefined) data.rate = new Decimal(dto.rate);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.source !== undefined) data.source = dto.source;

    return this.prisma.exchangeRate.update({
      where: { id },
      data,
    });
  }

  /**
   * Paginated list with optional filters on currency pair and date range.
   */
  async findAll(query: QueryExchangeRatesDto) {
    const { airportId, fromCurrency, toCurrency, dateFrom, dateTo } = query;
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 25;

    const where: Record<string, unknown> = { airportId };
    if (fromCurrency) where.fromCurrency = fromCurrency;
    if (toCurrency) where.toCurrency = toCurrency;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.effectiveDate = dateFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.exchangeRate.findMany({
        where,
        orderBy: { effectiveDate: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.exchangeRate.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Find a single exchange rate by ID.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { id },
    });
    if (!rate) {
      throw new NotFoundException(`Exchange rate with id "${id}" not found`);
    }
    return rate;
  }

  /**
   * Delete an exchange rate by ID.
   * Throws NotFoundException if not found.
   */
  async remove(id: string) {
    await this.findOne(id); // throws NotFoundException if missing
    return this.prisma.exchangeRate.delete({ where: { id } });
  }

  /**
   * Core lookup: find the most recent exchange rate on or before effectiveDate.
   *
   * If fromCurrency === toCurrency, returns rate=1.0 with source='identity'
   * immediately (no database query).
   *
   * Otherwise queries Prisma with effectiveDate <= given date, ordered desc,
   * and returns the first match. Throws NotFoundException if no rate exists.
   */
  async getRate(
    fromCurrency: string,
    toCurrency: string,
    effectiveDate: Date,
  ): Promise<{ rate: Decimal; source: string; effectiveDate: Date }> {
    // Identity shortcut: same currency always 1:1
    if (fromCurrency === toCurrency) {
      return {
        rate: new Decimal(1),
        source: 'identity',
        effectiveDate,
      };
    }

    const record = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        effectiveDate: { lte: effectiveDate },
      },
      orderBy: { effectiveDate: 'desc' },
    });

    if (!record) {
      throw new NotFoundException(
        `No exchange rate found for ${fromCurrency}/${toCurrency} on or before ${effectiveDate.toISOString().slice(0, 10)}`,
      );
    }

    return {
      rate: new Decimal(record.rate.toString()),
      source: record.source,
      effectiveDate: record.effectiveDate,
    };
  }

  /**
   * Convenience: convert an amount from one currency to another using the
   * effective-date rate lookup. Uses DecimalHelper for precision.
   *
   * Returns { convertedAmount, rate, rateDate }.
   */
  async convert(
    amount: number | string | Decimal,
    fromCurrency: string,
    toCurrency: string,
    effectiveDate: Date,
  ): Promise<{ convertedAmount: Decimal; rate: Decimal; rateDate: Date }> {
    const lookup = await this.getRate(fromCurrency, toCurrency, effectiveDate);

    const convertedAmount = DecimalHelper.roundMoney(
      DecimalHelper.multiply(amount, lookup.rate),
    );

    return {
      convertedAmount,
      rate: lookup.rate,
      rateDate: lookup.effectiveDate,
    };
  }
}
