import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { PrismaService } from '../database/prisma.service';
import Decimal from 'decimal.js';

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;
  let prisma: {
    exchangeRate: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      exchangeRate: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExchangeRatesService>(ExchangeRatesService);
  });

  describe('create', () => {
    it('should create an exchange rate with all fields', async () => {
      const dto = {
        airportId: 'airport-1',
        fromCurrency: 'EUR',
        toCurrency: 'TRY',
        rate: 35.12,
        effectiveDate: '2026-01-15',
        source: 'MANUAL',
        notes: 'Monthly rate',
        createdBy: 'user-1',
      };

      const created = {
        id: 'rate-1',
        ...dto,
        rate: new Decimal('35.12'),
        effectiveDate: new Date('2026-01-15'),
        createdAt: new Date(),
      };

      prisma.exchangeRate.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(prisma.exchangeRate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromCurrency: 'EUR',
          toCurrency: 'TRY',
          rate: new Decimal('35.12'),
          source: 'MANUAL',
        }),
      });
    });
  });

  describe('getRate', () => {
    it('should return the most recent rate on or before the given date', async () => {
      const effectiveDate = new Date('2026-03-15');
      const rateRecord = {
        id: 'rate-1',
        fromCurrency: 'EUR',
        toCurrency: 'TRY',
        rate: new Decimal('35.12'),
        effectiveDate: new Date('2026-03-01'),
        source: 'TCMB',
      };

      prisma.exchangeRate.findFirst.mockResolvedValue(rateRecord);

      const result = await service.getRate('EUR', 'TRY', effectiveDate);

      expect(result.rate).toEqual(new Decimal('35.12'));
      expect(result.source).toBe('TCMB');
      expect(prisma.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: {
          fromCurrency: 'EUR',
          toCurrency: 'TRY',
          effectiveDate: { lte: effectiveDate },
        },
        orderBy: { effectiveDate: 'desc' },
      });
    });

    it('should return rate=1.0 and source=identity for same currency without DB query', async () => {
      const effectiveDate = new Date('2026-03-15');

      const result = await service.getRate('TRY', 'TRY', effectiveDate);

      expect(result.rate).toEqual(new Decimal(1));
      expect(result.source).toBe('identity');
      expect(result.effectiveDate).toEqual(effectiveDate);
      // No DB call should be made
      expect(prisma.exchangeRate.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when no rate exists before the date', async () => {
      prisma.exchangeRate.findFirst.mockResolvedValue(null);

      await expect(
        service.getRate('EUR', 'TRY', new Date('2020-01-01')),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('convert', () => {
    it('should return amount * rate rounded to 2 decimal places', async () => {
      const effectiveDate = new Date('2026-03-15');
      const rateRecord = {
        id: 'rate-1',
        fromCurrency: 'EUR',
        toCurrency: 'TRY',
        rate: new Decimal('35.12'),
        effectiveDate: new Date('2026-03-01'),
        source: 'TCMB',
      };

      prisma.exchangeRate.findFirst.mockResolvedValue(rateRecord);

      const result = await service.convert(100, 'EUR', 'TRY', effectiveDate);

      // 100 * 35.12 = 3512.00
      expect(result.convertedAmount.toFixed(2)).toBe('3512.00');
      expect(result.rate).toEqual(new Decimal('35.12'));
      expect(result.rateDate).toEqual(new Date('2026-03-01'));
    });

    it('should return the amount unchanged for same currency (identity)', async () => {
      const effectiveDate = new Date('2026-03-15');

      const result = await service.convert(100, 'TRY', 'TRY', effectiveDate);

      expect(result.convertedAmount.toFixed(2)).toBe('100.00');
      expect(result.rate).toEqual(new Decimal(1));
      // No DB call
      expect(prisma.exchangeRate.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results filtered by currency pair', async () => {
      const query = {
        airportId: 'airport-1',
        fromCurrency: 'EUR',
        toCurrency: 'TRY',
        page: 1,
        perPage: 25,
      };

      const rates = [
        {
          id: 'rate-1',
          fromCurrency: 'EUR',
          toCurrency: 'TRY',
          rate: new Decimal('35.12'),
          effectiveDate: new Date('2026-03-01'),
          source: 'TCMB',
        },
      ];

      prisma.exchangeRate.findMany.mockResolvedValue(rates);
      prisma.exchangeRate.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result.data).toEqual(rates);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(25);
      expect(result.meta.totalPages).toBe(1);

      // Verify filter was applied
      const whereArg = prisma.exchangeRate.findMany.mock.calls[0][0].where;
      expect(whereArg.fromCurrency).toBe('EUR');
      expect(whereArg.toCurrency).toBe('TRY');
    });
  });

  describe('create duplicate', () => {
    it('should throw unique constraint error for same pair + date + source', async () => {
      const dto = {
        airportId: 'airport-1',
        fromCurrency: 'EUR',
        toCurrency: 'TRY',
        rate: 35.12,
        effectiveDate: '2026-01-15',
        source: 'MANUAL',
        createdBy: 'user-1',
      };

      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      prisma.exchangeRate.create.mockRejectedValue(prismaError);

      await expect(service.create(dto)).rejects.toThrow();
    });
  });
});
