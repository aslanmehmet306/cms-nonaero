import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormulasService } from './formulas.service';
import { PrismaService } from '../database/prisma.service';
import { FormulaStatus, FormulaType } from '@shared-types/enums';

// Mock the formula-engine module
jest.mock('@airport-revenue/formula-engine', () => ({
  validateFormulaAST: jest.fn(),
  evaluateWithTimeout: jest.fn(),
}));

import {
  validateFormulaAST,
  evaluateWithTimeout,
} from '@airport-revenue/formula-engine';

const mockValidateFormulaAST = validateFormulaAST as jest.Mock;
const mockEvaluateWithTimeout = evaluateWithTimeout as jest.Mock;

describe('FormulasService', () => {
  let service: FormulasService;
  let prisma: {
    formula: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  const mockFormula = {
    id: 'formula-uuid-1',
    airportId: 'airport-uuid-1',
    code: 'RENT-FIXED',
    name: 'Fixed Rent Formula',
    formulaType: FormulaType.arithmetic,
    expression: 'area_m2 * rate_per_m2',
    variables: { area_m2: 'Area in m2', rate_per_m2: 'Rate per m2' },
    status: FormulaStatus.draft,
    version: 1,
    publishedAt: null,
    createdAt: new Date(),
    serviceDefinitions: [],
  };

  const mockPublishedFormula = {
    ...mockFormula,
    status: FormulaStatus.published,
    publishedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      formula: {
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
        FormulasService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<FormulasService>(FormulasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a formula with status=draft when expression is valid', async () => {
      mockValidateFormulaAST.mockReturnValue({ valid: true, errors: [] });
      prisma.formula.create.mockResolvedValue(mockFormula);

      const dto = {
        airportId: 'airport-uuid-1',
        code: 'RENT-FIXED',
        name: 'Fixed Rent Formula',
        formulaType: FormulaType.arithmetic,
        expression: 'area_m2 * rate_per_m2',
        variables: { area_m2: 'Area in m2', rate_per_m2: 'Rate per m2' },
      };

      const result = await service.create(dto);

      expect(mockValidateFormulaAST).toHaveBeenCalledWith('area_m2 * rate_per_m2');
      expect(prisma.formula.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: FormulaStatus.draft,
            version: 1,
          }),
        }),
      );
      expect(result).toEqual(mockFormula);
    });

    it('should throw BadRequestException when expression is invalid', async () => {
      mockValidateFormulaAST.mockReturnValue({
        valid: false,
        errors: ['Invalid identifier: __proto__'],
      });

      const dto = {
        airportId: 'airport-uuid-1',
        code: 'BAD-FORMULA',
        name: 'Bad Formula',
        formulaType: FormulaType.arithmetic,
        expression: '__proto__',
        variables: {},
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.formula.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return formulas for airport ordered by code', async () => {
      const formulas = [mockFormula];
      prisma.formula.findMany.mockResolvedValue(formulas);

      const result = await service.findAll('airport-uuid-1');

      expect(prisma.formula.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { airportId: 'airport-uuid-1' },
          orderBy: { code: 'asc' },
        }),
      );
      expect(result).toEqual(formulas);
    });

    it('should filter formulas by status', async () => {
      prisma.formula.findMany.mockResolvedValue([mockPublishedFormula]);

      await service.findAll('airport-uuid-1', FormulaStatus.published);

      expect(prisma.formula.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { airportId: 'airport-uuid-1', status: FormulaStatus.published },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return formula with service definitions', async () => {
      prisma.formula.findUnique.mockResolvedValue(mockFormula);

      const result = await service.findOne('formula-uuid-1');

      expect(prisma.formula.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'formula-uuid-1' },
          include: { serviceDefinitions: true },
        }),
      );
      expect(result).toEqual(mockFormula);
    });

    it('should throw NotFoundException when formula not found', async () => {
      prisma.formula.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft formula with valid expression', async () => {
      mockValidateFormulaAST.mockReturnValue({ valid: true, errors: [] });
      prisma.formula.findUnique.mockResolvedValue(mockFormula);
      prisma.formula.update.mockResolvedValue({
        ...mockFormula,
        expression: 'area_m2 * rate_per_m2 * 2',
      });

      const result = await service.update('formula-uuid-1', {
        expression: 'area_m2 * rate_per_m2 * 2',
      });

      expect(mockValidateFormulaAST).toHaveBeenCalledWith('area_m2 * rate_per_m2 * 2');
      expect(prisma.formula.update).toHaveBeenCalled();
      expect(result.expression).toBe('area_m2 * rate_per_m2 * 2');
    });

    it('should throw BadRequestException when updating published formula', async () => {
      prisma.formula.findUnique.mockResolvedValue(mockPublishedFormula);

      await expect(
        service.update('formula-uuid-1', { expression: 'new_expression' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.formula.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when formula not found', async () => {
      prisma.formula.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { expression: 'area_m2' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it('should set status=published and publishedAt on draft formula', async () => {
      mockValidateFormulaAST.mockReturnValue({ valid: true, errors: [] });
      prisma.formula.findUnique.mockResolvedValue(mockFormula);
      prisma.formula.update.mockResolvedValue(mockPublishedFormula);

      const result = await service.publish('formula-uuid-1');

      expect(prisma.formula.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'formula-uuid-1' },
          data: expect.objectContaining({
            status: FormulaStatus.published,
          }),
        }),
      );
      expect(result.status).toBe(FormulaStatus.published);
    });

    it('should throw BadRequestException when publishing already published formula', async () => {
      prisma.formula.findUnique.mockResolvedValue(mockPublishedFormula);

      await expect(service.publish('formula-uuid-1')).rejects.toThrow(BadRequestException);
      expect(prisma.formula.update).not.toHaveBeenCalled();
    });
  });

  describe('createNewVersion', () => {
    it('should create new version with version+1 and status=draft', async () => {
      const newVersionFormula = {
        ...mockFormula,
        id: 'formula-uuid-2',
        version: 2,
        status: FormulaStatus.draft,
        publishedAt: null,
      };
      prisma.formula.findUnique.mockResolvedValue(mockPublishedFormula);
      prisma.formula.create.mockResolvedValue(newVersionFormula);

      const result = await service.createNewVersion('formula-uuid-1');

      expect(prisma.formula.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
            status: FormulaStatus.draft,
          }),
        }),
      );
      expect(result.version).toBe(2);
      expect(result.status).toBe(FormulaStatus.draft);
    });

    it('should throw NotFoundException when formula not found', async () => {
      prisma.formula.findUnique.mockResolvedValue(null);

      await expect(service.createNewVersion('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deprecate', () => {
    it('should set status=archived on published formula', async () => {
      prisma.formula.findUnique.mockResolvedValue(mockPublishedFormula);
      prisma.formula.update.mockResolvedValue({
        ...mockPublishedFormula,
        status: FormulaStatus.archived,
      });

      const result = await service.deprecate('formula-uuid-1');

      expect(prisma.formula.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: FormulaStatus.archived }),
        }),
      );
      expect(result.status).toBe(FormulaStatus.archived);
    });

    it('should throw BadRequestException when deprecating a draft formula', async () => {
      prisma.formula.findUnique.mockResolvedValue(mockFormula);

      await expect(service.deprecate('formula-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('dryRun', () => {
    it('should evaluate formula with predefined sample data for arithmetic type', async () => {
      prisma.formula.findUnique.mockResolvedValue(mockFormula);
      mockEvaluateWithTimeout.mockResolvedValue({
        success: true,
        result: '5000',
        trace: {
          expression: 'area_m2 * rate_per_m2',
          scope: { area_m2: 100, rate_per_m2: 50 },
          calculatedValue: '5000',
          durationMs: 5,
          formulaType: FormulaType.arithmetic,
        },
        durationMs: 5,
      });

      const result = await service.dryRun('formula-uuid-1');

      expect(mockEvaluateWithTimeout).toHaveBeenCalled();
      expect(result.result).toBe('5000');
      expect(result.trace).toBeDefined();
      expect(result.trace.formulaType).toBe(FormulaType.arithmetic);
    });

    it('should merge user-provided variables with predefined sample data', async () => {
      prisma.formula.findUnique.mockResolvedValue(mockFormula);
      mockEvaluateWithTimeout.mockResolvedValue({
        success: true,
        result: '20000',
        trace: {
          expression: 'area_m2 * rate_per_m2',
          scope: { area_m2: 200, rate_per_m2: 100 },
          calculatedValue: '20000',
          durationMs: 3,
          formulaType: FormulaType.arithmetic,
        },
        durationMs: 3,
      });

      const result = await service.dryRun('formula-uuid-1', { area_m2: 200, rate_per_m2: 100 });

      expect(result.result).toBe('20000');
      // Verify user overrides were used in scope
      expect(mockEvaluateWithTimeout).toHaveBeenCalledWith(
        'area_m2 * rate_per_m2',
        expect.objectContaining({ area_m2: 200, rate_per_m2: 100 }),
        100,
      );
    });

    it('should return 400 when evaluation fails', async () => {
      prisma.formula.findUnique.mockResolvedValue(mockFormula);
      mockEvaluateWithTimeout.mockResolvedValue({
        success: false,
        error: 'Division by zero',
        durationMs: 2,
      });

      await expect(service.dryRun('formula-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when formula not found', async () => {
      prisma.formula.findUnique.mockResolvedValue(null);

      await expect(service.dryRun('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
