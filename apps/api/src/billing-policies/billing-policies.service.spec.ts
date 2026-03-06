import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingPoliciesService } from './billing-policies.service';
import { PrismaService } from '../database/prisma.service';
import { PolicyStatus } from '@shared-types/enums';

describe('BillingPoliciesService', () => {
  let service: BillingPoliciesService;
  let prisma: {
    billingPolicy: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockPolicy = {
    id: 'policy-uuid-1',
    airportId: 'airport-uuid-1',
    version: 1,
    status: PolicyStatus.draft,
    cutOffDay: 10,
    issueDay: 15,
    dueDateDays: 30,
    leadDays: 5,
    gracePeriodDays: 0,
    declarationReminderDays: 3,
    fiscalYearStartMonth: 1,
    effectiveFrom: new Date('2026-01-01'),
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
  };

  const mockActivePolicy = {
    ...mockPolicy,
    status: PolicyStatus.active,
  };

  const mockApprovedPolicy = {
    ...mockPolicy,
    status: PolicyStatus.approved,
    approvedBy: 'user-uuid-1',
    approvedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      billingPolicy: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingPoliciesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<BillingPoliciesService>(BillingPoliciesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create billing policy with status=draft', async () => {
      prisma.billingPolicy.create.mockResolvedValue(mockPolicy);

      const dto = {
        airportId: 'airport-uuid-1',
        cutOffDay: 10,
        issueDay: 15,
        dueDateDays: 30,
        effectiveFrom: '2026-01-01',
      };

      const result = await service.create(dto);

      expect(prisma.billingPolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PolicyStatus.draft,
          }),
        }),
      );
      expect(result).toEqual(mockPolicy);
    });
  });

  describe('findAll', () => {
    it('should return all policies for airport ordered by version desc', async () => {
      prisma.billingPolicy.findMany.mockResolvedValue([mockActivePolicy, mockPolicy]);

      const result = await service.findAll('airport-uuid-1');

      expect(prisma.billingPolicy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { airportId: 'airport-uuid-1' },
          orderBy: { version: 'desc' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findActive', () => {
    it('should return the active policy for airport', async () => {
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActivePolicy);

      const result = await service.findActive('airport-uuid-1');

      expect(prisma.billingPolicy.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { airportId: 'airport-uuid-1', status: PolicyStatus.active },
        }),
      );
      expect(result).toEqual(mockActivePolicy);
    });
  });

  describe('findOne', () => {
    it('should return billing policy by ID', async () => {
      prisma.billingPolicy.findUnique.mockResolvedValue(mockPolicy);

      const result = await service.findOne('policy-uuid-1');

      expect(result).toEqual(mockPolicy);
    });

    it('should throw NotFoundException when policy not found', async () => {
      prisma.billingPolicy.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft policy', async () => {
      prisma.billingPolicy.findUnique.mockResolvedValue(mockPolicy);
      prisma.billingPolicy.update.mockResolvedValue({
        ...mockPolicy,
        cutOffDay: 15,
      });

      const result = await service.update('policy-uuid-1', { cutOffDay: 15 });

      expect(prisma.billingPolicy.update).toHaveBeenCalled();
      expect(result.cutOffDay).toBe(15);
    });

    it('should throw BadRequestException when updating active policy', async () => {
      prisma.billingPolicy.findUnique.mockResolvedValue(mockActivePolicy);

      await expect(
        service.update('policy-uuid-1', { cutOffDay: 15 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should set status=approved with approvedBy and approvedAt', async () => {
      prisma.billingPolicy.findUnique.mockResolvedValue(mockPolicy);
      prisma.billingPolicy.update.mockResolvedValue(mockApprovedPolicy);

      const result = await service.approve('policy-uuid-1', 'user-uuid-1');

      expect(prisma.billingPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PolicyStatus.approved,
            approvedBy: 'user-uuid-1',
          }),
        }),
      );
      expect(result.status).toBe(PolicyStatus.approved);
    });
  });

  describe('activate', () => {
    it('should archive existing active policy and activate new one atomically', async () => {
      prisma.billingPolicy.findUnique.mockResolvedValue(mockApprovedPolicy);
      prisma.billingPolicy.findFirst.mockResolvedValue(mockActivePolicy);

      const activatedPolicy = { ...mockApprovedPolicy, status: PolicyStatus.active };
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        return fn(prisma);
      });
      prisma.billingPolicy.updateMany.mockResolvedValue({ count: 1 });
      prisma.billingPolicy.update.mockResolvedValue(activatedPolicy);

      const result = await service.activate('policy-uuid-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.status).toBe(PolicyStatus.active);
    });
  });
});
