import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ContractAreasService } from './contract-areas.service';
import { PrismaService } from '../database/prisma.service';
import { ContractStatus } from '@shared-types/enums';

describe('ContractAreasService', () => {
  let service: ContractAreasService;
  let prisma: {
    contract: { findUnique: jest.Mock };
    area: { findUnique: jest.Mock };
    contractArea: {
      create: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockDraftContract = {
    id: 'contract-uuid-1',
    contractNumber: 'CNT-001',
    status: ContractStatus.draft,
    tenantId: 'tenant-uuid-1',
    airportId: 'airport-uuid-1',
    version: 1,
  };

  const mockActiveContract = {
    ...mockDraftContract,
    id: 'contract-uuid-2',
    status: ContractStatus.active,
  };

  const mockArea = {
    id: 'area-uuid-1',
    code: 'GATE-1',
    name: 'Gate 1',
    airportId: 'airport-uuid-1',
  };

  const mockContractArea = {
    id: 'contract-area-uuid-1',
    contractId: 'contract-uuid-1',
    areaId: 'area-uuid-1',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    area: mockArea,
  };

  beforeEach(async () => {
    prisma = {
      contract: { findUnique: jest.fn() },
      area: { findUnique: jest.fn() },
      contractArea: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractAreasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ContractAreasService>(ContractAreasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignArea', () => {
    it('should create ContractArea row with contractId, areaId, effectiveFrom', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.area.findUnique.mockResolvedValue(mockArea);
      prisma.contractArea.create.mockResolvedValue(mockContractArea);

      const dto = { areaId: 'area-uuid-1', effectiveFrom: '2026-01-01' };
      const result = await service.assignArea('contract-uuid-1', dto);

      expect(prisma.contract.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'contract-uuid-1' } }),
      );
      expect(prisma.area.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'area-uuid-1' } }),
      );
      expect(prisma.contractArea.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractId: 'contract-uuid-1',
            areaId: 'area-uuid-1',
          }),
        }),
      );
      expect(result).toEqual(mockContractArea);
    });

    it('should throw NotFoundException if contract does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.assignArea('non-existent-contract', { areaId: 'area-uuid-1', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractArea.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if area does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(
        service.assignArea('contract-uuid-1', { areaId: 'non-existent-area', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractArea.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on non-draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.assignArea('contract-uuid-2', { areaId: 'area-uuid-1', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractArea.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with message "Areas can only be assigned to draft contracts"', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.assignArea('contract-uuid-2', { areaId: 'area-uuid-1', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow('Areas can only be assigned to draft contracts');
    });

    it('should throw ConflictException on duplicate area assignment (Prisma P2002)', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.area.findUnique.mockResolvedValue(mockArea);
      const prismaError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      prisma.contractArea.create.mockRejectedValue(prismaError);

      await expect(
        service.assignArea('contract-uuid-1', { areaId: 'area-uuid-1', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeArea', () => {
    it('should delete the junction row', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.contractArea.delete.mockResolvedValue(mockContractArea);

      await service.removeArea('contract-uuid-1', 'area-uuid-1');

      expect(prisma.contractArea.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            contractId_areaId: {
              contractId: 'contract-uuid-1',
              areaId: 'area-uuid-1',
            },
          },
        }),
      );
    });

    it('should throw BadRequestException on non-draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.removeArea('contract-uuid-2', 'area-uuid-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractArea.delete).not.toHaveBeenCalled();
    });
  });

  describe('listAreas', () => {
    it('should return all areas for a contract with area details included', async () => {
      prisma.contractArea.findMany.mockResolvedValue([mockContractArea]);

      const result = await service.listAreas('contract-uuid-1');

      expect(prisma.contractArea.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId: 'contract-uuid-1' },
          include: { area: true },
        }),
      );
      expect(result).toEqual([mockContractArea]);
    });
  });
});
