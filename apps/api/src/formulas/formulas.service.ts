import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  validateFormulaAST,
  evaluateWithTimeout,
  type FormulaScope,
} from '@airport-revenue/formula-engine';
import { FormulaStatus, FormulaType } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { UpdateFormulaDto } from './dto/update-formula.dto';

/**
 * Predefined sample data for dry-run evaluation per formula type.
 * These values represent realistic test scenarios for each type.
 */
const SAMPLE_DATA: Record<FormulaType, Record<string, unknown>> = {
  [FormulaType.arithmetic]: {
    area_m2: 100,
    rate_per_m2: 50,
    monthly_amount: 5000,
  },
  [FormulaType.conditional]: {
    revenue: 150000,
  },
  [FormulaType.step_band]: {
    revenue: 250000,
    bands: [
      { from: 0, to: 100000, rate: 0.05 },
      { from: 100000, to: 300000, rate: 0.08 },
      { from: 300000, to: 999999999, rate: 0.1 },
    ],
  },
  [FormulaType.revenue_share]: {
    revenue: 200000,
    rate: 0.07,
  },
  [FormulaType.escalation]: {
    base_amount: 10000,
    index_rate: 0.03,
  },
  [FormulaType.proration]: {
    monthly_amount: 5000,
    days_in_period: 30,
    days_occupied: 20,
  },
};

@Injectable()
export class FormulasService {
  private readonly logger = new Logger(FormulasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate expression and create formula with status=draft, version=1.
   */
  async create(dto: CreateFormulaDto) {
    const validation = validateFormulaAST(dto.expression);
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid formula expression: ${validation.errors.join('; ')}`,
      );
    }

    return this.prisma.formula.create({
      data: {
        airportId: dto.airportId,
        code: dto.code,
        name: dto.name,
        formulaType: dto.formulaType,
        expression: dto.expression,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variables: dto.variables as any,
        status: FormulaStatus.draft,
        version: 1,
      },
    });
  }

  /**
   * List formulas for an airport with optional status filter.
   */
  async findAll(airportId: string, status?: FormulaStatus) {
    return this.prisma.formula.findMany({
      where: {
        airportId,
        ...(status ? { status } : {}),
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Get a single formula by ID including linked service definitions.
   */
  async findOne(id: string) {
    const formula = await this.prisma.formula.findUnique({
      where: { id },
      include: { serviceDefinitions: true },
    });

    if (!formula) {
      throw new NotFoundException(`Formula ${id} not found`);
    }

    return formula;
  }

  /**
   * Update a draft formula. Published formulas are immutable.
   * Re-validates expression if it changes.
   */
  async update(id: string, dto: UpdateFormulaDto) {
    const formula = await this.findOne(id);

    if (formula.status === FormulaStatus.published) {
      throw new BadRequestException(
        'Published formulas are immutable. Create a new version instead.',
      );
    }

    // Validate new expression if provided
    if (dto.expression !== undefined) {
      const validation = validateFormulaAST(dto.expression);
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid formula expression: ${validation.errors.join('; ')}`,
        );
      }
    }

    return this.prisma.formula.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.expression !== undefined ? { expression: dto.expression } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(dto.variables !== undefined ? { variables: dto.variables as any } : {}),
      },
    });
  }

  /**
   * Publish a draft formula. Validates expression one final time.
   */
  async publish(id: string) {
    const formula = await this.findOne(id);

    if (formula.status === FormulaStatus.published) {
      throw new BadRequestException('Formula is already published.');
    }

    // Final validation before publishing
    const validation = validateFormulaAST(formula.expression);
    if (!validation.valid) {
      throw new BadRequestException(
        `Cannot publish formula with invalid expression: ${validation.errors.join('; ')}`,
      );
    }

    return this.prisma.formula.update({
      where: { id },
      data: {
        status: FormulaStatus.published,
        publishedAt: new Date(),
      },
    });
  }

  /**
   * Create a new version of an existing formula.
   * The new version has version+1 and status=draft.
   */
  async createNewVersion(id: string, dto?: UpdateFormulaDto) {
    const formula = await this.findOne(id);

    if (!formula) {
      throw new NotFoundException(`Formula ${id} not found`);
    }

    return this.prisma.formula.create({
      data: {
        airportId: formula.airportId,
        code: formula.code,
        name: dto?.name ?? formula.name,
        formulaType: formula.formulaType,
        expression: dto?.expression ?? formula.expression,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variables: (dto?.variables ?? formula.variables) as any,
        status: FormulaStatus.draft,
        version: formula.version + 1,
      },
    });
  }

  /**
   * Deprecate (archive) a published formula.
   */
  async deprecate(id: string) {
    const formula = await this.findOne(id);

    if (formula.status !== FormulaStatus.published) {
      throw new BadRequestException(
        'Only published formulas can be deprecated.',
      );
    }

    return this.prisma.formula.update({
      where: { id },
      data: { status: FormulaStatus.archived },
    });
  }

  /**
   * Dry-run formula evaluation with sample data merged with user-provided variables.
   * Returns the calculated result and a full trace.
   */
  async dryRun(id: string, variables?: Record<string, unknown>) {
    const formula = await this.findOne(id);

    // Merge predefined sample data with user-provided overrides
    const sampleData = SAMPLE_DATA[formula.formulaType as FormulaType] ?? {};
    const mergedScope = { ...sampleData, ...(variables ?? {}) };

    const evalResult = await evaluateWithTimeout(formula.expression, mergedScope as FormulaScope, 100);

    if (!evalResult.success) {
      throw new BadRequestException(
        `Formula evaluation failed: ${evalResult.error}`,
      );
    }

    return {
      result: evalResult.result,
      trace: {
        expression: formula.expression,
        scope: mergedScope,
        calculatedValue: evalResult.result,
        durationMs: evalResult.durationMs,
        formulaType: formula.formulaType,
      },
    };
  }
}
