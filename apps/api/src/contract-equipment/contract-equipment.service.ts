import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, EquipmentStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { AssignEquipmentDto } from './dto/assign-equipment.dto';
import { UpdateContractEquipmentDto } from './dto/update-contract-equipment.dto';

@Injectable()
export class ContractEquipmentService {
  private readonly logger = new Logger(ContractEquipmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assign equipment to a contract.
   * Only allowed on contracts in draft status.
   * Validates that both contract and equipment exist.
   * Only commissioned equipment can be assigned.
   * Rejects duplicate assignments via unique constraint (P2002 -> ConflictException).
   */
  async assignEquipment(contractId: string, dto: AssignEquipmentDto) {
    // Validate contract exists
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    // Validate contract is in draft status
    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException(
        'Equipment can only be assigned to draft contracts',
      );
    }

    // Validate equipment exists
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: dto.equipmentId },
    });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${dto.equipmentId} not found`);
    }

    // Validate equipment is commissioned
    if (equipment.status !== EquipmentStatus.commissioned) {
      throw new BadRequestException(
        'Only commissioned equipment can be assigned',
      );
    }

    // Create ContractEquipment row — let Prisma unique constraint handle duplicates
    try {
      return await this.prisma.contractEquipment.create({
        data: {
          contractId,
          equipmentId: dto.equipmentId,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          monthlyRate: dto.monthlyRate ?? null,
          rateCurrency: dto.rateCurrency ?? 'TRY',
          includeInBundle: dto.includeInBundle ?? false,
          notes: dto.notes ?? null,
        },
        include: { equipment: true },
      });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        throw new ConflictException(
          `Equipment ${dto.equipmentId} is already assigned to contract ${contractId}`,
        );
      }
      throw err;
    }
  }

  /**
   * Remove an equipment assignment from a contract.
   * Only allowed on contracts in draft status.
   */
  async removeEquipment(contractId: string, equipmentId: string): Promise<void> {
    // Validate contract exists and is draft
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException(
        'Equipment can only be removed from draft contracts',
      );
    }

    await this.prisma.contractEquipment.delete({
      where: {
        contractId_equipmentId: { contractId, equipmentId },
      },
    });

    this.logger.log(`Removed equipment ${equipmentId} from contract ${contractId}`);
  }

  /**
   * List all equipment assigned to a contract, including equipment relation.
   */
  async listEquipment(contractId: string) {
    return this.prisma.contractEquipment.findMany({
      where: { contractId },
      include: { equipment: true },
    });
  }

  /**
   * Update a contract-equipment assignment.
   * Only allowed on contracts in draft status.
   */
  async updateEquipment(
    contractId: string,
    equipmentId: string,
    dto: UpdateContractEquipmentDto,
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
        'Equipment can only be updated on draft contracts',
      );
    }

    return this.prisma.contractEquipment.update({
      where: {
        contractId_equipmentId: { contractId, equipmentId },
      },
      data: {
        ...(dto.effectiveFrom !== undefined && {
          effectiveFrom: new Date(dto.effectiveFrom),
        }),
        ...(dto.effectiveTo !== undefined && {
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        }),
        ...(dto.monthlyRate !== undefined && { monthlyRate: dto.monthlyRate }),
        ...(dto.rateCurrency !== undefined && { rateCurrency: dto.rateCurrency }),
        ...(dto.includeInBundle !== undefined && { includeInBundle: dto.includeInBundle }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { equipment: true },
    });
  }
}
