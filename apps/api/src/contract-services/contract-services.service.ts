import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { validateFormulaAST } from '@airport-revenue/formula-engine';
import { ContractStatus, FormulaStatus, ServiceStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { AssignServiceDto } from './dto/assign-service.dto';
import { UpdateServiceOverrideDto } from './dto/update-service-override.dto';

@Injectable()
export class ContractServicesService {
  private readonly logger = new Logger(ContractServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that an override formula exists, is published, and has a valid expression.
   * Throws NotFoundException if not found, BadRequestException if not published or invalid AST.
   */
  private async validateOverrideFormula(overrideFormulaId: string): Promise<void> {
    const formula = await this.prisma.formula.findUnique({
      where: { id: overrideFormulaId },
    });
    if (!formula) {
      throw new NotFoundException(`Formula ${overrideFormulaId} not found`);
    }
    if (formula.status !== FormulaStatus.published) {
      throw new BadRequestException(
        `Override formula ${overrideFormulaId} must be published before use`,
      );
    }
    const validationResult = validateFormulaAST(formula.expression);
    if (!validationResult.valid) {
      throw new BadRequestException(
        `Override formula expression is invalid: ${validationResult.errors.join(', ')}`,
      );
    }
  }

  /**
   * Assign a service definition to a contract.
   * Only allowed on draft contracts.
   * Service definition must be published.
   * If overrideFormulaId is provided, validates the formula is published and has valid AST.
   * Rejects duplicates via unique constraint (P2002 -> ConflictException).
   */
  async assignService(contractId: string, dto: AssignServiceDto) {
    // Validate contract exists and is draft
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }
    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException(
        'Services can only be assigned to draft contracts',
      );
    }

    // Validate service definition exists and is published
    const serviceDefinition = await this.prisma.serviceDefinition.findUnique({
      where: { id: dto.serviceDefinitionId },
    });
    if (!serviceDefinition) {
      throw new NotFoundException(`Service definition ${dto.serviceDefinitionId} not found`);
    }
    if (serviceDefinition.status !== ServiceStatus.published) {
      throw new BadRequestException(
        `Service definition ${dto.serviceDefinitionId} must be published before assignment`,
      );
    }

    // Validate override formula if provided
    if (dto.overrideFormulaId) {
      await this.validateOverrideFormula(dto.overrideFormulaId);
    }

    // Create ContractService row — let Prisma unique constraint handle duplicates
    try {
      return await this.prisma.contractService.create({
        data: {
          contractId,
          serviceDefinitionId: dto.serviceDefinitionId,
          overrideFormulaId: dto.overrideFormulaId ?? null,
          overrideCurrency: dto.overrideCurrency ?? null,
          overrideBillingFreq: dto.overrideBillingFreq ?? null,
          customParameters: (dto.customParameters ?? undefined) as any,
        },
        include: {
          serviceDefinition: true,
          overrideFormula: true,
        },
      });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        throw new ConflictException(
          `Service ${dto.serviceDefinitionId} is already assigned to contract ${contractId}`,
        );
      }
      throw err;
    }
  }

  /**
   * Update override fields on an existing contract-service assignment.
   * Only allowed on draft contracts.
   */
  async updateOverride(
    contractId: string,
    serviceDefinitionId: string,
    dto: UpdateServiceOverrideDto,
  ) {
    // Validate contract exists and is draft
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }
    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException(
        'Service overrides can only be updated on draft contracts',
      );
    }

    // Find the existing assignment
    const existing = await this.prisma.contractService.findUnique({
      where: {
        contractId_serviceDefinitionId: { contractId, serviceDefinitionId },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        `Service ${serviceDefinitionId} is not assigned to contract ${contractId}`,
      );
    }

    // Validate override formula if provided
    if (dto.overrideFormulaId) {
      await this.validateOverrideFormula(dto.overrideFormulaId);
    }

    return this.prisma.contractService.update({
      where: {
        contractId_serviceDefinitionId: { contractId, serviceDefinitionId },
      },
      data: {
        ...(dto.overrideFormulaId !== undefined ? { overrideFormulaId: dto.overrideFormulaId } : {}),
        ...(dto.overrideCurrency !== undefined ? { overrideCurrency: dto.overrideCurrency } : {}),
        ...(dto.overrideBillingFreq !== undefined ? { overrideBillingFreq: dto.overrideBillingFreq } : {}),
        ...(dto.customParameters !== undefined ? { customParameters: dto.customParameters as any } : {}),
      } as any,
      include: {
        serviceDefinition: true,
        overrideFormula: true,
      },
    });
  }

  /**
   * Remove a service assignment from a contract.
   * Only allowed on draft contracts.
   */
  async removeService(contractId: string, serviceDefinitionId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }
    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException(
        'Services can only be removed from draft contracts',
      );
    }

    await this.prisma.contractService.delete({
      where: {
        contractId_serviceDefinitionId: { contractId, serviceDefinitionId },
      },
    });

    this.logger.log(
      `Removed service ${serviceDefinitionId} from contract ${contractId}`,
    );
  }

  /**
   * List all services assigned to a contract, including serviceDefinition and overrideFormula relations.
   */
  async listServices(contractId: string) {
    return this.prisma.contractService.findMany({
      where: { contractId },
      include: {
        serviceDefinition: true,
        overrideFormula: true,
      },
    });
  }
}
