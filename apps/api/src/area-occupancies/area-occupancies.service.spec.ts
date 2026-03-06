import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AreaOccupanciesService } from './area-occupancies.service';
import { PrismaService } from '../database/prisma.service';
import { OccupancyStatus, OccupancyType } from '@shared-types/enums';

describe('AreaOccupanciesService', () => {
  let service: AreaOccupanciesService;
  let prisma: {
    areaOccupancy: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    area: {
      findUnique: jest.Mock;
    };
  };

  const mockOccupancy = {
    id: 'occ-uuid-1',
    areaId: 'area-uuid-1',
    tenantId: 'tenant-uuid-1',
    contractId: null,
    occupancyType: OccupancyType.exclusive,
    status: OccupancyStatus.planned,
    occupiedFrom: new Date('2025-01-01'),
    occupiedTo: new Date('2025-12-31'),
    occupiedM2: 100,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockArea = {
    id: 'area-uuid-1',
    areaM2: 200,
  };

  beforeEach(async () => {
    prisma = {
      areaOccupancy: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      area: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreaOccupanciesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AreaOccupanciesService>(AreaOccupanciesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Create ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an area occupancy in planned state', async () => {
      prisma.area.findUnique.mockResolvedValue(mockArea);
      prisma.areaOccupancy.findFirst.mockResolvedValue(null);
      prisma.areaOccupancy.create.mockResolvedValue(mockOccupancy);

      const dto = {
        areaId: 'area-uuid-1',
        tenantId: 'tenant-uuid-1',
        occupancyType: OccupancyType.exclusive,
        occupiedFrom: '2025-01-01',
        occupiedTo: '2025-12-31',
        occupiedM2: '100',
      };

      const result = await service.create(dto);

      expect(prisma.areaOccupancy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            areaId: 'area-uuid-1',
            status: OccupancyStatus.planned,
          }),
        }),
      );
      expect(result).toEqual(mockOccupancy);
    });

    it('should throw NotFoundException when area does not exist', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      const dto = {
        areaId: 'non-existent-area',
        occupancyType: OccupancyType.exclusive,
        occupiedFrom: '2025-01-01',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should reject exclusive occupancy when overlapping exclusive exists', async () => {
      prisma.area.findUnique.mockResolvedValue(mockArea);
      prisma.areaOccupancy.findFirst.mockResolvedValue(mockOccupancy); // overlap found

      const dto = {
        areaId: 'area-uuid-1',
        occupancyType: OccupancyType.exclusive,
        occupiedFrom: '2025-06-01',
        occupiedTo: '2025-08-31',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject when occupiedM2 exceeds area total', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 'area-uuid-1', areaM2: 50 });

      const dto = {
        areaId: 'area-uuid-1',
        occupancyType: OccupancyType.exclusive,
        occupiedFrom: '2025-01-01',
        occupiedM2: '100',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject shared occupancy when total m2 exceeds area', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 'area-uuid-1', areaM2: 100 });
      prisma.areaOccupancy.findFirst.mockResolvedValue(null);
      prisma.areaOccupancy.findMany.mockResolvedValue([
        { occupiedM2: 60 },
        { occupiedM2: 20 },
      ]);

      const dto = {
        areaId: 'area-uuid-1',
        occupancyType: OccupancyType.shared,
        occupiedFrom: '2025-01-01',
        occupiedTo: '2025-12-31',
        occupiedM2: '30',
      };

      // existing = 60 + 20 = 80, new = 30, total = 110 > 100
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should allow shared occupancy when total m2 is within area limit', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 'area-uuid-1', areaM2: 100 });
      prisma.areaOccupancy.findFirst.mockResolvedValue(null);
      prisma.areaOccupancy.findMany.mockResolvedValue([
        { occupiedM2: 40 },
        { occupiedM2: 20 },
      ]);
      prisma.areaOccupancy.create.mockResolvedValue({
        ...mockOccupancy,
        occupancyType: OccupancyType.shared,
        occupiedM2: 30,
      });

      const dto = {
        areaId: 'area-uuid-1',
        occupancyType: OccupancyType.shared,
        occupiedFrom: '2025-01-01',
        occupiedTo: '2025-12-31',
        occupiedM2: '30',
      };

      // existing = 40 + 20 = 60, new = 30, total = 90 <= 100
      const result = await service.create(dto);
      expect(result.occupancyType).toBe(OccupancyType.shared);
    });
  });

  // ─── FindAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated area occupancies', async () => {
      prisma.areaOccupancy.findMany.mockResolvedValue([mockOccupancy]);
      prisma.areaOccupancy.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should handle pagination correctly', async () => {
      prisma.areaOccupancy.findMany.mockResolvedValue([mockOccupancy]);
      prisma.areaOccupancy.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(prisma.areaOccupancy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.totalPages).toBe(3);
    });

    it('should filter by areaId and status', async () => {
      prisma.areaOccupancy.findMany.mockResolvedValue([]);
      prisma.areaOccupancy.count.mockResolvedValue(0);

      await service.findAll({
        areaId: 'area-uuid-1',
        status: OccupancyStatus.occupied,
      });

      expect(prisma.areaOccupancy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            areaId: 'area-uuid-1',
            status: OccupancyStatus.occupied,
          }),
        }),
      );
    });
  });

  // ─── FindOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return occupancy with relations', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue({
        ...mockOccupancy,
        area: {},
        tenant: {},
        contract: null,
      });

      const result = await service.findOne('occ-uuid-1');

      expect(result.id).toBe('occ-uuid-1');
      expect(prisma.areaOccupancy.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'occ-uuid-1' },
          include: { area: true, tenant: true, contract: true },
        }),
      );
    });

    it('should throw NotFoundException for non-existent occupancy', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Update ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update occupancy fields', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue(mockOccupancy);
      prisma.areaOccupancy.update.mockResolvedValue({
        ...mockOccupancy,
        notes: 'Updated notes',
      });

      const result = await service.update('occ-uuid-1', {
        notes: 'Updated notes',
      });

      expect(prisma.areaOccupancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'occ-uuid-1' },
          data: expect.objectContaining({ notes: 'Updated notes' }),
        }),
      );
      expect(result.notes).toBe('Updated notes');
    });

    it('should throw NotFoundException when occupancy not found', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { notes: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── State Transitions ─────────────────────────────────────────────

  describe('transition', () => {
    it('should transition planned -> occupied', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue({
        ...mockOccupancy,
        status: OccupancyStatus.planned,
        area: {},
        tenant: {},
        contract: null,
      });
      prisma.areaOccupancy.update.mockResolvedValue({
        ...mockOccupancy,
        status: OccupancyStatus.occupied,
      });

      const result = await service.transition(
        'occ-uuid-1',
        OccupancyStatus.occupied,
      );

      expect(prisma.areaOccupancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OccupancyStatus.occupied,
          }),
        }),
      );
      expect(result.status).toBe(OccupancyStatus.occupied);
    });

    it('should transition occupied -> vacated and set occupiedTo', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue({
        ...mockOccupancy,
        status: OccupancyStatus.occupied,
        occupiedTo: null,
        area: {},
        tenant: {},
        contract: null,
      });
      prisma.areaOccupancy.update.mockResolvedValue({
        ...mockOccupancy,
        status: OccupancyStatus.vacated,
        occupiedTo: new Date(),
      });

      const result = await service.transition(
        'occ-uuid-1',
        OccupancyStatus.vacated,
      );

      expect(prisma.areaOccupancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OccupancyStatus.vacated,
            occupiedTo: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe(OccupancyStatus.vacated);
    });

    it('should transition under_renovation -> occupied', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue({
        ...mockOccupancy,
        status: OccupancyStatus.under_renovation,
        area: {},
        tenant: {},
        contract: null,
      });
      prisma.areaOccupancy.update.mockResolvedValue({
        ...mockOccupancy,
        status: OccupancyStatus.occupied,
      });

      const result = await service.transition(
        'occ-uuid-1',
        OccupancyStatus.occupied,
      );

      expect(result.status).toBe(OccupancyStatus.occupied);
    });

    it('should reject invalid transition vacated -> planned', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue({
        ...mockOccupancy,
        status: OccupancyStatus.vacated,
        area: {},
        tenant: {},
        contract: null,
      });

      await expect(
        service.transition('occ-uuid-1', OccupancyStatus.planned),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent occupancy', async () => {
      prisma.areaOccupancy.findUnique.mockResolvedValue(null);

      await expect(
        service.transition('non-existent-id', OccupancyStatus.occupied),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Overlap Detection ─────────────────────────────────────────────

  describe('overlap detection', () => {
    it('should reject exclusive occupancy when overlap exists', async () => {
      prisma.area.findUnique.mockResolvedValue(mockArea);
      prisma.areaOccupancy.findFirst.mockResolvedValue({
        id: 'existing-occ',
        occupancyType: OccupancyType.exclusive,
        occupiedFrom: new Date('2025-01-01'),
        occupiedTo: new Date('2025-06-30'),
      });

      const dto = {
        areaId: 'area-uuid-1',
        occupancyType: OccupancyType.exclusive,
        occupiedFrom: '2025-03-01',
        occupiedTo: '2025-09-30',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should allow exclusive occupancy when no overlap exists', async () => {
      prisma.area.findUnique.mockResolvedValue(mockArea);
      prisma.areaOccupancy.findFirst.mockResolvedValue(null);
      prisma.areaOccupancy.create.mockResolvedValue({
        ...mockOccupancy,
        occupiedFrom: new Date('2026-01-01'),
        occupiedTo: new Date('2026-12-31'),
      });

      const dto = {
        areaId: 'area-uuid-1',
        occupancyType: OccupancyType.exclusive,
        occupiedFrom: '2026-01-01',
        occupiedTo: '2026-12-31',
      };

      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(prisma.areaOccupancy.create).toHaveBeenCalled();
    });
  });
});
