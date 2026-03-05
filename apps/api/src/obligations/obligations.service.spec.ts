import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { ObligationsService } from './obligations.service';
import { PrismaService } from '../database/prisma.service';
import {
  ChargeType,
  ObligationStatus,
  ObligationType,
  PolicyStatus,
  ServiceType,
} from '@shared-types/enums';

describe('ObligationsService', () => {
  let service: ObligationsService;
  let prisma: {
    contract: { findUnique: jest.Mock };
    billingPolicy: { findFirst: jest.Mock };
    obligation: { createMany: jest.Mock; findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const makeService = (serviceType: ServiceType, overrideCurrency?: string) => ({
    id: `cs-${serviceType}`,
    contractId: 'contract-uuid-1',
    serviceDefinitionId: `sd-${serviceType}`,
    overrideCurrency: overrideCurrency ?? null,
    isActive: true,
    serviceDefinition: {
      id: `sd-${serviceType}`,
      code: serviceType.toUpperCase(),
      name: serviceType,
      serviceType,
    },
  });

  const makeContract = (
    monthsLong: number,
    services: ReturnType<typeof makeService>[],
    options: { magCurrency?: string } = {},
  ) => {
    const from = new Date('2024-01-01');
    const to = new Date(from.getFullYear(), from.getMonth() + monthsLong, 1);
    return {
      id: 'contract-uuid-1',
      airportId: 'airport-uuid-1',
      tenantId: 'tenant-uuid-1',
      contractNumber: 'CNT-001',
      version: 1,
      effectiveFrom: from,
      effectiveTo: to,
      magCurrency: options.magCurrency ?? null,
      contractServices: services,
      contractAreas: [],
      tenant: { id: 'tenant-uuid-1', name: 'Test Tenant' },
      airport: { id: 'airport-uuid-1', iataCode: 'ADB' },
    };
  };

  const mockActiveBillingPolicy = {
    id: 'bp-uuid-1',
    airportId: 'airport-uuid-1',
    dueDateDays: 30,
    status: PolicyStatus.active,
  };

  const mockObligation = {
    id: 'obl-uuid-1',
    contractId: 'contract-uuid-1',
    tenantId: 'tenant-uuid-1',
    airportId: 'airport-uuid-1',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-31'),
    dueDate: new Date('2024-03-01'),
    status: ObligationStatus.scheduled,
    amount: null,
    currency: 'TRY',
    obligationType: ObligationType.rent,
    chargeType: ChargeType.base_rent,
    serviceDefinitionId: 'sd-rent',
    contractVersion: 1,
  };

  beforeEach(async () => {
    prisma = {
      contract: { findUnique: jest.fn() },
      billingPolicy: { findFirst: jest.fn() },
      obligation: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObligationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    // Suppress logger noise in tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = module.get<ObligationsService>(ObligationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── generateSchedule ──────────────────────────────────────────────────────

  describe('generateSchedule', () => {
    it('should create 24 obligations for a 12-month contract with 2 services', async () => {
      const services = [makeService(ServiceType.rent), makeService(ServiceType.revenue_share)];
      const contract = makeContract(12, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 24 });

      const result = await service.generateSchedule('contract-uuid-1');

      expect(result).toBe(24);
      expect(prisma.obligation.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.any(Object)]),
        }),
      );
      const callData = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(callData).toHaveLength(24);
    });

    it('should create 12 obligations for a 6-month contract with 2 services', async () => {
      const services = [makeService(ServiceType.rent), makeService(ServiceType.revenue_share)];
      const contract = makeContract(6, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 12 });

      const result = await service.generateSchedule('contract-uuid-1');

      expect(result).toBe(12);
      const callData = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(callData).toHaveLength(12);
    });

    it('each obligation should have periodStart = 1st of month and periodEnd = last day of month', async () => {
      const services = [makeService(ServiceType.rent)];
      const contract = makeContract(3, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 3 });

      await service.generateSchedule('contract-uuid-1');

      const callData = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(callData).toHaveLength(3);

      // Jan 2024
      expect(callData[0].periodStart.getDate()).toBe(1);
      expect(callData[0].periodStart.getMonth()).toBe(0); // January
      expect(callData[0].periodEnd.getMonth()).toBe(0);
      expect(callData[0].periodEnd.getDate()).toBe(31); // Jan has 31 days

      // Feb 2024
      expect(callData[1].periodStart.getDate()).toBe(1);
      expect(callData[1].periodStart.getMonth()).toBe(1); // February
      expect(callData[1].periodEnd.getMonth()).toBe(1);
      expect(callData[1].periodEnd.getDate()).toBe(29); // 2024 is leap year

      // Mar 2024
      expect(callData[2].periodStart.getDate()).toBe(1);
      expect(callData[2].periodStart.getMonth()).toBe(2); // March
      expect(callData[2].periodEnd.getDate()).toBe(31);
    });

    it('should map ServiceType.rent -> ObligationType.rent and ChargeType.base_rent', async () => {
      const services = [makeService(ServiceType.rent)];
      const contract = makeContract(1, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(obligation.obligationType).toBe(ObligationType.rent);
      expect(obligation.chargeType).toBe(ChargeType.base_rent);
    });

    it('should map ServiceType.revenue_share -> ObligationType.revenue_share and ChargeType.revenue_share', async () => {
      const services = [makeService(ServiceType.revenue_share)];
      const contract = makeContract(1, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(obligation.obligationType).toBe(ObligationType.revenue_share);
      expect(obligation.chargeType).toBe(ChargeType.revenue_share);
    });

    it('should map ServiceType.service_charge -> ObligationType.rent and ChargeType.service_charge', async () => {
      const services = [makeService(ServiceType.service_charge)];
      const contract = makeContract(1, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(obligation.obligationType).toBe(ObligationType.rent);
      expect(obligation.chargeType).toBe(ChargeType.service_charge);
    });

    it('should map ServiceType.utility -> ObligationType.rent and ChargeType.utility', async () => {
      const services = [makeService(ServiceType.utility)];
      const contract = makeContract(1, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(obligation.obligationType).toBe(ObligationType.rent);
      expect(obligation.chargeType).toBe(ChargeType.utility);
    });

    it('should use overrideCurrency from ContractService if set', async () => {
      const services = [makeService(ServiceType.rent, 'EUR')];
      const contract = makeContract(1, services, { magCurrency: 'USD' });

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(obligation.currency).toBe('EUR');
    });

    it('should fall back to contract.magCurrency when no overrideCurrency set', async () => {
      const services = [makeService(ServiceType.rent)]; // no override
      const contract = makeContract(1, services, { magCurrency: 'USD' });

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(obligation.currency).toBe('USD');
    });

    it('should fall back to TRY when no overrideCurrency and no magCurrency', async () => {
      const services = [makeService(ServiceType.rent)]; // no override
      const contract = makeContract(1, services); // no magCurrency (null)

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      expect(obligation.currency).toBe('TRY');
    });

    it('should compute dueDate = periodEnd + dueDateDays from BillingPolicy', async () => {
      const services = [makeService(ServiceType.rent)];
      const contract = makeContract(1, services);
      const policy = { ...mockActiveBillingPolicy, dueDateDays: 15 };

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(policy);
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      // Jan 2024 periodEnd = Jan 31, dueDate = Feb 15
      const expectedDueDate = new Date('2024-01-31');
      expectedDueDate.setDate(expectedDueDate.getDate() + 15);
      expect(obligation.dueDate.getTime()).toBe(expectedDueDate.getTime());
    });

    it('should default dueDateDays=30 when no BillingPolicy found', async () => {
      const services = [makeService(ServiceType.rent)];
      const contract = makeContract(1, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(null); // no policy
      prisma.obligation.createMany.mockResolvedValue({ count: 1 });

      await service.generateSchedule('contract-uuid-1');

      const [obligation] = prisma.obligation.createMany.mock.calls[0][0].data;
      // Jan 31 + 30 days = Mar 1 (2024 is leap year, so Feb has 29 days)
      const expectedDueDate = new Date('2024-01-31');
      expectedDueDate.setDate(expectedDueDate.getDate() + 30);
      expect(obligation.dueDate.getTime()).toBe(expectedDueDate.getTime());
    });

    it('should create all obligations with status=scheduled and amount=null', async () => {
      const services = [makeService(ServiceType.rent)];
      const contract = makeContract(2, services);

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);
      prisma.obligation.createMany.mockResolvedValue({ count: 2 });

      await service.generateSchedule('contract-uuid-1');

      const callData = prisma.obligation.createMany.mock.calls[0][0].data;
      callData.forEach((obl: { status: string; amount: null }) => {
        expect(obl.status).toBe(ObligationStatus.scheduled);
        expect(obl.amount).toBeNull();
      });
    });

    it('should return 0 and not call createMany when contract has no assigned services', async () => {
      const contract = makeContract(12, []); // no services

      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActiveBillingPolicy);

      const result = await service.generateSchedule('contract-uuid-1');

      expect(result).toBe(0);
      expect(prisma.obligation.createMany).not.toHaveBeenCalled();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated obligations with { data, meta } envelope', async () => {
      prisma.obligation.findMany.mockResolvedValue([mockObligation]);
      prisma.obligation.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toEqual({
        data: [mockObligation],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should filter by contractId when provided', async () => {
      prisma.obligation.findMany.mockResolvedValue([mockObligation]);
      prisma.obligation.count.mockResolvedValue(1);

      await service.findAll({ contractId: 'contract-uuid-1' });

      expect(prisma.obligation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contractId: 'contract-uuid-1' }),
        }),
      );
    });

    it('should filter by tenantId when provided', async () => {
      prisma.obligation.findMany.mockResolvedValue([]);
      prisma.obligation.count.mockResolvedValue(0);

      await service.findAll({ tenantId: 'tenant-uuid-1' });

      expect(prisma.obligation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-uuid-1' }),
        }),
      );
    });

    it('should filter by status when provided', async () => {
      prisma.obligation.findMany.mockResolvedValue([]);
      prisma.obligation.count.mockResolvedValue(0);

      await service.findAll({ status: ObligationStatus.scheduled });

      expect(prisma.obligation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ObligationStatus.scheduled }),
        }),
      );
    });

    it('should apply pagination using page and limit', async () => {
      prisma.obligation.findMany.mockResolvedValue([]);
      prisma.obligation.count.mockResolvedValue(0);

      await service.findAll({ page: 2, limit: 10 });

      expect(prisma.obligation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return an obligation with contract and tenant relations', async () => {
      const fullObligation = {
        ...mockObligation,
        contract: { id: 'contract-uuid-1', contractNumber: 'CNT-001' },
        tenant: { id: 'tenant-uuid-1', name: 'Test Tenant' },
        serviceDefinition: { id: 'sd-rent', name: 'Rent' },
      };
      prisma.obligation.findUnique.mockResolvedValue(fullObligation);

      const result = await service.findOne('obl-uuid-1');

      expect(prisma.obligation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'obl-uuid-1' } }),
      );
      expect(result).toEqual(fullObligation);
    });

    it('should throw NotFoundException when obligation does not exist', async () => {
      prisma.obligation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
