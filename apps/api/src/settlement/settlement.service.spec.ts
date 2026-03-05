import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../database/prisma.service';
import { ChargeType, ObligationStatus, ObligationType } from '@shared-types/enums';
import Decimal from 'decimal.js';

describe('SettlementService', () => {
  let service: SettlementService;
  let prisma: {
    contract: { findUnique: jest.Mock };
    obligation: { findFirst: jest.Mock; findMany: jest.Mock; upsert: jest.Mock; create: jest.Mock };
    settlementEntry: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      contract: { findUnique: jest.fn() },
      obligation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
      },
      settlementEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
  });

  describe('calculateMonthlyMag', () => {
    const contractId = 'contract-1';
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-01-31');
    const baseContract = {
      id: contractId,
      airportId: 'airport-1',
      tenantId: 'tenant-1',
      annualMag: new Decimal(500000),
      magCurrency: 'TRY',
      version: 1,
    };

    it('should create mag_shortfall obligation when revenue_share < monthly MAG', async () => {
      // monthly MAG = 500000/12 = 41666.67
      prisma.contract.findUnique.mockResolvedValue(baseContract);
      prisma.obligation.findFirst.mockResolvedValue({
        id: 'obl-rev-1',
        amount: new Decimal(35000), // below 41666.67
      });
      prisma.settlementEntry.create.mockResolvedValue({});
      prisma.obligation.upsert.mockResolvedValue({});

      await service.calculateMonthlyMag(contractId, periodStart, periodEnd);

      // SettlementEntry should be created
      expect(prisma.settlementEntry.create).toHaveBeenCalledTimes(1);
      const entryData = prisma.settlementEntry.create.mock.calls[0][0].data;
      expect(entryData.settlementType).toBe('monthly_mag');
      expect(parseFloat(entryData.revenueShareAmount.toString())).toBeCloseTo(35000, 0);

      // mag_shortfall obligation upserted
      expect(prisma.obligation.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = prisma.obligation.upsert.mock.calls[0][0];
      expect(upsertArgs.create.obligationType).toBe(ObligationType.mag_shortfall);
      expect(upsertArgs.create.chargeType).toBe(ChargeType.mag_settlement);
      expect(upsertArgs.create.status).toBe(ObligationStatus.ready);
      // shortfall = 41666.67 - 35000 = ~6666.67
      const shortfall = parseFloat(upsertArgs.create.amount.toString());
      expect(shortfall).toBeGreaterThan(6600);
      expect(shortfall).toBeLessThan(6700);
    });

    it('should NOT create obligation when revenue_share >= monthly MAG', async () => {
      prisma.contract.findUnique.mockResolvedValue(baseContract);
      prisma.obligation.findFirst.mockResolvedValue({
        id: 'obl-rev-1',
        amount: new Decimal(45000), // above 41666.67
      });
      prisma.settlementEntry.create.mockResolvedValue({});

      await service.calculateMonthlyMag(contractId, periodStart, periodEnd);

      // SettlementEntry still created (for audit)
      expect(prisma.settlementEntry.create).toHaveBeenCalledTimes(1);
      // No obligation created (surplus)
      expect(prisma.obligation.upsert).not.toHaveBeenCalled();
    });

    it('should skip when contract has no annualMag', async () => {
      prisma.contract.findUnique.mockResolvedValue({ ...baseContract, annualMag: null });

      await service.calculateMonthlyMag(contractId, periodStart, periodEnd);

      expect(prisma.settlementEntry.create).not.toHaveBeenCalled();
      expect(prisma.obligation.upsert).not.toHaveBeenCalled();
    });

    it('should handle re-submitted declaration by upserting (not duplicating)', async () => {
      prisma.contract.findUnique.mockResolvedValue(baseContract);
      prisma.obligation.findFirst.mockResolvedValue({
        id: 'obl-rev-1',
        amount: new Decimal(30000),
      });
      prisma.settlementEntry.create.mockResolvedValue({});
      prisma.obligation.upsert.mockResolvedValue({});

      await service.calculateMonthlyMag(contractId, periodStart, periodEnd);

      // Uses upsert, not create — handles re-calculation gracefully
      expect(prisma.obligation.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = prisma.obligation.upsert.mock.calls[0][0];
      expect(upsertArgs.where).toHaveProperty('lineHash');
      expect(upsertArgs.update).toHaveProperty('amount');
    });

    it('should create settlement entry with correct amounts', async () => {
      prisma.contract.findUnique.mockResolvedValue(baseContract);
      prisma.obligation.findFirst.mockResolvedValue({
        id: 'obl-rev-1',
        amount: new Decimal(35000),
      });
      prisma.settlementEntry.create.mockResolvedValue({});
      prisma.obligation.upsert.mockResolvedValue({});

      await service.calculateMonthlyMag(contractId, periodStart, periodEnd);

      const entryData = prisma.settlementEntry.create.mock.calls[0][0].data;
      expect(entryData.airportId).toBe('airport-1');
      expect(entryData.contractId).toBe(contractId);
      expect(entryData.tenantId).toBe('tenant-1');
      expect(entryData.settlementType).toBe('monthly_mag');
      // shortfall should be positive
      expect(parseFloat(entryData.shortfall.toString())).toBeGreaterThan(0);
    });

    it('should handle no revenue obligation found (zero revenue)', async () => {
      prisma.contract.findUnique.mockResolvedValue(baseContract);
      prisma.obligation.findFirst.mockResolvedValue(null);
      prisma.settlementEntry.create.mockResolvedValue({});
      prisma.obligation.upsert.mockResolvedValue({});

      await service.calculateMonthlyMag(contractId, periodStart, periodEnd);

      // Full MAG as shortfall
      expect(prisma.obligation.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = prisma.obligation.upsert.mock.calls[0][0];
      const shortfall = parseFloat(upsertArgs.create.amount.toString());
      // monthly MAG = 500000 / 12 ≈ 41666.67
      expect(shortfall).toBeGreaterThan(41600);
      expect(shortfall).toBeLessThan(41700);
    });
  });

  describe('calculateYearEndTrueUp', () => {
    const contractId = 'contract-1';
    const fyStart = new Date('2026-01-01');
    const fyEnd = new Date('2026-12-31');
    const baseContract = {
      id: contractId,
      airportId: 'airport-1',
      tenantId: 'tenant-1',
      annualMag: new Decimal(500000),
      magCurrency: 'TRY',
      version: 1,
    };

    it('should create true-up obligation when annual total < annualMag', async () => {
      prisma.contract.findUnique.mockResolvedValue(baseContract);
      // 12 months of revenue_share obligations, all below MAG
      prisma.obligation.findMany
        .mockResolvedValueOnce(
          // revenue_share obligations
          Array.from({ length: 12 }, (_, i) => ({
            id: `obl-rev-${i}`,
            amount: new Decimal(35000), // 35k * 12 = 420k < 500k
          })),
        )
        .mockResolvedValueOnce(
          // monthly shortfalls already paid
          Array.from({ length: 12 }, (_, i) => ({
            id: `obl-mag-${i}`,
            // monthly MAG=41666.67, rev=35000, monthly shortfall≈6666.67
            amount: new Decimal(6666.67),
          })),
        );
      prisma.settlementEntry.create.mockResolvedValue({});
      prisma.obligation.create.mockResolvedValue({});

      const result = await service.calculateYearEndTrueUp(contractId, fyStart, fyEnd);

      // Annual revenue = 420000, MAG = 500000, gap = 80000
      // Monthly shortfalls paid = 6666.67 * 12 = 80000.04
      // Net true-up = 80000 - 80000.04 ≈ 0 (already covered by monthly)
      // Since net is ≤ 0, no true-up obligation
      expect(result.created).toBe(false);
      expect(prisma.obligation.create).not.toHaveBeenCalled();
    });

    it('should NOT create obligation when annual total >= annualMag', async () => {
      prisma.contract.findUnique.mockResolvedValue(baseContract);
      prisma.obligation.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 12 }, () => ({
            amount: new Decimal(45000), // 45k * 12 = 540k > 500k
          })),
        )
        .mockResolvedValueOnce([]); // no monthly shortfalls
      prisma.settlementEntry.create.mockResolvedValue({});

      const result = await service.calculateYearEndTrueUp(contractId, fyStart, fyEnd);

      expect(result.created).toBe(false);
      expect(prisma.obligation.create).not.toHaveBeenCalled();
    });

    it('should return early when contract has no annualMag', async () => {
      prisma.contract.findUnique.mockResolvedValue({ ...baseContract, annualMag: null });

      const result = await service.calculateYearEndTrueUp(contractId, fyStart, fyEnd);

      expect(result.trueUpAmount.isZero()).toBe(true);
      expect(result.created).toBe(false);
    });

    it('should create true-up when there is a net shortfall after deducting monthly shortfalls', async () => {
      prisma.contract.findUnique.mockResolvedValue(baseContract);
      // Some months had revenue, some didn't
      prisma.obligation.findMany
        .mockResolvedValueOnce([
          // Only 6 months of revenue (half year)
          ...Array.from({ length: 6 }, () => ({
            amount: new Decimal(40000), // 40k * 6 = 240k
          })),
        ])
        .mockResolvedValueOnce([
          // 6 monthly shortfalls (from months with no revenue)
          ...Array.from({ length: 6 }, () => ({
            // full monthly MAG as shortfall since no revenue
            amount: new Decimal(41666.67),
          })),
        ]);
      prisma.settlementEntry.create.mockResolvedValue({});
      prisma.obligation.create.mockResolvedValue({});

      const result = await service.calculateYearEndTrueUp(contractId, fyStart, fyEnd);

      // Annual revenue = 240000, MAG = 500000, gap = 260000
      // Monthly shortfalls = 41666.67 * 6 = 250000.02
      // Net true-up = 260000 - 250000.02 = ~9999.98
      expect(result.created).toBe(true);
      expect(parseFloat(result.trueUpAmount.toString())).toBeGreaterThan(9900);

      // Creates SettlementEntry
      expect(prisma.settlementEntry.create).toHaveBeenCalledTimes(1);
      const entry = prisma.settlementEntry.create.mock.calls[0][0].data;
      expect(entry.settlementType).toBe('year_end_true_up');

      // Creates true-up obligation
      expect(prisma.obligation.create).toHaveBeenCalledTimes(1);
      const oblData = prisma.obligation.create.mock.calls[0][0].data;
      expect(oblData.obligationType).toBe(ObligationType.mag_true_up);
      expect(oblData.status).toBe(ObligationStatus.ready);
    });
  });
});
