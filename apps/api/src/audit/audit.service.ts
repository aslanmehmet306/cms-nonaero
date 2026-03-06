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

export interface FieldDiff {
  field: string;
  from: unknown;
  to: unknown;
}

export interface TimelineEntry {
  timestamp: Date;
  action: string;
  actor: string;
  changes: FieldDiff[];
}

export interface EntityTimelineResponse {
  entityType: string;
  entityId: string;
  enrichment: Record<string, unknown> | null;
  timeline: TimelineEntry[];
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

  // --------------------------------------------------------------------------
  // Entity Timeline & Drill-down (R12.8)
  // --------------------------------------------------------------------------

  /** Internal fields excluded from field-level diffs (noisy, not useful). */
  private static readonly SKIP_DIFF_FIELDS = new Set(['updatedAt', 'createdAt']);

  /**
   * Compute field-level diffs between two state snapshots.
   *
   * - CREATE (previousState=null): every newState field is a new addition
   * - DELETE (newState=null): every previousState field is a removal
   * - UPDATE: only changed fields (deep equality via JSON.stringify)
   */
  diffStates(
    previousState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
  ): FieldDiff[] {
    if (!previousState && !newState) return [];

    // CREATE — all new fields
    if (!previousState) {
      return Object.entries(newState!).map(([field, value]) => ({
        field,
        from: null,
        to: value,
      }));
    }

    // DELETE — all removed fields
    if (!newState) {
      return Object.entries(previousState).map(([field, value]) => ({
        field,
        from: value,
        to: null,
      }));
    }

    // UPDATE — only changed fields
    const allKeys = new Set([...Object.keys(previousState), ...Object.keys(newState)]);
    const diffs: FieldDiff[] = [];

    for (const field of allKeys) {
      if (AuditService.SKIP_DIFF_FIELDS.has(field)) continue;

      const prev = previousState[field];
      const next = newState[field];

      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        diffs.push({ field, from: prev, to: next });
      }
    }

    return diffs;
  }

  /**
   * Get entity timeline combining audit log entries with domain-specific
   * context enrichment:
   * - Obligation: calculationTrace, status, amount, currency, chargeType
   * - Contract: contractNumber, version, status, obligationCount
   * - All others: no enrichment (generic audit trail)
   */
  async getEntityTimeline(
    entityType: string,
    entityId: string,
  ): Promise<EntityTimelineResponse> {
    // Reuse existing findByEntity (already ordered desc by createdAt)
    const auditEntries = await this.findByEntity(entityType, entityId);

    // Map audit entries to timeline with field-level diffs
    const timeline: TimelineEntry[] = auditEntries.map((entry) => ({
      timestamp: entry.createdAt,
      action: entry.action,
      actor: entry.actor,
      changes: this.diffStates(
        entry.previousState as Record<string, unknown> | null,
        entry.newState as Record<string, unknown> | null,
      ),
    }));

    // Domain-specific enrichment
    let enrichment: Record<string, unknown> | null = null;

    if (entityType === 'Obligation') {
      const obligation = await this.prisma.obligation.findUnique({
        where: { id: entityId },
        select: {
          calculationTrace: true,
          status: true,
          amount: true,
          currency: true,
          chargeType: true,
        },
      });
      if (obligation) {
        enrichment = {
          calculationTrace: obligation.calculationTrace,
          status: obligation.status,
          amount: obligation.amount,
          currency: obligation.currency,
          chargeType: obligation.chargeType,
        };
      }
    } else if (entityType === 'Contract') {
      const contract = await this.prisma.contract.findUnique({
        where: { id: entityId },
        select: {
          contractNumber: true,
          version: true,
          status: true,
          _count: { select: { obligations: true } },
        },
      });
      if (contract) {
        enrichment = {
          contractNumber: contract.contractNumber,
          version: contract.version,
          status: contract.status,
          obligationCount: contract._count.obligations,
        };
      }
    }

    return { entityType, entityId, enrichment, timeline };
  }
}
