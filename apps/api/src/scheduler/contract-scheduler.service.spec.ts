import { Test, TestingModule } from '@nestjs/testing';
import { ContractSchedulerService } from './contract-scheduler.service';
import { PrismaService } from '../database/prisma.service';
import { ContractStatus } from '@shared-types/enums';

describe('ContractSchedulerService', () => {
  let service: ContractSchedulerService;
  let prisma: {
    contract: {
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  // Helper to create a date relative to today
  const daysFromToday = (days: number): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d;
  };

  const today = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const mockPublishedContract = {
    id: 'contract-uuid-1',
    contractNumber: 'CNT-001',
    version: 1,
    status: ContractStatus.published,
    signedAt: new Date('2026-01-15'),
    effectiveFrom: daysFromToday(-1), // yesterday — should activate
    previousVersionId: null,
  };

  const mockPublishedContractFuture = {
    id: 'contract-uuid-2',
    contractNumber: 'CNT-002',
    version: 1,
    status: ContractStatus.published,
    signedAt: new Date('2026-01-15'),
    effectiveFrom: daysFromToday(5), // future — should NOT activate
    previousVersionId: null,
  };

  const mockPublishedContractUnsigned = {
    id: 'contract-uuid-3',
    contractNumber: 'CNT-003',
    version: 1,
    status: ContractStatus.published,
    signedAt: null, // unsigned — should NOT activate
    effectiveFrom: daysFromToday(-1),
    previousVersionId: null,
  };

  const mockPendingAmendment = {
    id: 'amendment-uuid-1',
    contractNumber: 'CNT-001',
    version: 2,
    status: ContractStatus.pending_amendment,
    effectiveFrom: daysFromToday(-1), // yesterday — should flip
    previousVersionId: 'contract-uuid-1',
  };

  const mockPendingAmendmentFuture = {
    id: 'amendment-uuid-2',
    contractNumber: 'CNT-001',
    version: 3,
    status: ContractStatus.pending_amendment,
    effectiveFrom: daysFromToday(10), // future — should NOT flip
    previousVersionId: 'contract-uuid-1',
  };

  beforeEach(async () => {
    prisma = {
      contract: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractSchedulerService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ContractSchedulerService>(ContractSchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('activatePublishedContracts', () => {
    it('should activate published contracts with signedAt set and effectiveFrom <= today', async () => {
      prisma.contract.findMany.mockResolvedValue([mockPublishedContract]);
      prisma.contract.update.mockResolvedValue({
        ...mockPublishedContract,
        status: ContractStatus.active,
      });

      const result = await service.activatePublishedContracts();

      expect(prisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ContractStatus.published,
            signedAt: { not: null },
            effectiveFrom: { lte: expect.any(Date) },
          }),
        }),
      );
      expect(prisma.contract.update).toHaveBeenCalledWith({
        where: { id: mockPublishedContract.id },
        data: { status: ContractStatus.active },
      });
      expect(result).toBe(1);
    });

    it('should ignore published contracts with effectiveFrom in the future', async () => {
      prisma.contract.findMany.mockResolvedValue([]);
      // Simulate that the query returned nothing (future contracts filtered by DB)

      const result = await service.activatePublishedContracts();

      expect(prisma.contract.update).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should ignore published contracts with signedAt = null', async () => {
      prisma.contract.findMany.mockResolvedValue([]);
      // signedAt: null contracts are filtered by the query (signedAt: { not: null })

      const result = await service.activatePublishedContracts();

      expect(prisma.contract.update).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should return count of activated contracts', async () => {
      const contracts = [mockPublishedContract, { ...mockPublishedContract, id: 'contract-uuid-4' }];
      prisma.contract.findMany.mockResolvedValue(contracts);
      prisma.contract.update.mockResolvedValue({ status: ContractStatus.active });

      const result = await service.activatePublishedContracts();

      expect(result).toBe(2);
      expect(prisma.contract.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('flipAmendments', () => {
    it('should flip pending_amendment contracts with effectiveFrom <= today atomically', async () => {
      prisma.contract.findMany.mockResolvedValue([mockPendingAmendment]);
      prisma.$transaction.mockResolvedValue([
        { ...{ id: 'contract-uuid-1' }, status: ContractStatus.amended },
        { ...mockPendingAmendment, status: ContractStatus.active },
      ]);

      const result = await service.flipAmendments();

      expect(prisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ContractStatus.pending_amendment,
            effectiveFrom: { lte: expect.any(Date) },
          }),
        }),
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toBe(1);
    });

    it('should use $transaction for atomic status swap', async () => {
      prisma.contract.findMany.mockResolvedValue([mockPendingAmendment]);
      // Return promise mocks so $transaction receives actual Promise objects
      prisma.contract.update.mockResolvedValue({ status: ContractStatus.amended });
      prisma.$transaction.mockResolvedValue([
        { status: ContractStatus.amended },
        { status: ContractStatus.active },
      ]);

      await service.flipAmendments();

      // $transaction should be called with an array of two update operations (Promises)
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(Object),
          expect.any(Object),
        ]),
      );
    });

    it('should ignore pending_amendment contracts with future effectiveFrom', async () => {
      prisma.contract.findMany.mockResolvedValue([]);
      // Future amendments are filtered by the DB query

      const result = await service.flipAmendments();

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should skip amendments with no previousVersionId', async () => {
      const amendmentWithoutPrev = { ...mockPendingAmendment, previousVersionId: null };
      prisma.contract.findMany.mockResolvedValue([amendmentWithoutPrev]);

      const result = await service.flipAmendments();

      expect(prisma.$transaction).not.toHaveBeenCalled();
      // Returns count of pendingAmendments found, even if skipped
      expect(result).toBe(1);
    });
  });

  describe('handleContractLifecycle', () => {
    it('should run both activation and amendment flip in sequence', async () => {
      const activateSpy = jest.spyOn(service, 'activatePublishedContracts').mockResolvedValue(2);
      const flipSpy = jest.spyOn(service, 'flipAmendments').mockResolvedValue(1);

      await service.handleContractLifecycle();

      expect(activateSpy).toHaveBeenCalledTimes(1);
      expect(flipSpy).toHaveBeenCalledTimes(1);
      // Activation runs before flip
      const activateOrder = activateSpy.mock.invocationCallOrder[0];
      const flipOrder = flipSpy.mock.invocationCallOrder[0];
      expect(activateOrder).toBeLessThan(flipOrder);
    });
  });
});
