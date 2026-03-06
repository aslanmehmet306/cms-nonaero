import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OccupancyStatus, OccupancyType } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateAreaOccupancyDto } from './dto/create-area-occupancy.dto';
import { UpdateAreaOccupancyDto } from './dto/update-area-occupancy.dto';
import { QueryAreaOccupanciesDto } from './dto/query-area-occupancies.dto';

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ALLOWED_TRANSITIONS defines valid state machine transitions.
 * Keys are the FROM state; values are valid TO states.
 *
 * Terminal state (vacated) has an empty array.
 */
const ALLOWED_TRANSITIONS: Record<OccupancyStatus, OccupancyStatus[]> = {
  [OccupancyStatus.planned]: [
    OccupancyStatus.occupied,
    OccupancyStatus.under_renovation,
  ],
  [OccupancyStatus.occupied]: [
    OccupancyStatus.vacated,
    OccupancyStatus.under_renovation,
  ],
  [OccupancyStatus.under_renovation]: [
    OccupancyStatus.planned,
    OccupancyStatus.occupied,
  ],
  [OccupancyStatus.vacated]: [], // terminal
};

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AreaOccupanciesService {
  private readonly logger = new Logger(AreaOccupanciesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Create
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new area occupancy in planned state.
   *
   * Validation:
   * - If occupancyType=exclusive, reject when an overlapping exclusive occupancy exists.
   * - occupiedM2 must not exceed area.areaM2.
   * - For shared occupancy, SUM(existing occupiedM2) + new must not exceed area.areaM2.
   */
  async create(dto: CreateAreaOccupancyDto) {
    // Validate area exists and get its total m2
    const area: { id: string; areaM2: unknown } | null =
      await this.prisma.area.findUnique({
        where: { id: dto.areaId },
        select: { id: true, areaM2: true },
      });

    if (!area) {
      throw new NotFoundException(`Area ${dto.areaId} not found`);
    }

    const areaM2 = area.areaM2 ? parseFloat(String(area.areaM2)) : null;

    // Validate occupiedM2 does not exceed area total
    if (dto.occupiedM2 !== undefined && areaM2 !== null) {
      const occupiedM2 = parseFloat(dto.occupiedM2);
      if (occupiedM2 > areaM2) {
        throw new BadRequestException(
          `occupiedM2 (${occupiedM2}) exceeds area total (${areaM2})`,
        );
      }
    }

    const newFrom = new Date(dto.occupiedFrom);
    const newTo = dto.occupiedTo ? new Date(dto.occupiedTo) : null;

    // For exclusive occupancy, check for overlapping exclusive occupancies
    if (dto.occupancyType === OccupancyType.exclusive) {
      await this.validateNoExclusiveOverlap(dto.areaId, newFrom, newTo);
    }

    // For shared occupancy, validate total m2 does not exceed area
    if (
      dto.occupancyType === OccupancyType.shared &&
      dto.occupiedM2 !== undefined &&
      areaM2 !== null
    ) {
      await this.validateSharedM2(
        dto.areaId,
        parseFloat(dto.occupiedM2),
        areaM2,
        newFrom,
        newTo,
      );
    }

    return this.prisma.areaOccupancy.create({
      data: {
        areaId: dto.areaId,
        ...(dto.tenantId !== undefined ? { tenantId: dto.tenantId } : {}),
        ...(dto.contractId !== undefined
          ? { contractId: dto.contractId }
          : {}),
        occupancyType: dto.occupancyType,
        status: OccupancyStatus.planned,
        occupiedFrom: newFrom,
        ...(newTo ? { occupiedTo: newTo } : {}),
        ...(dto.occupiedM2 !== undefined
          ? { occupiedM2: dto.occupiedM2 }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Read
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * List area occupancies with optional filters and pagination.
   * Returns { data, meta } pagination envelope.
   */
  async findAll(query: QueryAreaOccupanciesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.areaId) where.areaId = query.areaId;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;
    if (query.occupancyType) where.occupancyType = query.occupancyType;

    const [data, total] = await Promise.all([
      this.prisma.areaOccupancy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occupiedFrom: 'desc' },
        include: {
          area: true,
          tenant: true,
        },
      }),
      this.prisma.areaOccupancy.count({ where }),
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
   * Get a single area occupancy by ID with full relations.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const occupancy = await this.prisma.areaOccupancy.findUnique({
      where: { id },
      include: {
        area: true,
        tenant: true,
        contract: true,
      },
    });

    if (!occupancy) {
      throw new NotFoundException(`AreaOccupancy ${id} not found`);
    }

    return occupancy;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Update
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Update an area occupancy's mutable fields.
   */
  async update(id: string, dto: UpdateAreaOccupancyDto) {
    const occupancy = await this.prisma.areaOccupancy.findUnique({
      where: { id },
    });

    if (!occupancy) {
      throw new NotFoundException(`AreaOccupancy ${id} not found`);
    }

    return this.prisma.areaOccupancy.update({
      where: { id },
      data: {
        ...(dto.tenantId !== undefined ? { tenantId: dto.tenantId } : {}),
        ...(dto.contractId !== undefined
          ? { contractId: dto.contractId }
          : {}),
        ...(dto.occupancyType !== undefined
          ? { occupancyType: dto.occupancyType }
          : {}),
        ...(dto.occupiedFrom !== undefined
          ? { occupiedFrom: new Date(dto.occupiedFrom) }
          : {}),
        ...(dto.occupiedTo !== undefined
          ? { occupiedTo: new Date(dto.occupiedTo) }
          : {}),
        ...(dto.occupiedM2 !== undefined
          ? { occupiedM2: dto.occupiedM2 }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Machine Transition
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Transition an area occupancy to a new status, validating against ALLOWED_TRANSITIONS.
   *
   * Side effects:
   * - vacated: sets occupiedTo to now() if not already set
   */
  async transition(id: string, toStatus: OccupancyStatus) {
    const occupancy = await this.findOne(id);
    const fromStatus = occupancy.status as OccupancyStatus;

    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid state transition: ${fromStatus} -> ${toStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const updateData: Record<string, unknown> = { status: toStatus };

    // When transitioning to vacated, auto-set occupiedTo if not already set
    if (toStatus === OccupancyStatus.vacated && !occupancy.occupiedTo) {
      updateData.occupiedTo = new Date();
    }

    return this.prisma.areaOccupancy.update({
      where: { id },
      data: updateData,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Validation Helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Validate that no exclusive occupancy overlaps with the given date range on the same area.
   * Overlap condition: existingFrom < newTo AND (existingTo > newFrom OR existingTo is null)
   */
  private async validateNoExclusiveOverlap(
    areaId: string,
    newFrom: Date,
    newTo: Date | null,
  ): Promise<void> {
    // Build the overlap condition
    // Two ranges overlap when: start1 < end2 AND start2 < end1
    // When either end is null, treat as open-ended (infinite)
    const overlapWhere: Record<string, unknown> = {
      areaId,
      occupancyType: OccupancyType.exclusive,
      status: { not: OccupancyStatus.vacated },
    };

    // existingFrom < newTo (if newTo exists)
    // AND (existingTo > newFrom OR existingTo is null)
    if (newTo) {
      overlapWhere.occupiedFrom = { lt: newTo };
    }
    overlapWhere.OR = [
      { occupiedTo: { gt: newFrom } },
      { occupiedTo: null },
    ];

    const existing = await this.prisma.areaOccupancy.findFirst({
      where: overlapWhere,
    });

    if (existing) {
      throw new BadRequestException(
        'An exclusive occupancy already exists for this area in the given date range',
      );
    }
  }

  /**
   * Validate that total shared m2 (existing + new) does not exceed area total.
   */
  private async validateSharedM2(
    areaId: string,
    newM2: number,
    areaM2: number,
    newFrom: Date,
    newTo: Date | null,
  ): Promise<void> {
    // Find all overlapping shared occupancies on the same area
    const overlapWhere: Record<string, unknown> = {
      areaId,
      occupancyType: OccupancyType.shared,
      status: { not: OccupancyStatus.vacated },
    };

    if (newTo) {
      overlapWhere.occupiedFrom = { lt: newTo };
    }
    overlapWhere.OR = [
      { occupiedTo: { gt: newFrom } },
      { occupiedTo: null },
    ];

    const existingOccupancies: Array<{ occupiedM2: unknown }> =
      await this.prisma.areaOccupancy.findMany({
        where: overlapWhere,
        select: { occupiedM2: true },
      });

    let totalExistingM2 = 0;
    for (const occ of existingOccupancies) {
      if (occ.occupiedM2) {
        totalExistingM2 += parseFloat(String(occ.occupiedM2));
      }
    }

    if (totalExistingM2 + newM2 > areaM2) {
      throw new BadRequestException(
        `Total shared m2 (${totalExistingM2} + ${newM2} = ${totalExistingM2 + newM2}) exceeds area total (${areaM2})`,
      );
    }
  }
}
