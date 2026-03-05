import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../database/prisma.service';
import { FormulasService } from '../formulas/formulas.service';
import {
  ServiceStatus,
  ServiceType,
  BillingFrequency,
  FormulaStatus,
  FormulaType,
} from '@shared-types/enums';

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: {
    serviceDefinition: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let formulasService: {
    findOne: jest.Mock;
  };

  const mockFormula = {
    id: 'formula-uuid-1',
    airportId: 'airport-uuid-1',
    code: 'RENT-FIXED',
    name: 'Fixed Rent Formula',
    formulaType: FormulaType.arithmetic,
    expression: 'area_m2 * rate_per_m2',
    variables: {},
    status: FormulaStatus.published,
    version: 1,
    publishedAt: new Date(),
    createdAt: new Date(),
    serviceDefinitions: [],
  };

  const mockService = {
    id: 'service-uuid-1',
    airportId: 'airport-uuid-1',
    code: 'FIXED-RENT',
    name: 'Fixed Rent',
    serviceType: ServiceType.rent,
    formulaId: 'formula-uuid-1',
    defaultCurrency: 'TRY',
    defaultBillingFreq: BillingFrequency.monthly,
    taxClass: null,
    status: ServiceStatus.draft,
    version: 1,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    publishedAt: null,
    createdAt: new Date(),
    formula: mockFormula,
  };

  const mockPublishedService = {
    ...mockService,
    status: ServiceStatus.published,
    publishedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      serviceDefinition: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    formulasService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: FormulasService,
          useValue: formulasService,
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create service with status=draft, version=1', async () => {
      formulasService.findOne.mockResolvedValue(mockFormula);
      prisma.serviceDefinition.create.mockResolvedValue(mockService);

      const dto = {
        airportId: 'airport-uuid-1',
        code: 'FIXED-RENT',
        name: 'Fixed Rent',
        serviceType: ServiceType.rent,
        formulaId: 'formula-uuid-1',
        defaultCurrency: 'TRY',
        defaultBillingFreq: BillingFrequency.monthly,
        effectiveFrom: '2026-01-01',
      };

      const result = await service.create(dto);

      expect(formulasService.findOne).toHaveBeenCalledWith('formula-uuid-1');
      expect(prisma.serviceDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ServiceStatus.draft,
            version: 1,
          }),
        }),
      );
      expect(result).toEqual(mockService);
    });

    it('should throw NotFoundException when formulaId does not exist', async () => {
      formulasService.findOne.mockRejectedValue(new NotFoundException('Formula not found'));

      const dto = {
        airportId: 'airport-uuid-1',
        code: 'FIXED-RENT',
        name: 'Fixed Rent',
        serviceType: ServiceType.rent,
        formulaId: 'non-existent-formula',
        defaultBillingFreq: BillingFrequency.monthly,
        effectiveFrom: '2026-01-01',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(prisma.serviceDefinition.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return services for airport with formula included', async () => {
      prisma.serviceDefinition.findMany.mockResolvedValue([mockService]);

      const result = await service.findAll('airport-uuid-1');

      expect(prisma.serviceDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { airportId: 'airport-uuid-1' },
          include: { formula: true },
        }),
      );
      expect(result).toEqual([mockService]);
    });

    it('should filter by serviceType and status', async () => {
      prisma.serviceDefinition.findMany.mockResolvedValue([mockService]);

      await service.findAll('airport-uuid-1', ServiceType.rent, ServiceStatus.draft);

      expect(prisma.serviceDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            airportId: 'airport-uuid-1',
            serviceType: ServiceType.rent,
            status: ServiceStatus.draft,
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return service with formula', async () => {
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockService);

      const result = await service.findOne('service-uuid-1');

      expect(prisma.serviceDefinition.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'service-uuid-1' },
          include: { formula: true },
        }),
      );
      expect(result).toEqual(mockService);
    });

    it('should throw NotFoundException when service not found', async () => {
      prisma.serviceDefinition.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft service', async () => {
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockService);
      prisma.serviceDefinition.update.mockResolvedValue({
        ...mockService,
        name: 'Updated Fixed Rent',
      });

      const result = await service.update('service-uuid-1', { name: 'Updated Fixed Rent' });

      expect(prisma.serviceDefinition.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated Fixed Rent');
    });

    it('should throw BadRequestException when updating published service', async () => {
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockPublishedService);

      await expect(
        service.update('service-uuid-1', { name: 'New Name' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.serviceDefinition.update).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should publish service when linked formula is published', async () => {
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockService);
      formulasService.findOne.mockResolvedValue(mockFormula);
      prisma.serviceDefinition.update.mockResolvedValue(mockPublishedService);

      const result = await service.publish('service-uuid-1');

      expect(prisma.serviceDefinition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ServiceStatus.published,
          }),
        }),
      );
      expect(result.status).toBe(ServiceStatus.published);
    });

    it('should throw BadRequestException when linked formula is not published', async () => {
      const draftFormula = { ...mockFormula, status: FormulaStatus.draft };
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockService);
      formulasService.findOne.mockResolvedValue(draftFormula);

      await expect(service.publish('service-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createNewVersion', () => {
    it('should create new version with version+1 and status=draft', async () => {
      const newVersionService = {
        ...mockService,
        id: 'service-uuid-2',
        version: 2,
        status: ServiceStatus.draft,
        publishedAt: null,
      };
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockPublishedService);
      prisma.serviceDefinition.create.mockResolvedValue(newVersionService);

      const result = await service.createNewVersion('service-uuid-1');

      expect(prisma.serviceDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
            status: ServiceStatus.draft,
          }),
        }),
      );
      expect(result.version).toBe(2);
    });
  });

  describe('deprecate', () => {
    it('should deprecate published service', async () => {
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockPublishedService);
      prisma.serviceDefinition.update.mockResolvedValue({
        ...mockPublishedService,
        status: ServiceStatus.deprecated,
      });

      const result = await service.deprecate('service-uuid-1');

      expect(prisma.serviceDefinition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ServiceStatus.deprecated }),
        }),
      );
      expect(result.status).toBe(ServiceStatus.deprecated);
    });

    it('should throw BadRequestException when deprecating a draft service', async () => {
      prisma.serviceDefinition.findUnique.mockResolvedValue(mockService);

      await expect(service.deprecate('service-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });
});
