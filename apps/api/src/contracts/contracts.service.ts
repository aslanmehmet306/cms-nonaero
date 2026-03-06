import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { ContractStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { AmendContractDto } from './dto/amend-contract.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { QueryContractsDto } from './dto/query-contracts.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ALLOWED_TRANSITIONS defines valid state machine transitions.
 * Keys are the FROM state; values are valid TO states.
 *
 * Terminal states (amended, terminated) have empty arrays.
 * pending_amendment can only be flipped by the daily cron job — not via the API.
 */
const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.draft]: [ContractStatus.in_review],
  [ContractStatus.in_review]: [ContractStatus.published, ContractStatus.draft],
  [ContractStatus.published]: [ContractStatus.active],
  [ContractStatus.active]: [
    ContractStatus.amended,
    ContractStatus.suspended,
    ContractStatus.terminated,
  ],
  [ContractStatus.pending_amendment]: [], // only cron can flip this
  [ContractStatus.suspended]: [ContractStatus.active, ContractStatus.terminated],
  [ContractStatus.amended]: [], // terminal
  [ContractStatus.terminated]: [], // terminal
};

// ─────────────────────────────────────────────────────────────────────────────
// Version Diff Fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fields used for field-level diff in version history.
 */
const COMPARABLE_FIELDS: Array<keyof {
  annualMag: unknown;
  magCurrency: unknown;
  effectiveFrom: unknown;
  effectiveTo: unknown;
  billingFrequency: unknown;
  responsibleOwner: unknown;
}> = [
  'annualMag',
  'magCurrency',
  'effectiveFrom',
  'effectiveTo',
  'billingFrequency',
  'responsibleOwner',
];

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventEmitter: EventEmitter2,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Contract Number Generation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate the next sequential contract number for a given airport.
   * Format: CNT-001, CNT-002, ..., CNT-999, CNT-1000, ...
   * Only queries version=1 rows to ensure unique numbering per contract (not per version).
   */
  async generateNextContractNumber(airportId: string): Promise<string> {
    const lastContract = await this.prisma.contract.findFirst({
      where: { airportId, version: 1 },
      orderBy: { contractNumber: 'desc' },
      select: { contractNumber: true },
    });

    if (!lastContract) {
      return 'CNT-001';
    }

    const match = lastContract.contractNumber.match(/^CNT-(\d+)$/);
    if (!match) {
      return 'CNT-001';
    }

    const nextNumber = parseInt(match[1], 10) + 1;
    return `CNT-${String(nextNumber).padStart(3, '0')}`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CRUD
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new contract in draft state with an auto-generated contract number.
   */
  async create(dto: CreateContractDto) {
    const contractNumber = await this.generateNextContractNumber(dto.airportId);

    return this.prisma.contract.create({
      data: {
        airportId: dto.airportId,
        tenantId: dto.tenantId,
        contractNumber,
        version: 1,
        status: ContractStatus.draft,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: new Date(dto.effectiveTo),
        ...(dto.annualMag !== undefined ? { annualMag: dto.annualMag } : {}),
        ...(dto.magCurrency !== undefined ? { magCurrency: dto.magCurrency } : {}),
        ...(dto.billingFrequency !== undefined ? { billingFrequency: dto.billingFrequency } : {}),
        ...(dto.responsibleOwner !== undefined ? { responsibleOwner: dto.responsibleOwner } : {}),
        ...(dto.escalationRule !== undefined
          ? { escalationRule: dto.escalationRule as Prisma.InputJsonValue }
          : {}),
        ...(dto.depositAmount !== undefined ? { depositAmount: dto.depositAmount } : {}),
        ...(dto.guaranteeType !== undefined ? { guaranteeType: dto.guaranteeType } : {}),
        ...(dto.guaranteeExpiry !== undefined
          ? { guaranteeExpiry: new Date(dto.guaranteeExpiry) }
          : {}),
        ...(dto.signedAt !== undefined ? { signedAt: new Date(dto.signedAt) } : {}),
      },
      include: {
        tenant: true,
        airport: true,
      },
    });
  }

  /**
   * List contracts with optional filters and pagination.
   * Returns { data, meta } pagination envelope.
   */
  async findAll(query: QueryContractsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.airportId) where.airportId = query.airportId;

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: true,
          airport: true,
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single contract by ID with full relations.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        tenant: true,
        airport: true,
        contractAreas: {
          include: { area: true },
        },
        contractServices: {
          include: {
            serviceDefinition: true,
            overrideFormula: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${id} not found`);
    }

    return contract;
  }

  /**
   * Update a draft contract's mutable fields.
   * Only draft contracts can be updated — throws BadRequestException otherwise.
   */
  async update(id: string, dto: UpdateContractDto) {
    const contract = await this.findOne(id);

    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException(
        `Only draft contracts can be updated. Current status: ${contract.status}`,
      );
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        ...(dto.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(dto.effectiveFrom) }
          : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo: new Date(dto.effectiveTo) } : {}),
        ...(dto.annualMag !== undefined ? { annualMag: dto.annualMag } : {}),
        ...(dto.magCurrency !== undefined ? { magCurrency: dto.magCurrency } : {}),
        ...(dto.billingFrequency !== undefined ? { billingFrequency: dto.billingFrequency } : {}),
        ...(dto.responsibleOwner !== undefined ? { responsibleOwner: dto.responsibleOwner } : {}),
        ...(dto.escalationRule !== undefined
          ? { escalationRule: dto.escalationRule as Prisma.InputJsonValue }
          : {}),
        ...(dto.depositAmount !== undefined ? { depositAmount: dto.depositAmount } : {}),
        ...(dto.guaranteeType !== undefined ? { guaranteeType: dto.guaranteeType } : {}),
        ...(dto.guaranteeExpiry !== undefined
          ? { guaranteeExpiry: new Date(dto.guaranteeExpiry) }
          : {}),
        ...(dto.signedAt !== undefined ? { signedAt: new Date(dto.signedAt) } : {}),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Machine Transition
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Transition a contract to a new status, validating against ALLOWED_TRANSITIONS.
   *
   * Side effects:
   * - published: sets publishedAt, emits `contract.published` event
   * - terminated: sets terminatedAt
   * - suspended/active/amended: simple status change
   */
  async transition(
    id: string,
    toStatus: ContractStatus,
    opts: { terminationReason?: string } = {},
  ) {
    const contract = await this.findOne(id);
    const fromStatus = contract.status as ContractStatus;

    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid state transition: ${fromStatus} → ${toStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    if (toStatus === ContractStatus.terminated && !opts.terminationReason) {
      throw new BadRequestException('terminationReason is required when transitioning to terminated');
    }

    const updateData: Record<string, unknown> = { status: toStatus };

    if (toStatus === ContractStatus.published) {
      updateData.publishedAt = new Date();
    }

    if (toStatus === ContractStatus.terminated) {
      updateData.terminatedAt = new Date();
      updateData.terminationReason = opts.terminationReason;
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: updateData,
    });

    // Emit event for downstream listeners (e.g., obligation generation)
    if (toStatus === ContractStatus.published && this.eventEmitter) {
      this.eventEmitter.emit('contract.published', { contractId: id });
    }

    this.logger.log(`Contract ${contract.contractNumber} transitioned: ${fromStatus} → ${toStatus}`);

    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Amendment Versioning
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create an amendment (new Contract row) for an active contract.
   *
   * Validations:
   * - Contract must be `active`
   * - effectiveFrom must be 1st of a future month (>= next month start)
   * - No existing `pending_amendment` for this contractNumber
   *
   * Creates: new Contract row with version+1, previousVersionId=id, status=pending_amendment.
   * Copies contractServices from old version with pricing overrides applied.
   */
  async amend(id: string, dto: AmendContractDto) {
    const contract = await this.findOne(id);

    if (contract.status !== ContractStatus.active) {
      throw new BadRequestException(
        `Only active contracts can be amended. Current status: ${contract.status}`,
      );
    }

    // Validate effectiveFrom is 1st of a future month
    const effectiveFrom = new Date(dto.effectiveFrom);
    const day = effectiveFrom.getUTCDate();
    if (day !== 1) {
      throw new BadRequestException(
        'Amendment effectiveFrom must be the 1st day of a month',
      );
    }

    // Must be >= next month start
    const now = new Date();
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    if (effectiveFrom < nextMonthStart) {
      throw new BadRequestException(
        'Amendment effectiveFrom must be a future period start (first day of a future month)',
      );
    }

    // Check for existing pending_amendment for this contract number
    const existingPending = await this.prisma.contract.findFirst({
      where: {
        contractNumber: contract.contractNumber,
        airportId: contract.airportId,
        status: ContractStatus.pending_amendment,
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        `A pending amendment already exists for contract ${contract.contractNumber}`,
      );
    }

    // Load existing contract services to copy to the new version
    const existingServices = await this.prisma.contractService.findMany({
      where: { contractId: id },
    });

    // Create new version in a transaction
    const newVersion = await this.prisma.$transaction(async (tx) => {
      const amendedContract = await tx.contract.create({
        data: {
          airportId: contract.airportId,
          tenantId: contract.tenantId,
          contractNumber: contract.contractNumber,
          version: contract.version + 1,
          previousVersionId: id,
          status: ContractStatus.pending_amendment,
          effectiveFrom,
          effectiveTo: contract.effectiveTo,
          // Apply pricing overrides from dto
          annualMag: dto.annualMag !== undefined ? dto.annualMag : contract.annualMag,
          magCurrency: dto.magCurrency !== undefined ? dto.magCurrency : contract.magCurrency,
          billingFrequency: contract.billingFrequency,
          responsibleOwner: contract.responsibleOwner,
          ...(contract.escalationRule !== null
            ? { escalationRule: contract.escalationRule as Prisma.InputJsonValue }
            : {}),
          depositAmount: contract.depositAmount ?? undefined,
          guaranteeType: contract.guaranteeType ?? undefined,
          guaranteeExpiry: contract.guaranteeExpiry ?? undefined,
          signedAt: contract.signedAt ?? undefined,
        },
      });

      // Copy contract services, applying customParameters override if provided
      if (existingServices.length > 0) {
        await tx.contractService.createMany({
          data: existingServices.map((cs) => ({
            contractId: amendedContract.id,
            serviceDefinitionId: cs.serviceDefinitionId,
            overrideFormulaId: cs.overrideFormulaId ?? undefined,
            overrideCurrency: cs.overrideCurrency ?? undefined,
            overrideBillingFreq: cs.overrideBillingFreq ?? undefined,
            customParameters:
              dto.customParameters !== undefined
                ? (dto.customParameters as Prisma.InputJsonValue)
                : cs.customParameters !== null
                  ? (cs.customParameters as Prisma.InputJsonValue)
                  : undefined,
            isActive: cs.isActive,
          })),
        });
      }

      return amendedContract;
    });

    this.logger.log(
      `Contract ${contract.contractNumber} amended: v${contract.version} → v${newVersion.version} (effective: ${dto.effectiveFrom})`,
    );

    return newVersion;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Version History
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get the full version history for a contract, with field-level diffs between consecutive versions.
   * Returns versions sorted ascending (v1, v2, v3...) with each version > 1 including a `diff` object.
   */
  async getVersionHistory(contractId: string) {
    // Load the requested contract first to get contractNumber + airportId
    const contract = await this.findOne(contractId);

    // Load all versions for this contract number (same airportId + contractNumber)
    const versions = await this.prisma.contract.findMany({
      where: {
        airportId: contract.airportId,
        contractNumber: contract.contractNumber,
      },
      orderBy: { version: 'asc' },
    });

    // Compute field-level diffs between consecutive versions
    return versions.map((version, index) => {
      if (index === 0) {
        return { ...version, diff: null };
      }

      const prev = versions[index - 1];
      const diff: Record<string, { old: unknown; new: unknown }> = {};

      for (const field of COMPARABLE_FIELDS) {
        const oldValue = prev[field as keyof typeof prev];
        const newValue = version[field as keyof typeof version];

        // Compare by string representation to handle Decimal/Date objects
        const oldStr = oldValue === null || oldValue === undefined ? null : String(oldValue);
        const newStr = newValue === null || newValue === undefined ? null : String(newValue);

        if (oldStr !== newStr) {
          diff[field] = { old: oldValue, new: newValue };
        }
      }

      return { ...version, diff };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Snapshot Helper
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a full contract snapshot with all relations as plain JSON.
   * Used by Phase 5 billing for JSONB storage (billing determinism).
   * JSON.parse(JSON.stringify()) ensures no Prisma proxy objects or circular refs.
   */
  async createSnapshot(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        tenant: true,
        airport: true,
        contractAreas: {
          include: { area: true },
        },
        contractServices: {
          include: {
            serviceDefinition: {
              include: { formula: true },
            },
            overrideFormula: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    return JSON.parse(JSON.stringify(contract)) as typeof contract;
  }
}
