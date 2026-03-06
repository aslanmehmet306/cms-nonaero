import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTenantGroupDto } from './dto/create-tenant-group.dto';
import { UpdateTenantGroupDto } from './dto/update-tenant-group.dto';

@Injectable()
export class TenantGroupsService {
  private readonly logger = new Logger(TenantGroupsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate the next sequential group code for a given airport.
   * Format: GRP-001, GRP-002, ..., GRP-999, GRP-1000, ...
   */
  async generateNextGroupCode(airportId: string): Promise<string> {
    const lastGroup = await this.prisma.tenantGroup.findFirst({
      where: { airportId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    if (!lastGroup) {
      return 'GRP-001';
    }

    const match = lastGroup.code.match(/^GRP-(\d+)$/);
    if (!match) {
      return 'GRP-001';
    }

    const nextNumber = parseInt(match[1], 10) + 1;
    return `GRP-${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Validate that a parentGroupId does not create a circular reference.
   * Walks up the parent chain to ensure the target group is never an ancestor.
   */
  private async validateNoCircularRef(
    groupId: string,
    parentGroupId: string,
  ): Promise<void> {
    let currentId: string | null = parentGroupId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === groupId) {
        throw new BadRequestException(
          'Circular group hierarchy detected: a group cannot be its own ancestor',
        );
      }
      if (visited.has(currentId)) {
        break; // Prevent infinite loop on corrupted data
      }
      visited.add(currentId);

      const parentRecord: { parentGroupId: string | null } | null =
        await this.prisma.tenantGroup.findUnique({
          where: { id: currentId },
          select: { parentGroupId: true },
        });
      currentId = parentRecord?.parentGroupId ?? null;
    }
  }

  /**
   * Create a new tenant group with auto-generated code.
   */
  async create(dto: CreateTenantGroupDto) {
    const code = await this.generateNextGroupCode(dto.airportId);

    // Validate parent belongs to same airport if provided
    if (dto.parentGroupId) {
      const parent = await this.prisma.tenantGroup.findUnique({
        where: { id: dto.parentGroupId },
        select: { airportId: true },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent group ${dto.parentGroupId} not found`,
        );
      }
      if (parent.airportId !== dto.airportId) {
        throw new BadRequestException(
          'Parent group must belong to the same airport',
        );
      }
    }

    return this.prisma.tenantGroup.create({
      data: {
        code,
        name: dto.name,
        airportId: dto.airportId,
        parentGroupId: dto.parentGroupId,
        taxId: dto.taxId,
        contactEmail: dto.contactEmail,
      },
    });
  }

  /**
   * List groups with optional filters and pagination.
   */
  async findAll(
    airportId?: string,
    isActive?: boolean,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      ...(airportId ? { airportId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.tenantGroup.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          _count: { select: { tenants: true, childGroups: true } },
        },
      }),
      this.prisma.tenantGroup.count({ where }),
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
   * Get a single group by ID with full relations.
   */
  async findOne(id: string) {
    const group = await this.prisma.tenantGroup.findUnique({
      where: { id },
      include: {
        airport: true,
        parentGroup: true,
        childGroups: true,
        tenants: true,
      },
    });

    if (!group) {
      throw new NotFoundException(`Tenant group ${id} not found`);
    }

    return group;
  }

  /**
   * Update group fields. Validates parent group constraints.
   */
  async update(id: string, dto: UpdateTenantGroupDto) {
    const group = await this.prisma.tenantGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException(`Tenant group ${id} not found`);
    }

    // Validate parent change
    if (dto.parentGroupId !== undefined && dto.parentGroupId !== null) {
      if (dto.parentGroupId === id) {
        throw new BadRequestException('A group cannot be its own parent');
      }

      const parent = await this.prisma.tenantGroup.findUnique({
        where: { id: dto.parentGroupId },
        select: { airportId: true },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent group ${dto.parentGroupId} not found`,
        );
      }
      if (parent.airportId !== group.airportId) {
        throw new BadRequestException(
          'Parent group must belong to the same airport',
        );
      }

      await this.validateNoCircularRef(id, dto.parentGroupId);
    }

    return this.prisma.tenantGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.parentGroupId !== undefined
          ? { parentGroupId: dto.parentGroupId }
          : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId } : {}),
        ...(dto.contactEmail !== undefined
          ? { contactEmail: dto.contactEmail }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /**
   * Get the full hierarchy tree for a group (ancestors + descendants).
   */
  async getHierarchy(id: string) {
    const group = await this.prisma.tenantGroup.findUnique({
      where: { id },
      include: {
        parentGroup: true,
        childGroups: {
          include: {
            childGroups: {
              include: {
                childGroups: true, // 3 levels deep
              },
            },
          },
        },
        tenants: { select: { id: true, code: true, name: true, status: true } },
      },
    });

    if (!group) {
      throw new NotFoundException(`Tenant group ${id} not found`);
    }

    return group;
  }
}
