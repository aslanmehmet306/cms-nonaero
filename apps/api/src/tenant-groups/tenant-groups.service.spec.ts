import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantGroupsService } from './tenant-groups.service';
import { PrismaService } from '../database/prisma.service';

describe('TenantGroupsService', () => {
  let service: TenantGroupsService;
  let prisma: {
    tenantGroup: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  const mockGroup = {
    id: 'group-uuid-1',
    airportId: 'airport-uuid-1',
    code: 'GRP-001',
    name: 'Retail Holdings Group',
    parentGroupId: null,
    taxId: 'TR-9876543210',
    contactEmail: 'group@holdingco.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      tenantGroup: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGroupsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TenantGroupsService>(TenantGroupsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Code Generation ───────────────────────────────────────────────

  describe('generateNextGroupCode', () => {
    it('should return GRP-001 when no existing groups', async () => {
      prisma.tenantGroup.findFirst.mockResolvedValue(null);

      const code = await service.generateNextGroupCode('airport-uuid-1');
      expect(code).toBe('GRP-001');
    });

    it('should return GRP-004 when last group has code GRP-003', async () => {
      prisma.tenantGroup.findFirst.mockResolvedValue({ code: 'GRP-003' });

      const code = await service.generateNextGroupCode('airport-uuid-1');
      expect(code).toBe('GRP-004');
    });

    it('should pad numbers to 3 digits', async () => {
      prisma.tenantGroup.findFirst.mockResolvedValue({ code: 'GRP-009' });

      const code = await service.generateNextGroupCode('airport-uuid-1');
      expect(code).toBe('GRP-010');
    });
  });

  // ─── Create ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create group with generated code', async () => {
      prisma.tenantGroup.findFirst.mockResolvedValue(null);
      prisma.tenantGroup.create.mockResolvedValue(mockGroup);

      const dto = {
        airportId: 'airport-uuid-1',
        name: 'Retail Holdings Group',
        taxId: 'TR-9876543210',
        contactEmail: 'group@holdingco.com',
      };

      const result = await service.create(dto);

      expect(prisma.tenantGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'GRP-001',
            name: dto.name,
          }),
        }),
      );
      expect(result).toEqual(mockGroup);
    });

    it('should validate parent group exists when parentGroupId provided', async () => {
      prisma.tenantGroup.findFirst.mockResolvedValue(null);
      prisma.tenantGroup.findUnique.mockResolvedValue(null);

      const dto = {
        airportId: 'airport-uuid-1',
        name: 'Child Group',
        parentGroupId: 'non-existent-parent',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should reject parent group from different airport', async () => {
      prisma.tenantGroup.findFirst.mockResolvedValue(null);
      prisma.tenantGroup.findUnique.mockResolvedValue({
        airportId: 'other-airport-uuid',
      });

      const dto = {
        airportId: 'airport-uuid-1',
        name: 'Child Group',
        parentGroupId: 'parent-uuid-other-airport',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should accept valid parent group from same airport', async () => {
      prisma.tenantGroup.findFirst.mockResolvedValue(null);
      prisma.tenantGroup.findUnique.mockResolvedValue({
        airportId: 'airport-uuid-1',
      });
      prisma.tenantGroup.create.mockResolvedValue({
        ...mockGroup,
        id: 'group-uuid-2',
        code: 'GRP-001',
        parentGroupId: 'parent-uuid-1',
      });

      const dto = {
        airportId: 'airport-uuid-1',
        name: 'Child Group',
        parentGroupId: 'parent-uuid-1',
      };

      const result = await service.create(dto);
      expect(result.parentGroupId).toBe('parent-uuid-1');
    });
  });

  // ─── FindAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated groups', async () => {
      prisma.tenantGroup.findMany.mockResolvedValue([mockGroup]);
      prisma.tenantGroup.count.mockResolvedValue(1);

      const result = await service.findAll('airport-uuid-1');

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should filter by airportId', async () => {
      prisma.tenantGroup.findMany.mockResolvedValue([mockGroup]);
      prisma.tenantGroup.count.mockResolvedValue(1);

      await service.findAll('airport-uuid-1');

      expect(prisma.tenantGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ airportId: 'airport-uuid-1' }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      prisma.tenantGroup.findMany.mockResolvedValue([]);
      prisma.tenantGroup.count.mockResolvedValue(0);

      await service.findAll(undefined, false);

      expect(prisma.tenantGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.tenantGroup.findMany.mockResolvedValue([mockGroup]);
      prisma.tenantGroup.count.mockResolvedValue(25);

      const result = await service.findAll(undefined, undefined, 2, 10);

      expect(prisma.tenantGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ─── FindOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return group with relations', async () => {
      prisma.tenantGroup.findUnique.mockResolvedValue({
        ...mockGroup,
        airport: {},
        parentGroup: null,
        childGroups: [],
        tenants: [],
      });

      const result = await service.findOne('group-uuid-1');
      expect(result.code).toBe('GRP-001');
    });

    it('should throw NotFoundException for non-existent group', async () => {
      prisma.tenantGroup.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Update ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update group fields', async () => {
      prisma.tenantGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.tenantGroup.update.mockResolvedValue({
        ...mockGroup,
        name: 'Updated Group',
      });

      const result = await service.update('group-uuid-1', {
        name: 'Updated Group',
      });

      expect(prisma.tenantGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'group-uuid-1' },
          data: expect.objectContaining({ name: 'Updated Group' }),
        }),
      );
      expect(result.name).toBe('Updated Group');
    });

    it('should throw NotFoundException when group not found', async () => {
      prisma.tenantGroup.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject self-referential parent', async () => {
      prisma.tenantGroup.findUnique.mockResolvedValue(mockGroup);

      await expect(
        service.update('group-uuid-1', { parentGroupId: 'group-uuid-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect circular hierarchy on update', async () => {
      // Group A → B → C, trying to set C's parent to A would be circular
      const groupC = { ...mockGroup, id: 'group-c', parentGroupId: 'group-b' };

      // First findUnique: group to update
      prisma.tenantGroup.findUnique
        .mockResolvedValueOnce(groupC) // find groupC
        .mockResolvedValueOnce({ airportId: 'airport-uuid-1' }) // validate parent (group-a) exists
        .mockResolvedValueOnce({ parentGroupId: 'group-b' }) // walk: group-a.parent = group-b
        .mockResolvedValueOnce({ parentGroupId: 'group-c' }) // walk: group-b.parent = group-c → CIRCULAR!
      ;

      await expect(
        service.update('group-c', { parentGroupId: 'group-a' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should toggle isActive', async () => {
      prisma.tenantGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.tenantGroup.update.mockResolvedValue({
        ...mockGroup,
        isActive: false,
      });

      const result = await service.update('group-uuid-1', { isActive: false });
      expect(result.isActive).toBe(false);
    });
  });

  // ─── Hierarchy ──────────────────────────────────────────────────────

  describe('getHierarchy', () => {
    it('should return group with nested hierarchy', async () => {
      prisma.tenantGroup.findUnique.mockResolvedValue({
        ...mockGroup,
        parentGroup: null,
        childGroups: [
          {
            id: 'child-1',
            code: 'GRP-002',
            name: 'Child Group',
            childGroups: [],
          },
        ],
        tenants: [{ id: 'tenant-1', code: 'TNT-001', name: 'Test Tenant', status: 'active' }],
      });

      const result = await service.getHierarchy('group-uuid-1');

      expect(result.childGroups).toHaveLength(1);
      expect(result.tenants).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent group', async () => {
      prisma.tenantGroup.findUnique.mockResolvedValue(null);

      await expect(service.getHierarchy('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
