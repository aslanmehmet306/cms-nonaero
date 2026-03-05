import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FormulaStatus, ServiceStatus, ServiceType } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { FormulasService } from '../formulas/formulas.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly formulasService: FormulasService,
  ) {}

  /**
   * Create a new service definition with status=draft, version=1.
   * Validates that the referenced formula exists.
   */
  async create(dto: CreateServiceDto) {
    // Verify formula exists (throws NotFoundException if not found)
    await this.formulasService.findOne(dto.formulaId);

    // Type-specific soft validation
    if (dto.serviceType === ServiceType.utility) {
      this.logger.log(
        `Creating utility service ${dto.code} — meter linkage is a Phase 4 concern`,
      );
    }

    return this.prisma.serviceDefinition.create({
      data: {
        airportId: dto.airportId,
        code: dto.code,
        name: dto.name,
        serviceType: dto.serviceType,
        formulaId: dto.formulaId,
        defaultCurrency: dto.defaultCurrency ?? 'TRY',
        defaultBillingFreq: dto.defaultBillingFreq,
        taxClass: dto.taxClass,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        status: ServiceStatus.draft,
        version: 1,
      },
    });
  }

  /**
   * List service definitions for an airport with optional type and status filters.
   */
  async findAll(airportId: string, serviceType?: ServiceType, status?: ServiceStatus) {
    return this.prisma.serviceDefinition.findMany({
      where: {
        airportId,
        ...(serviceType ? { serviceType } : {}),
        ...(status ? { status } : {}),
      },
      include: { formula: true },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Get a single service definition by ID including linked formula.
   */
  async findOne(id: string) {
    const serviceDefinition = await this.prisma.serviceDefinition.findUnique({
      where: { id },
      include: { formula: true },
    });

    if (!serviceDefinition) {
      throw new NotFoundException(`Service definition ${id} not found`);
    }

    return serviceDefinition;
  }

  /**
   * Update a draft service definition. Published services are immutable.
   */
  async update(id: string, dto: UpdateServiceDto) {
    const serviceDefinition = await this.findOne(id);

    if (serviceDefinition.status === ServiceStatus.published) {
      throw new BadRequestException(
        'Published services are immutable. Create a new version instead.',
      );
    }

    return this.prisma.serviceDefinition.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.taxClass !== undefined ? { taxClass: dto.taxClass } : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: new Date(dto.effectiveTo) }
          : {}),
      },
    });
  }

  /**
   * Publish a service definition.
   * Validates that the linked formula is also published.
   */
  async publish(id: string) {
    const serviceDefinition = await this.findOne(id);

    if (serviceDefinition.status === ServiceStatus.published) {
      throw new BadRequestException('Service definition is already published.');
    }

    // Validate that linked formula is published
    const formula = await this.formulasService.findOne(serviceDefinition.formulaId);
    if (formula.status !== FormulaStatus.published) {
      throw new BadRequestException(
        'Cannot publish service: linked formula must be published first.',
      );
    }

    return this.prisma.serviceDefinition.update({
      where: { id },
      data: {
        status: ServiceStatus.published,
        publishedAt: new Date(),
      },
    });
  }

  /**
   * Create a new version of an existing service definition.
   * The new version has version+1 and status=draft.
   */
  async createNewVersion(id: string) {
    const serviceDefinition = await this.findOne(id);

    return this.prisma.serviceDefinition.create({
      data: {
        airportId: serviceDefinition.airportId,
        code: serviceDefinition.code,
        name: serviceDefinition.name,
        serviceType: serviceDefinition.serviceType,
        formulaId: serviceDefinition.formulaId,
        defaultCurrency: serviceDefinition.defaultCurrency,
        defaultBillingFreq: serviceDefinition.defaultBillingFreq,
        taxClass: serviceDefinition.taxClass,
        effectiveFrom: serviceDefinition.effectiveFrom,
        effectiveTo: serviceDefinition.effectiveTo,
        status: ServiceStatus.draft,
        version: serviceDefinition.version + 1,
      },
    });
  }

  /**
   * Deprecate a published service definition.
   */
  async deprecate(id: string) {
    const serviceDefinition = await this.findOne(id);

    if (serviceDefinition.status !== ServiceStatus.published) {
      throw new BadRequestException(
        'Only published service definitions can be deprecated.',
      );
    }

    return this.prisma.serviceDefinition.update({
      where: { id },
      data: { status: ServiceStatus.deprecated },
    });
  }
}
