import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ContractServicesService } from './contract-services.service';
import { PrismaService } from '../database/prisma.service';
import { BillingFrequency, ContractStatus, FormulaStatus, ServiceStatus } from '@shared-types/enums';

// Mock validateFormulaAST at module level
jest.mock('@airport-revenue/formula-engine', () => ({
  validateFormulaAST: jest.fn(),
}));

import { validateFormulaAST } from '@airport-revenue/formula-engine';
const mockValidateFormulaAST = validateFormulaAST as jest.Mock;

describe('ContractServicesService', () => {
  let service: ContractServicesService;
  let prisma: {
    contract: { findUnique: jest.Mock };
    serviceDefinition: { findUnique: jest.Mock };
    formula: { findUnique: jest.Mock };
    contractService: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
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
  };

  const mockActiveContract = {
    ...mockDraftContract,
    id: 'contract-uuid-2',
    status: ContractStatus.active,
  };

  const mockPublishedServiceDef = {
    id: 'service-def-uuid-1',
    code: 'FIXED-RENT',
    name: 'Fixed Rent',
    status: ServiceStatus.published,
    formulaId: 'formula-uuid-1',
  };

  const mockDraftServiceDef = {
    ...mockPublishedServiceDef,
    id: 'service-def-uuid-2',
    status: ServiceStatus.draft,
  };

  const mockPublishedFormula = {
    id: 'formula-uuid-1',
    code: 'RENT-FIXED',
    expression: 'area_m2 * rate_per_m2',
    status: FormulaStatus.published,
  };

  const mockDraftFormula = {
    ...mockPublishedFormula,
    id: 'formula-uuid-2',
    status: FormulaStatus.draft,
  };

  const mockContractService = {
    id: 'contract-service-uuid-1',
    contractId: 'contract-uuid-1',
    serviceDefinitionId: 'service-def-uuid-1',
    overrideFormulaId: null,
    overrideCurrency: null,
    overrideBillingFreq: null,
    customParameters: null,
    isActive: true,
    serviceDefinition: mockPublishedServiceDef,
    overrideFormula: null,
  };

  beforeEach(async () => {
    prisma = {
      contract: { findUnique: jest.fn() },
      serviceDefinition: { findUnique: jest.fn() },
      formula: { findUnique: jest.fn() },
      contractService: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockValidateFormulaAST.mockReturnValue({ valid: true, errors: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractServicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ContractServicesService>(ContractServicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignService', () => {
    it('should create ContractService row with contractId and serviceDefinitionId', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockPublishedServiceDef);
      prisma.contractService.create.mockResolvedValue(mockContractService);

      const dto = { serviceDefinitionId: 'service-def-uuid-1' };
      const result = await service.assignService('contract-uuid-1', dto);

      expect(prisma.contract.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'contract-uuid-1' } }),
      );
      expect(prisma.serviceDefinition.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'service-def-uuid-1' } }),
      );
      expect(prisma.contractService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractId: 'contract-uuid-1',
            serviceDefinitionId: 'service-def-uuid-1',
          }),
        }),
      );
      expect(result).toEqual(mockContractService);
    });

    it('should throw NotFoundException if contract does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.assignService('non-existent', { serviceDefinitionId: 'service-def-uuid-1' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractService.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if service definition does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.serviceDefinition.findUnique.mockResolvedValue(null);

      await expect(
        service.assignService('contract-uuid-1', { serviceDefinitionId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractService.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on non-draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.assignService('contract-uuid-2', { serviceDefinitionId: 'service-def-uuid-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if service definition is not published', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockDraftServiceDef);

      await expect(
        service.assignService('contract-uuid-1', { serviceDefinitionId: 'service-def-uuid-2' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractService.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate service assignment (Prisma P2002)', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockPublishedServiceDef);
      const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      prisma.contractService.create.mockRejectedValue(prismaError);

      await expect(
        service.assignService('contract-uuid-1', { serviceDefinitionId: 'service-def-uuid-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should validate override formula expression via validateFormulaAST — rejects invalid', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockPublishedServiceDef);
      prisma.formula.findUnique.mockResolvedValue(mockPublishedFormula);
      mockValidateFormulaAST.mockReturnValue({ valid: false, errors: ['Invalid expression'] });

      await expect(
        service.assignService('contract-uuid-1', {
          serviceDefinitionId: 'service-def-uuid-1',
          overrideFormulaId: 'formula-uuid-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractService.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if overrideFormulaId formula does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockPublishedServiceDef);
      prisma.formula.findUnique.mockResolvedValue(null);

      await expect(
        service.assignService('contract-uuid-1', {
          serviceDefinitionId: 'service-def-uuid-1',
          overrideFormulaId: 'non-existent-formula',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.contractService.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if override formula is not published', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockPublishedServiceDef);
      prisma.formula.findUnique.mockResolvedValue(mockDraftFormula);

      await expect(
        service.assignService('contract-uuid-1', {
          serviceDefinitionId: 'service-def-uuid-1',
          overrideFormulaId: 'formula-uuid-2',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractService.create).not.toHaveBeenCalled();
    });
  });

  describe('updateOverride', () => {
    it('should update override fields on draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.contractService.findUnique.mockResolvedValue(mockContractService);
      prisma.contractService.update.mockResolvedValue({
        ...mockContractService,
        overrideCurrency: 'EUR',
        overrideBillingFreq: BillingFrequency.quarterly,
      });

      const dto = { overrideCurrency: 'EUR', overrideBillingFreq: BillingFrequency.quarterly };
      const result = await service.updateOverride('contract-uuid-1', 'service-def-uuid-1', dto);

      expect(prisma.contractService.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            overrideCurrency: 'EUR',
            overrideBillingFreq: BillingFrequency.quarterly,
          }),
        }),
      );
      expect(result.overrideCurrency).toBe('EUR');
    });

    it('should throw BadRequestException on non-draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.updateOverride('contract-uuid-2', 'service-def-uuid-1', { overrideCurrency: 'EUR' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractService.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if contract service assignment does not exist', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.contractService.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOverride('contract-uuid-1', 'non-existent-service', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeService', () => {
    it('should delete junction row on draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockDraftContract);
      prisma.contractService.delete.mockResolvedValue(mockContractService);

      await service.removeService('contract-uuid-1', 'service-def-uuid-1');

      expect(prisma.contractService.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            contractId_serviceDefinitionId: {
              contractId: 'contract-uuid-1',
              serviceDefinitionId: 'service-def-uuid-1',
            },
          },
        }),
      );
    });

    it('should throw BadRequestException on non-draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockActiveContract);

      await expect(
        service.removeService('contract-uuid-2', 'service-def-uuid-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractService.delete).not.toHaveBeenCalled();
    });
  });

  describe('listServices', () => {
    it('should return all services for a contract with serviceDefinition included', async () => {
      prisma.contractService.findMany.mockResolvedValue([mockContractService]);

      const result = await service.listServices('contract-uuid-1');

      expect(prisma.contractService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId: 'contract-uuid-1' },
          include: expect.objectContaining({ serviceDefinition: true }),
        }),
      );
      expect(result).toEqual([mockContractService]);
    });
  });
});
