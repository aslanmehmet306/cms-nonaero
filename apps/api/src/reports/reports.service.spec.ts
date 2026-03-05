import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../database/prisma.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import Decimal from 'decimal.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    obligation: {
      groupBy: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    invoiceLog: {
      groupBy: jest.Mock;
    };
    contract: {
      count: jest.Mock;
    };
    tenant: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    billingRun: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };
  let exchangeRatesService: {
    convert: jest.Mock;
  };

  const airportId = 'airport-uuid-1';

  beforeEach(async () => {
    prisma = {
      obligation: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      invoiceLog: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      contract: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenant: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      billingRun: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    exchangeRatesService = {
      convert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExchangeRatesService, useValue: exchangeRatesService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // -------------------------------------------------------
  // getDashboard
  // -------------------------------------------------------
  describe('getDashboard', () => {
    it('should return totalRevenue per currency from obligations with billable statuses', async () => {
      prisma.obligation.groupBy.mockResolvedValue([
        { currency: 'TRY', _sum: { amount: new Decimal('50000') }, _count: { id: 3 } },
        { currency: 'EUR', _sum: { amount: new Decimal('2000') }, _count: { id: 1 } },
      ]);

      const result = await service.getDashboard({ airportId });

      expect(result.totalRevenue).toEqual([
        { amount: '50000.00', currency: 'TRY', count: 3 },
        { amount: '2000.00', currency: 'EUR', count: 1 },
      ]);

      // Verify the groupBy was called with correct statuses
      const groupByCall = prisma.obligation.groupBy.mock.calls[0][0];
      expect(groupByCall.by).toContain('currency');
      expect(groupByCall.where.status.in).toEqual(
        expect.arrayContaining(['ready', 'invoiced', 'settled']),
      );
    });

    it('should return outstandingInvoices from invoiceLogs with outstanding statuses', async () => {
      // First call is obligation groupBy (revenue), second and third are invoice groupBy
      prisma.invoiceLog.groupBy
        .mockResolvedValueOnce([
          {
            currency: 'TRY',
            _sum: { amountTotal: new Decimal('15000') },
            _count: { _all: 5 },
          },
        ])
        .mockResolvedValueOnce([]); // paid invoices

      const result = await service.getDashboard({ airportId });

      expect(result.outstandingInvoices).toEqual([
        { amount: '15000.00', currency: 'TRY', count: 5 },
      ]);
    });

    it('should return collectionRate as percentage paid / (paid + outstanding)', async () => {
      // Outstanding invoices
      prisma.invoiceLog.groupBy
        .mockResolvedValueOnce([
          { currency: 'TRY', _sum: { amountTotal: new Decimal('30000') }, _count: { _all: 3 } },
        ])
        // Paid invoices
        .mockResolvedValueOnce([
          { currency: 'TRY', _sum: { amountTotal: new Decimal('70000') }, _count: { _all: 7 } },
        ]);

      const result = await service.getDashboard({ airportId });

      // paid / (paid + outstanding) * 100 = 70000 / 100000 * 100 = 70
      expect(result.collectionRate).toBe(70);
    });

    it('should return collectionRate = 0 when no invoices exist (not NaN)', async () => {
      // All empty
      prisma.invoiceLog.groupBy.mockResolvedValue([]);

      const result = await service.getDashboard({ airportId });

      expect(result.collectionRate).toBe(0);
      expect(Number.isNaN(result.collectionRate)).toBe(false);
    });

    it('should return activeContracts and activeTenants counts', async () => {
      prisma.contract.count.mockResolvedValue(12);
      prisma.tenant.count.mockResolvedValue(8);

      const result = await service.getDashboard({ airportId });

      expect(result.activeContracts).toBe(12);
      expect(result.activeTenants).toBe(8);
    });
  });

  // -------------------------------------------------------
  // getRevenueSummary
  // -------------------------------------------------------
  describe('getRevenueSummary', () => {
    const baseQuery = {
      airportId,
      periodFrom: '2026-01-01',
      periodTo: '2026-06-30',
    };

    it('should return amounts grouped by tenantId + currency with obligation count', async () => {
      prisma.obligation.groupBy.mockResolvedValueOnce([
        { tenantId: 'tenant-1', currency: 'TRY', _sum: { amount: new Decimal('25000') }, _count: { id: 5 } },
        { tenantId: 'tenant-2', currency: 'TRY', _sum: { amount: new Decimal('18000') }, _count: { id: 3 } },
      ]);
      // Second groupBy call for chargeType
      prisma.obligation.groupBy.mockResolvedValueOnce([]);

      prisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1', name: 'Starbucks' },
        { id: 'tenant-2', name: 'TAV Primeclass' },
      ]);

      const result = await service.getRevenueSummary(baseQuery);

      expect(result.byTenant).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tenantId: 'tenant-1',
            tenantName: 'Starbucks',
            amount: '25000.00',
            currency: 'TRY',
            obligationCount: 5,
          }),
        ]),
      );
    });

    it('should return amounts grouped by chargeType + currency with obligation count', async () => {
      // Tenant groupBy
      prisma.obligation.groupBy.mockResolvedValueOnce([]);
      // Service type groupBy
      prisma.obligation.groupBy.mockResolvedValueOnce([
        { chargeType: 'base_rent', currency: 'TRY', _sum: { amount: new Decimal('40000') }, _count: { id: 8 } },
        { chargeType: 'revenue_share', currency: 'TRY', _sum: { amount: new Decimal('15000') }, _count: { id: 4 } },
      ]);

      const result = await service.getRevenueSummary(baseQuery);

      expect(result.byChargeType).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            chargeType: 'base_rent',
            amount: '40000.00',
            currency: 'TRY',
            obligationCount: 8,
          }),
        ]),
      );
    });

    it('should convert amounts to reportingCurrency when specified', async () => {
      prisma.obligation.groupBy
        .mockResolvedValueOnce([
          { tenantId: 'tenant-1', currency: 'EUR', _sum: { amount: new Decimal('1000') }, _count: { id: 2 } },
        ])
        .mockResolvedValueOnce([]);

      prisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1', name: 'Test Tenant' },
      ]);

      exchangeRatesService.convert.mockResolvedValue({
        convertedAmount: new Decimal('35120.00'),
        rate: new Decimal('35.12'),
        rateDate: new Date('2026-06-30'),
      });

      const result = await service.getRevenueSummary({
        ...baseQuery,
        reportingCurrency: 'TRY',
      });

      expect(exchangeRatesService.convert).toHaveBeenCalledWith(
        expect.anything(),
        'EUR',
        'TRY',
        expect.any(Date),
      );

      // Should include converted amount
      expect(result.byTenant[0].convertedAmount).toBe('35120.00');
      expect(result.byTenant[0].convertedCurrency).toBe('TRY');
    });

    it('should return empty arrays for empty period (not error)', async () => {
      prisma.obligation.groupBy.mockResolvedValue([]);

      const result = await service.getRevenueSummary(baseQuery);

      expect(result.byTenant).toEqual([]);
      expect(result.byChargeType).toEqual([]);
    });
  });

  // -------------------------------------------------------
  // getAgingReport
  // -------------------------------------------------------
  describe('getAgingReport', () => {
    it('should bucket invoices into current/1-30/31-60/61-90/90+ categories', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: 'current', count: 3, total_amount: new Decimal('5000'), currency: 'TRY' },
        { bucket: '1-30', count: 2, total_amount: new Decimal('8000'), currency: 'TRY' },
        { bucket: '31-60', count: 1, total_amount: new Decimal('3000'), currency: 'TRY' },
        { bucket: '61-90', count: 1, total_amount: new Decimal('2000'), currency: 'TRY' },
        { bucket: '90+', count: 1, total_amount: new Decimal('10000'), currency: 'TRY' },
      ]);

      const result = await service.getAgingReport({ airportId });

      expect(result.buckets).toHaveLength(5);
      expect(result.buckets.map((b: any) => b.bucket)).toEqual([
        'current',
        '1-30',
        '31-60',
        '61-90',
        '90+',
      ]);
      expect(result.buckets[0].count).toBe(3);
      expect(result.buckets[0].totalAmount).toBe('5000.00');
      expect(result.buckets[0].currency).toBe('TRY');
    });
  });

  // -------------------------------------------------------
  // Null-safe Decimal aggregation (pitfall #1)
  // -------------------------------------------------------
  describe('null-safe aggregation', () => {
    it('should return Decimal(0) for _sum null (empty groupBy results)', async () => {
      // All groupBy returns empty — amounts should be 0, not NaN or null
      prisma.obligation.groupBy.mockResolvedValue([]);
      prisma.invoiceLog.groupBy.mockResolvedValue([]);

      const result = await service.getDashboard({ airportId });

      expect(result.totalRevenue).toEqual([]);
      expect(result.collectionRate).toBe(0);
    });
  });

  // -------------------------------------------------------
  // getObligationList
  // -------------------------------------------------------
  describe('getObligationList', () => {
    it('should return obligations filtered by tenantId, status, chargeType with calculationTrace', async () => {
      const obligations = [
        {
          id: 'obl-1',
          tenantId: 'tenant-1',
          chargeType: 'base_rent',
          status: 'ready',
          amount: new Decimal('10000'),
          currency: 'TRY',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          calculationTrace: { formula: 'rate * area_m2', result: 10000 },
          contract: { number: 'CNT-001', tenantId: 'tenant-1' },
          tenant: { name: 'Starbucks' },
        },
      ];

      prisma.obligation.findMany.mockResolvedValue(obligations);
      prisma.obligation.count.mockResolvedValue(1);

      const result = await service.getObligationList({
        airportId,
        tenantId: 'tenant-1',
        status: 'ready' as any,
        chargeType: 'base_rent' as any,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].calculationTrace).toBeDefined();
      expect(result.total).toBe(1);

      // Verify filter was applied
      const whereArg = prisma.obligation.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe('tenant-1');
      expect(whereArg.status).toBe('ready');
      expect(whereArg.chargeType).toBe('base_rent');
    });

    it('should support periodStart/periodEnd range filtering', async () => {
      prisma.obligation.findMany.mockResolvedValue([]);
      prisma.obligation.count.mockResolvedValue(0);

      await service.getObligationList({
        airportId,
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30',
      });

      const whereArg = prisma.obligation.findMany.mock.calls[0][0].where;
      expect(whereArg.periodStart).toEqual({ gte: expect.any(Date) });
      expect(whereArg.periodEnd).toEqual({ lte: expect.any(Date) });
    });
  });

  // -------------------------------------------------------
  // getBillingHistory
  // -------------------------------------------------------
  describe('getBillingHistory', () => {
    it('should return billing runs with status, dates, tenant counts, amounts', async () => {
      const billingRuns = [
        {
          id: 'br-1',
          runType: 'manual',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          status: 'completed',
          totalObligations: 10,
          totalAmount: new Decimal('50000'),
          totalInvoices: 5,
          createdAt: new Date('2026-02-01'),
          completedAt: new Date('2026-02-01'),
          _count: { invoiceLogs: 5 },
        },
      ];

      prisma.billingRun.findMany.mockResolvedValue(billingRuns);
      prisma.billingRun.count.mockResolvedValue(1);

      const result = await service.getBillingHistory({ airportId });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('completed');
      expect(result.data[0].totalObligations).toBe(10);
      expect(result.total).toBe(1);
    });
  });
});
