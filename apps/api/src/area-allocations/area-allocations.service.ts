import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AllocationStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateAreaAllocationDto } from './dto/create-area-allocation.dto';
import { UpdateAreaAllocationDto } from './dto/update-area-allocation.dto';
import { QueryAreaAllocationsDto } from './dto/query-area-allocations.dto';
import { UpsertShareDto } from './dto/upsert-share.dto';

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ALLOWED_TRANSITIONS defines valid state machine transitions.
 * Keys are the FROM state; values are valid TO states.
 *
 * Terminal states (archived_alloc) have empty arrays.
 */
const ALLOWED_TRANSITIONS: Record<AllocationStatus, AllocationStatus[]> = {
  [AllocationStatus.draft]: [AllocationStatus.approved_alloc],
  [AllocationStatus.approved_alloc]: [AllocationStatus.active_alloc, AllocationStatus.draft],
  [AllocationStatus.active_alloc]: [AllocationStatus.archived_alloc],
  [AllocationStatus.archived_alloc]: [], // terminal
};

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AreaAllocationsService {
  private readonly logger = new Logger(AreaAllocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // CRUD
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new area allocation in draft status.
   * Validates that the referenced area exists.
   */
  async create(dto: CreateAreaAllocationDto) {
    const area = await this.prisma.area.findUnique({
      where: { id: dto.areaId },
    });

    if (!area) {
      throw new NotFoundException(`Area ${dto.areaId} not found`);
    }

    return this.prisma.areaAllocation.create({
      data: {
        airportId: dto.airportId,
        areaId: dto.areaId,
        allocationMethod: dto.allocationMethod,
        periodStart: new Date(dto.periodStart),
        ...(dto.periodEnd ? { periodEnd: new Date(dto.periodEnd) } : {}),
        ...(dto.totalCost !== undefined ? { totalCost: dto.totalCost } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        status: AllocationStatus.draft,
      },
    });
  }

  /**
   * List area allocations with optional filters and pagination.
   * Returns { data, meta } pagination envelope.
   */
  async findAll(query: QueryAreaAllocationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.airportId) where.airportId = query.airportId;
    if (query.areaId) where.areaId = query.areaId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.areaAllocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          area: true,
        },
      }),
      this.prisma.areaAllocation.count({ where }),
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
   * Get a single area allocation by ID with full relations.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const allocation = await this.prisma.areaAllocation.findUnique({
      where: { id },
      include: {
        area: true,
        shares: {
          include: { tenant: true },
        },
      },
    });

    if (!allocation) {
      throw new NotFoundException(`Area allocation ${id} not found`);
    }

    return allocation;
  }

  /**
   * Update a draft area allocation's mutable fields.
   * Only draft allocations can be updated -- throws BadRequestException otherwise.
   */
  async update(id: string, dto: UpdateAreaAllocationDto) {
    const allocation = await this.findOne(id);

    if (allocation.status !== AllocationStatus.draft) {
      throw new BadRequestException(
        `Only draft allocations can be updated. Current status: ${allocation.status}`,
      );
    }

    return this.prisma.areaAllocation.update({
      where: { id },
      data: {
        ...(dto.allocationMethod !== undefined ? { allocationMethod: dto.allocationMethod } : {}),
        ...(dto.periodStart !== undefined ? { periodStart: new Date(dto.periodStart) } : {}),
        ...(dto.periodEnd !== undefined ? { periodEnd: new Date(dto.periodEnd) } : {}),
        ...(dto.totalCost !== undefined ? { totalCost: dto.totalCost } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Machine Transition
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Transition an area allocation to a new status, validating against ALLOWED_TRANSITIONS.
   *
   * Side effects:
   * - approved_alloc: validates SUM(shareRatio) == 1.0 (tolerance +/- 0.0001),
   *   sets approvedBy, approvedAt
   */
  async transition(id: string, toStatus: AllocationStatus) {
    const allocation = await this.findOne(id);
    const fromStatus = allocation.status as AllocationStatus;

    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid state transition: ${fromStatus} -> ${toStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const updateData: Record<string, unknown> = { status: toStatus };

    // On approval, validate share ratio sum and set approval metadata
    if (toStatus === AllocationStatus.approved_alloc) {
      const shares = await this.prisma.areaAllocationShare.findMany({
        where: { allocationId: id },
      });

      const sum = shares.reduce(
        (acc, s) => acc + parseFloat(String(s.shareRatio)),
        0,
      );

      if (Math.abs(sum - 1.0) >= 0.0001) {
        throw new BadRequestException(
          `Share ratios must sum to 1.0 (current sum: ${sum.toFixed(8)})`,
        );
      }

      updateData.approvedBy = 'system';
      updateData.approvedAt = new Date();
    }

    const updated = await this.prisma.areaAllocation.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(
      `Area allocation ${id} transitioned: ${fromStatus} -> ${toStatus}`,
    );

    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Shares
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Upsert a share for a draft area allocation.
   * Uses composite unique key [allocationId, tenantId].
   */
  async upsertShare(allocationId: string, dto: UpsertShareDto) {
    const allocation = await this.findOne(allocationId);

    if (allocation.status !== AllocationStatus.draft) {
      throw new BadRequestException(
        `Shares can only be modified on draft allocations. Current status: ${allocation.status}`,
      );
    }

    return this.prisma.areaAllocationShare.upsert({
      where: {
        allocationId_tenantId: {
          allocationId,
          tenantId: dto.tenantId,
        },
      },
      create: {
        allocationId,
        tenantId: dto.tenantId,
        shareRatio: dto.shareRatio,
        ...(dto.contractId !== undefined ? { contractId: dto.contractId } : {}),
        ...(dto.fixedAmount !== undefined ? { fixedAmount: dto.fixedAmount } : {}),
      },
      update: {
        shareRatio: dto.shareRatio,
        ...(dto.contractId !== undefined ? { contractId: dto.contractId } : {}),
        ...(dto.fixedAmount !== undefined ? { fixedAmount: dto.fixedAmount } : {}),
      },
    });
  }

  /**
   * List all shares for a given area allocation with tenant info.
   */
  async listShares(allocationId: string) {
    return this.prisma.areaAllocationShare.findMany({
      where: { allocationId },
      include: { tenant: true },
    });
  }

  /**
   * Remove a share from a draft allocation.
   */
  async removeShare(allocationId: string, tenantId: string) {
    const allocation = await this.findOne(allocationId);

    if (allocation.status !== AllocationStatus.draft) {
      throw new BadRequestException(
        `Shares can only be removed from draft allocations. Current status: ${allocation.status}`,
      );
    }

    return this.prisma.areaAllocationShare.delete({
      where: {
        allocationId_tenantId: {
          allocationId,
          tenantId,
        },
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate Shares
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Auto-calculate calculatedAmount = totalCost * shareRatio for all shares.
   * Only available on approved_alloc or active_alloc allocations.
   */
  async calculateShares(allocationId: string) {
    const allocation = await this.findOne(allocationId);

    if (
      allocation.status !== AllocationStatus.approved_alloc &&
      allocation.status !== AllocationStatus.active_alloc
    ) {
      throw new BadRequestException(
        `Shares can only be calculated on approved or active allocations. Current status: ${allocation.status}`,
      );
    }

    const totalCost = parseFloat(String(allocation.totalCost ?? '0'));

    const shares = await this.prisma.areaAllocationShare.findMany({
      where: { allocationId },
    });

    const updates = shares.map((share) => {
      const ratio = parseFloat(String(share.shareRatio));
      const calculatedAmount = (totalCost * ratio).toFixed(2);

      return this.prisma.areaAllocationShare.update({
        where: { id: share.id },
        data: { calculatedAmount },
      });
    });

    await Promise.all(updates);

    return this.prisma.areaAllocationShare.findMany({
      where: { allocationId },
      include: { tenant: true },
    });
  }
}
