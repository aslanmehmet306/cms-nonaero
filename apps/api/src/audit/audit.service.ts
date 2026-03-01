import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../database/prisma.service';
import { QueryAuditDto } from './dto/query-audit.dto';

/** Fields that must never appear in audit snapshots. */
const SENSITIVE_FIELDS = ['passwordHash', 'refreshToken', 'password', 'secret', 'token'];

export interface AuditLogParams {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Strip sensitive fields from an object before storing in audit log.
   * Operates on a shallow copy to avoid mutating the original.
   */
  sanitize(obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!obj) return null;
    const sanitized = { ...obj };
    for (const field of SENSITIVE_FIELDS) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }
    return sanitized;
  }

  /**
   * Create an audit log entry with before/after JSONB snapshots.
   * Actor and airportId are pulled from CLS context automatically.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      const actor = (this.cls.get('userId') as string) || 'system';
      const airportId = (this.cls.get('airportId') as string) || 'unknown';

      await this.prisma.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          actor,
          airportId,
          previousState: this.sanitize(params.previousState) as Prisma.InputJsonValue,
          newState: this.sanitize(params.newState) as Prisma.InputJsonValue,
          metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
        },
      });
    } catch (error) {
      // Audit logging failure must NOT break the parent request
      this.logger.warn(
        `Failed to create audit log for ${params.action} ${params.entityType}:${params.entityId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Paginated query for audit logs with optional filters.
   */
  async findAll(query: QueryAuditDto) {
    const { entityType, entityId, actor, dateFrom, dateTo, page = 1, perPage = 25 } = query;

    const where: Prisma.AuditLogWhereInput = {};

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (actor) where.actor = actor;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get full audit history for a specific entity, ordered newest first.
   */
  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
