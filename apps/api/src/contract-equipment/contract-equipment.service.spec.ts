import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ContractEquipmentService } from './contract-equipment.service';
import { PrismaService } from '../database/prisma.service';
import { ContractStatus, EquipmentStatus } from '@shared-types/enums';

describe('ContractEquipmentService', () => {
  let service: ContractEquipmentService;
  let prisma: {
    contract: { findUnique: jest.Mock };
    equipment: { findUnique: jest.Mock };
    contractEquipment: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
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

  const mockEquipment = {
    id: 'equipment-uuid-1',
    code: 'EQ-001',
    name: 'Boarding Bridge 1',
    status: EquipmentStatus.commissioned,
    airportId: 'airport-uuid-1',
  };

  const mockDecommissionedEquipment = {
    ...mockEquipment,
    id: 'equipment-uuid-2',
    status: EquipmentStatus.decommissioned,
  };

  const mockContractEquipment = {
    id: 'contract-equipment-uuid-1',
    contractId: 'contract-uuid-1',
    equipmentId: 'equipment-uuid-1',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    monthlyRate: null,
    rateCurrency: 'TRY',
    includeInBundle: false,
    isActive: true,
    notes: null,
    equipment: mockEquipment,
  };

  beforeEach(async () => {
    prisma = {
      contract: { findUnique: jest.fn() },
      equipment: { findUnique: jest.fn() },
      contractEquipment: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractEquipmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ContractEquipmentService>(ContractEquipmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignEquipment', () => {
    it('should create ContractEquipment row with contractId, equipmentId, effectiveFrom', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.equipment.findUnique.mockResolvedValue(mockEquipment);
      prisma.contractEquipment.create.mockResolvedValue(mockContractEquipment);

      const dto = { equipmentId: 'equipment-uuid-1', effectiveFrom: '2026-01-01' };
      const result = await service.assignEquipment('contract-uuid-1', dto);

      expect(prisma.contract.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'contract-uuid-1' } }),
      );
      expect(prisma.equipment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'equipment-uuid-1' } }),
      );
      expect(prisma.contractEquipment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractId: 'contract-uuid-1',
            equipmentId: 'equipment-uuid-1',
          }),
        }),
      );
      expect(result).toEqual(mockContractEquipment);
    });

    it('should throw NotFoundException if contract does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.assignEquipment('non-existent-contract', { equipmentId: 'equipment-uuid-1', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractEquipment.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on non-draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.assignEquipment('contract-uuid-2', { equipmentId: 'equipment-uuid-1', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractEquipment.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with message "Equipment can only be assigned to draft contracts"', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.assignEquipment('contract-uuid-2', { equipmentId: 'equipment-uuid-1', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow('Equipment can only be assigned to draft contracts');
    });

    it('should throw NotFoundException if equipment does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.equipment.findUnique.mockResolvedValue(null);

      await expect(
        service.assignEquipment('contract-uuid-1', { equipmentId: 'non-existent-equipment', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractEquipment.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if equipment is not commissioned', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.equipment.findUnique.mockResolvedValue(mockDecommissionedEquipment);

      await expect(
        service.assignEquipment('contract-uuid-1', { equipmentId: 'equipment-uuid-2', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow('Only commissioned equipment can be assigned');
      expect(prisma.contractEquipment.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate equipment assignment (Prisma P2002)', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.equipment.findUnique.mockResolvedValue(mockEquipment);
      const prismaError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      prisma.contractEquipment.create.mockRejectedValue(prismaError);

      await expect(
        service.assignEquipment('contract-uuid-1', { equipmentId: 'equipment-uuid-1', effectiveFrom: '2026-01-01' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeEquipment', () => {
    it('should delete the junction row', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.contractEquipment.delete.mockResolvedValue(mockContractEquipment);

      await service.removeEquipment('contract-uuid-1', 'equipment-uuid-1');

      expect(prisma.contractEquipment.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            contractId_equipmentId: {
              contractId: 'contract-uuid-1',
              equipmentId: 'equipment-uuid-1',
            },
          },
        }),
      );
    });

    it('should throw NotFoundException if contract does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.removeEquipment('non-existent-contract', 'equipment-uuid-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractEquipment.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on non-draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.removeEquipment('contract-uuid-2', 'equipment-uuid-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractEquipment.delete).not.toHaveBeenCalled();
    });
  });

  describe('listEquipment', () => {
    it('should return all equipment for a contract with equipment details included', async () => {
      prisma.contractEquipment.findMany.mockResolvedValue([mockContractEquipment]);

      const result = await service.listEquipment('contract-uuid-1');

      expect(prisma.contractEquipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId: 'contract-uuid-1' },
          include: { equipment: true },
        }),
      );
      expect(result).toEqual([mockContractEquipment]);
    });
  });

  describe('updateEquipment', () => {
    it('should update the contract-equipment assignment', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      const updatedContractEquipment = {
        ...mockContractEquipment,
        monthlyRate: '500.00',
        notes: 'Updated rate',
      };
      prisma.contractEquipment.update.mockResolvedValue(updatedContractEquipment);

      const dto = { monthlyRate: '500.00', notes: 'Updated rate' };
      const result = await service.updateEquipment('contract-uuid-1', 'equipment-uuid-1', dto);

      expect(prisma.contractEquipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            contractId_equipmentId: {
              contractId: 'contract-uuid-1',
              equipmentId: 'equipment-uuid-1',
            },
          },
        }),
      );
      expect(result).toEqual(updatedContractEquipment);
    });

    it('should throw NotFoundException if contract does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.updateEquipment('non-existent-contract', 'equipment-uuid-1', { monthlyRate: '500.00' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractEquipment.update).not.toHaveBeenCalled();
    });
  });
});
