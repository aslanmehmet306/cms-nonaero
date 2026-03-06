import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { AssignAreaDto } from './dto/assign-area.dto';

@Injectable()
export class ContractAreasService {
  private readonly logger = new Logger(ContractAreasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assign an area to a contract.
   * Only allowed on contracts in draft status.
   * Validates that both contract and area exist.
   * Rejects duplicate assignments via unique constraint (P2002 -> ConflictException).
   */
  async assignArea(contractId: string, dto: AssignAreaDto) {
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
        'Areas can only be assigned to draft contracts',
      );
    }

    // Validate area exists
    const area = await this.prisma.area.findUnique({
      where: { id: dto.areaId },
    });
    if (!area) {
      throw new NotFoundException(`Area ${dto.areaId} not found`);
    }

    // Create ContractArea row — let Prisma unique constraint handle duplicates
    try {
      return await this.prisma.contractArea.create({
        data: {
          contractId,
          areaId: dto.areaId,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        },
        include: { area: true },
      });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        throw new ConflictException(
          `Area ${dto.areaId} is already assigned to contract ${contractId}`,
        );
      }
      throw err;
    }
  }

  /**
   * Remove an area assignment from a contract.
   * Only allowed on contracts in draft status.
   */
  async removeArea(contractId: string, areaId: string): Promise<void> {
    // Validate contract exists and is draft
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException(
        'Areas can only be removed from draft contracts',
      );
    }

    await this.prisma.contractArea.delete({
      where: {
        contractId_areaId: { contractId, areaId },
      },
    });

    this.logger.log(`Removed area ${areaId} from contract ${contractId}`);
  }

  /**
   * List all areas assigned to a contract, including area relation.
   */
  async listAreas(contractId: string) {
    return this.prisma.contractArea.findMany({
      where: { contractId },
      include: { area: true },
    });
  }
}
