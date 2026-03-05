import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AreasService } from './areas.service';
import { PrismaService } from '../database/prisma.service';
import { AreaType } from '@shared-types/enums';

describe('AreasService', () => {
  let service: AreasService;
  let prisma: {
    area: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const airportId = 'airport-uuid-1';

  const mockTerminal = {
    id: 'terminal-uuid-1',
    airportId,
    parentAreaId: null,
    code: 'DOM',
    name: 'Domestic Terminal',
    areaType: AreaType.terminal,
    areaM2: null,
    isLeasable: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFloor = {
    id: 'floor-uuid-1',
    airportId,
    parentAreaId: 'terminal-uuid-1',
    code: 'DOM-GF',
    name: 'Domestic Terminal Ground Floor',
    areaType: AreaType.floor,
    areaM2: null,
    isLeasable: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockZone = {
    id: 'zone-uuid-1',
    airportId,
    parentAreaId: 'floor-uuid-1',
    code: 'DOM-GF-A',
    name: 'Domestic Terminal Ground Floor Zone A',
    areaType: AreaType.zone,
    areaM2: null,
    isLeasable: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUnit = {
    id: 'unit-uuid-1',
    airportId,
    parentAreaId: 'zone-uuid-1',
    code: 'DOM-GF-A-001',
    name: 'Unit DOM-GF-A-001',
    areaType: AreaType.unit,
    areaM2: 45.5,
    isLeasable: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      area: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AreasService>(AreasService);
  });

  describe('findAll', () => {
    it('should return flat list of areas for an airport', async () => {
      prisma.area.findMany.mockResolvedValue([mockTerminal, mockFloor]);

      const result = await service.findAll(airportId);

      expect(result).toEqual([mockTerminal, mockFloor]);
      expect(prisma.area.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ airportId }) }),
      );
    });

    it('should filter by areaType when provided', async () => {
      prisma.area.findMany.mockResolvedValue([mockUnit]);

      await service.findAll(airportId, { areaType: AreaType.unit });

      expect(prisma.area.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ airportId, areaType: AreaType.unit }),
        }),
      );
    });

    it('should filter by isLeasable when provided', async () => {
      prisma.area.findMany.mockResolvedValue([mockUnit]);

      await service.findAll(airportId, { isLeasable: true });

      expect(prisma.area.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ airportId, isLeasable: true }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return area with parent and children', async () => {
      const areaWithRelations = { ...mockFloor, parent: mockTerminal, children: [] };
      prisma.area.findUnique.mockResolvedValue(areaWithRelations);

      const result = await service.findOne('floor-uuid-1');

      expect(result).toEqual(areaWithRelations);
      expect(prisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: 'floor-uuid-1' },
        include: { parent: true, children: true },
      });
    });

    it('should throw NotFoundException when area not found', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findTree', () => {
    it('should return area with 3-level deep subtree', async () => {
      const treeResult = {
        ...mockTerminal,
        children: [
          {
            ...mockFloor,
            children: [
              {
                ...mockZone,
                children: [mockUnit],
              },
            ],
          },
        ],
      };
      prisma.area.findUnique.mockResolvedValue(treeResult);

      const result = await service.findTree('terminal-uuid-1');

      expect(result).toEqual(treeResult);
      expect(prisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: 'terminal-uuid-1' },
        include: {
          children: {
            include: {
              children: {
                include: { children: true },
              },
            },
          },
        },
      });
    });

    it('should throw NotFoundException when area not found', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(service.findTree('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRoots', () => {
    it('should return top-level areas (parentAreaId = null) with full subtrees', async () => {
      const treeResult = [
        {
          ...mockTerminal,
          children: [
            {
              ...mockFloor,
              children: [{ ...mockZone, children: [mockUnit] }],
            },
          ],
        },
      ];
      prisma.area.findMany.mockResolvedValue(treeResult);

      const result = await service.findRoots(airportId);

      expect(result).toEqual(treeResult);
      expect(prisma.area.findMany).toHaveBeenCalledWith({
        where: { airportId, parentAreaId: null },
        include: {
          children: {
            include: {
              children: {
                include: { children: true },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('should create a root-level terminal area', async () => {
      const dto = {
        airportId,
        code: 'INT',
        name: 'International Terminal',
        areaType: AreaType.terminal,
        isLeasable: false,
      };

      prisma.area.create.mockResolvedValue({ id: 'new-terminal-uuid', ...dto });

      const result = await service.create(dto);

      expect(result).toHaveProperty('id', 'new-terminal-uuid');
      expect(prisma.area.create).toHaveBeenCalledWith({ data: dto });
    });

    it('should create a floor under a terminal', async () => {
      const dto = {
        airportId,
        parentAreaId: 'terminal-uuid-1',
        code: 'DOM-GF',
        name: 'Ground Floor',
        areaType: AreaType.floor,
        isLeasable: false,
      };

      prisma.area.findUnique.mockResolvedValue(mockTerminal);
      prisma.area.create.mockResolvedValue({ id: 'new-floor-uuid', ...dto });

      const result = await service.create(dto);

      expect(result).toHaveProperty('id', 'new-floor-uuid');
    });

    it('should create a unit (depth 4) under a zone', async () => {
      const dto = {
        airportId,
        parentAreaId: 'zone-uuid-1',
        code: 'DOM-GF-A-002',
        name: 'Shop 002',
        areaType: AreaType.unit,
        isLeasable: true,
        areaM2: 55.0,
      };

      prisma.area.findUnique.mockResolvedValue(mockZone);
      prisma.area.create.mockResolvedValue({ id: 'new-unit-uuid', ...dto });

      const result = await service.create(dto);

      expect(result).toHaveProperty('id', 'new-unit-uuid');
    });

    it('should throw BadRequestException when creating area beyond depth 4 (under a unit)', async () => {
      const dto = {
        airportId,
        parentAreaId: 'unit-uuid-1',
        code: 'DEEP-001',
        name: 'Too Deep',
        areaType: AreaType.unit,
        isLeasable: true,
      };

      // Unit is at depth 4 — adding a child would be depth 5
      prisma.area.findUnique.mockResolvedValue(mockUnit);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow('Maximum area depth of 4 exceeded');
    });

    it('should throw BadRequestException when areaType does not match depth (floor at root)', async () => {
      const dto = {
        airportId,
        code: 'BAD-FLOOR',
        name: 'Floor at root',
        areaType: AreaType.floor,
        isLeasable: false,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when areaType does not match depth (terminal under terminal)', async () => {
      const dto = {
        airportId,
        parentAreaId: 'terminal-uuid-1',
        code: 'NESTED-TERMINAL',
        name: 'Nested Terminal',
        areaType: AreaType.terminal,
        isLeasable: false,
      };

      prisma.area.findUnique.mockResolvedValue(mockTerminal);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update an area (name, areaM2, isActive)', async () => {
      const dto = { name: 'Updated Name', isActive: false };
      const updatedArea = { ...mockUnit, name: 'Updated Name', isActive: false };

      prisma.area.findUnique.mockResolvedValue(mockUnit);
      prisma.area.update.mockResolvedValue(updatedArea);

      const result = await service.update('unit-uuid-1', dto);

      expect(result).toEqual(updatedArea);
      expect(prisma.area.update).toHaveBeenCalledWith({
        where: { id: 'unit-uuid-1' },
        data: dto,
      });
    });

    it('should throw NotFoundException when updating non-existent area', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', {})).rejects.toThrow(NotFoundException);
    });
  });
});
