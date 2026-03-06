import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AreaAllocationsService } from './area-allocations.service';
import { PrismaService } from '../database/prisma.service';
import { AllocationMethod, AllocationStatus } from '@shared-types/enums';

describe('AreaAllocationsService', () => {
  let service: AreaAllocationsService;
  let prisma: {
    areaAllocation: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    areaAllocationShare: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    area: {
      findUnique: jest.Mock;
    };
  };

  const mockAllocation = {
    id: 'alloc-uuid-1',
    airportId: 'airport-uuid-1',
    areaId: 'area-uuid-1',
    allocationMethod: AllocationMethod.proportional_m2,
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-12-31'),
    totalCost: '50000.00',
    currency: 'TRY',
    status: AllocationStatus.draft,
    approvedBy: null,
    approvedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    area: { id: 'area-uuid-1', name: 'Terminal A Common' },
    shares: [],
  };

  const mockShare = {
    id: 'share-uuid-1',
    allocationId: 'alloc-uuid-1',
    tenantId: 'tenant-uuid-1',
    contractId: null,
    shareRatio: '0.60000000',
    fixedAmount: null,
    calculatedAmount: null,
    createdAt: new Date(),
    tenant: { id: 'tenant-uuid-1', name: 'Tenant A' },
  };

  beforeEach(async () => {
    prisma = {
      areaAllocation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      areaAllocationShare: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      area: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreaAllocationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AreaAllocationsService>(AreaAllocationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Create ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an allocation in draft status', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 'area-uuid-1', name: 'Terminal A Common' });
      prisma.areaAllocation.create.mockResolvedValue(mockAllocation);

      const dto = {
        airportId: 'airport-uuid-1',
        areaId: 'area-uuid-1',
        allocationMethod: AllocationMethod.proportional_m2,
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        totalCost: '50000.00',
      };

      const result = await service.create(dto);

      expect(prisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: 'area-uuid-1' },
      });
      expect(prisma.areaAllocation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            airportId: 'airport-uuid-1',
            areaId: 'area-uuid-1',
            status: AllocationStatus.draft,
          }),
        }),
      );
      expect(result).toEqual(mockAllocation);
    });

    it('should throw NotFoundException when area not found', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      const dto = {
        airportId: 'airport-uuid-1',
        areaId: 'non-existent-area',
        allocationMethod: AllocationMethod.proportional_m2,
        periodStart: '2025-01-01',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── FindAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated allocations', async () => {
      prisma.areaAllocation.findMany.mockResolvedValue([mockAllocation]);
      prisma.areaAllocation.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should apply filters', async () => {
      prisma.areaAllocation.findMany.mockResolvedValue([]);
      prisma.areaAllocation.count.mockResolvedValue(0);

      await service.findAll({
        airportId: 'airport-uuid-1',
        areaId: 'area-uuid-1',
        status: AllocationStatus.draft,
      });

      expect(prisma.areaAllocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            airportId: 'airport-uuid-1',
            areaId: 'area-uuid-1',
            status: AllocationStatus.draft,
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.areaAllocation.findMany.mockResolvedValue([mockAllocation]);
      prisma.areaAllocation.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(prisma.areaAllocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ─── FindOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return allocation with relations', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(mockAllocation);

      const result = await service.findOne('alloc-uuid-1');

      expect(result.id).toBe('alloc-uuid-1');
      expect(prisma.areaAllocation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alloc-uuid-1' },
          include: expect.objectContaining({
            area: true,
            shares: expect.objectContaining({
              include: { tenant: true },
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Update ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update a draft allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(mockAllocation);
      prisma.areaAllocation.update.mockResolvedValue({
        ...mockAllocation,
        totalCost: '75000.00',
      });

      const result = await service.update('alloc-uuid-1', {
        totalCost: '75000.00',
      });

      expect(prisma.areaAllocation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alloc-uuid-1' },
          data: expect.objectContaining({ totalCost: '75000.00' }),
        }),
      );
      expect(result.totalCost).toBe('75000.00');
    });

    it('should reject update on non-draft allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.approved_alloc,
      });

      await expect(
        service.update('alloc-uuid-1', { totalCost: '75000.00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when allocation not found', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { totalCost: '75000.00' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Transition ─────────────────────────────────────────────────────

  describe('transition', () => {
    it('should transition draft -> approved_alloc with valid share sum', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(mockAllocation);
      prisma.areaAllocationShare.findMany.mockResolvedValue([
        { shareRatio: '0.60000000' },
        { shareRatio: '0.40000000' },
      ]);
      prisma.areaAllocation.update.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.approved_alloc,
      });

      const result = await service.transition(
        'alloc-uuid-1',
        AllocationStatus.approved_alloc,
      );

      expect(result.status).toBe(AllocationStatus.approved_alloc);
      expect(prisma.areaAllocation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AllocationStatus.approved_alloc,
            approvedBy: 'system',
            approvedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should reject draft -> approved_alloc with invalid share sum', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(mockAllocation);
      prisma.areaAllocationShare.findMany.mockResolvedValue([
        { shareRatio: '0.60000000' },
        { shareRatio: '0.30000000' },
      ]);

      await expect(
        service.transition('alloc-uuid-1', AllocationStatus.approved_alloc),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition approved_alloc -> active_alloc', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.approved_alloc,
      });
      prisma.areaAllocation.update.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.active_alloc,
      });

      const result = await service.transition(
        'alloc-uuid-1',
        AllocationStatus.active_alloc,
      );

      expect(result.status).toBe(AllocationStatus.active_alloc);
    });

    it('should transition approved_alloc -> draft', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.approved_alloc,
      });
      prisma.areaAllocation.update.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.draft,
      });

      const result = await service.transition(
        'alloc-uuid-1',
        AllocationStatus.draft,
      );

      expect(result.status).toBe(AllocationStatus.draft);
    });

    it('should transition active_alloc -> archived_alloc', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.active_alloc,
      });
      prisma.areaAllocation.update.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.archived_alloc,
      });

      const result = await service.transition(
        'alloc-uuid-1',
        AllocationStatus.archived_alloc,
      );

      expect(result.status).toBe(AllocationStatus.archived_alloc);
    });

    it('should reject invalid state transition', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(mockAllocation);

      await expect(
        service.transition('alloc-uuid-1', AllocationStatus.active_alloc),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(null);

      await expect(
        service.transition('non-existent-id', AllocationStatus.approved_alloc),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Shares ─────────────────────────────────────────────────────────

  describe('upsertShare', () => {
    it('should upsert a share on a draft allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(mockAllocation);
      prisma.areaAllocationShare.upsert.mockResolvedValue(mockShare);

      const dto = {
        tenantId: 'tenant-uuid-1',
        shareRatio: '0.60000000',
      };

      const result = await service.upsertShare('alloc-uuid-1', dto);

      expect(prisma.areaAllocationShare.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            allocationId_tenantId: {
              allocationId: 'alloc-uuid-1',
              tenantId: 'tenant-uuid-1',
            },
          },
          create: expect.objectContaining({
            allocationId: 'alloc-uuid-1',
            tenantId: 'tenant-uuid-1',
            shareRatio: '0.60000000',
          }),
          update: expect.objectContaining({
            shareRatio: '0.60000000',
          }),
        }),
      );
      expect(result).toEqual(mockShare);
    });

    it('should reject upsert on non-draft allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.approved_alloc,
      });

      await expect(
        service.upsertShare('alloc-uuid-1', {
          tenantId: 'tenant-uuid-1',
          shareRatio: '0.60000000',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listShares', () => {
    it('should list all shares with tenant info', async () => {
      prisma.areaAllocationShare.findMany.mockResolvedValue([mockShare]);

      const result = await service.listShares('alloc-uuid-1');

      expect(result).toHaveLength(1);
      expect(prisma.areaAllocationShare.findMany).toHaveBeenCalledWith({
        where: { allocationId: 'alloc-uuid-1' },
        include: { tenant: true },
      });
    });
  });

  describe('removeShare', () => {
    it('should remove a share from a draft allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(mockAllocation);
      prisma.areaAllocationShare.delete.mockResolvedValue(mockShare);

      const result = await service.removeShare('alloc-uuid-1', 'tenant-uuid-1');

      expect(prisma.areaAllocationShare.delete).toHaveBeenCalledWith({
        where: {
          allocationId_tenantId: {
            allocationId: 'alloc-uuid-1',
            tenantId: 'tenant-uuid-1',
          },
        },
      });
      expect(result).toEqual(mockShare);
    });

    it('should reject removal on non-draft allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue({
        ...mockAllocation,
        status: AllocationStatus.active_alloc,
      });

      await expect(
        service.removeShare('alloc-uuid-1', 'tenant-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Calculate Shares ───────────────────────────────────────────────

  describe('calculateShares', () => {
    it('should calculate amounts for approved allocation', async () => {
      const approvedAllocation = {
        ...mockAllocation,
        status: AllocationStatus.approved_alloc,
        totalCost: '50000.00',
      };
      prisma.areaAllocation.findUnique.mockResolvedValue(approvedAllocation);
      prisma.areaAllocationShare.findMany
        .mockResolvedValueOnce([
          { id: 'share-1', shareRatio: '0.60000000' },
          { id: 'share-2', shareRatio: '0.40000000' },
        ])
        .mockResolvedValueOnce([
          { ...mockShare, calculatedAmount: '30000.00' },
          { ...mockShare, id: 'share-2', tenantId: 'tenant-uuid-2', calculatedAmount: '20000.00' },
        ]);
      prisma.areaAllocationShare.update.mockResolvedValue({});

      const result = await service.calculateShares('alloc-uuid-1');

      expect(prisma.areaAllocationShare.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'share-1' },
          data: { calculatedAmount: '30000.00' },
        }),
      );
      expect(prisma.areaAllocationShare.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'share-2' },
          data: { calculatedAmount: '20000.00' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('should reject calculation on non-approved/active allocation', async () => {
      prisma.areaAllocation.findUnique.mockResolvedValue(mockAllocation);

      await expect(
        service.calculateShares('alloc-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
