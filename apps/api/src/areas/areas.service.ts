import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AreaType } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

/** Ordered area types matching hierarchy depth (index + 1 = depth). */
const AREA_TYPE_DEPTH: Record<AreaType, number> = {
  [AreaType.terminal]: 1,
  [AreaType.floor]: 2,
  [AreaType.zone]: 3,
  [AreaType.unit]: 4,
};

/** Expected child type for each parent type. */
const EXPECTED_CHILD_TYPE: Record<AreaType, AreaType> = {
  [AreaType.terminal]: AreaType.floor,
  [AreaType.floor]: AreaType.zone,
  [AreaType.zone]: AreaType.unit,
  [AreaType.unit]: AreaType.unit, // unit cannot have children (depth violation will catch this)
};

/** Deep-include shape reused by findTree and findRoots. */
const TREE_INCLUDE = {
  children: {
    include: {
      children: {
        include: { children: true },
      },
    },
  },
};

export interface AreaFilters {
  areaType?: AreaType;
  isLeasable?: boolean;
}

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return a flat list of all areas for an airport with optional filters.
   */
  async findAll(airportId: string, filters?: AreaFilters) {
    const where: Record<string, unknown> = { airportId };

    if (filters?.areaType !== undefined) {
      where.areaType = filters.areaType;
    }
    if (filters?.isLeasable !== undefined) {
      where.isLeasable = filters.isLeasable;
    }

    return this.prisma.area.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Return a single area with its immediate parent and children.
   */
  async findOne(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });

    if (!area) {
      throw new NotFoundException(`Area ${id} not found`);
    }

    return area;
  }

  /**
   * Return a full subtree (up to 3 levels deep) rooted at the given area.
   */
  async findTree(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: TREE_INCLUDE,
    });

    if (!area) {
      throw new NotFoundException(`Area ${id} not found`);
    }

    return area;
  }

  /**
   * Return all root-level areas (terminal) for an airport with full subtrees.
   */
  async findRoots(airportId: string) {
    return this.prisma.area.findMany({
      where: { airportId, parentAreaId: null },
      include: TREE_INCLUDE,
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Create a new area, enforcing hierarchy depth (max 4) and areaType ordering.
   */
  async create(dto: CreateAreaDto) {
    if (dto.parentAreaId) {
      // Fetch the parent to validate depth and type constraints
      const parent = await this.prisma.area.findUnique({
        where: { id: dto.parentAreaId },
      });

      if (!parent) {
        throw new NotFoundException(`Parent area ${dto.parentAreaId} not found`);
      }

      const parentDepth = AREA_TYPE_DEPTH[parent.areaType as AreaType];

      // Depth check: parent at depth 4 (unit) cannot have children
      if (parentDepth >= 4) {
        throw new BadRequestException('Maximum area depth of 4 exceeded');
      }

      // areaType must match expected child type for the parent
      const expectedChildType = EXPECTED_CHILD_TYPE[parent.areaType as AreaType];
      if (dto.areaType !== expectedChildType) {
        throw new BadRequestException(
          `Invalid areaType '${dto.areaType}' under '${parent.areaType}'. Expected '${expectedChildType}'.`,
        );
      }
    } else {
      // Root-level area must be a terminal
      if (dto.areaType !== AreaType.terminal) {
        throw new BadRequestException(
          `Root-level areas must have areaType 'terminal', got '${dto.areaType}'.`,
        );
      }
    }

    return this.prisma.area.create({ data: dto });
  }

  /**
   * Update an existing area. airportId and parentAreaId are immutable.
   */
  async update(id: string, dto: UpdateAreaDto) {
    await this.findOne(id);

    return this.prisma.area.update({
      where: { id },
      data: dto,
    });
  }
}
