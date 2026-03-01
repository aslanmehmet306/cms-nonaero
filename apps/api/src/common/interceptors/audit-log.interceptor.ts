import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AUDIT_KEY } from '../decorators/audit.decorator';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';

/** Map HTTP methods to audit action types. */
const METHOD_ACTION_MAP: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const entityType = this.reflector.get<string>(AUDIT_KEY, context.getHandler());

    // No @Audit() decorator -- pass through
    if (!entityType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const action = METHOD_ACTION_MAP[method];

    // GET requests are never audited
    if (!action) {
      return next.handle();
    }

    // For UPDATE / DELETE, capture the before-state
    let previousState: Record<string, unknown> | null = null;
    const entityId = request.params.id;

    if ((action === 'UPDATE' || action === 'DELETE') && entityId) {
      try {
        const modelName = this.resolveModelName(entityType);
        const delegate = (this.prisma as unknown as Record<string, unknown>)[modelName] as
          | { findUnique: (args: { where: { id: string } }) => Promise<unknown> }
          | undefined;
        if (delegate?.findUnique) {
          previousState = (await delegate.findUnique({ where: { id: entityId } })) as Record<
            string,
            unknown
          > | null;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch before-state for ${entityType}:${entityId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          // Fire-and-forget -- do not await, do not block the response
          const resolvedEntityId =
            entityId || (responseData as Record<string, unknown>)?.id?.toString() || 'unknown';

          this.auditService
            .log({
              action,
              entityType,
              entityId: resolvedEntityId,
              previousState,
              newState: responseData as Record<string, unknown> | null,
            })
            .catch((err) => {
              this.logger.warn(
                `Audit log fire-and-forget failed: ${err instanceof Error ? err.message : String(err)}`,
              );
            });
        },
        error: () => {
          // If the handler throws, we do not create an audit entry
        },
      }),
    );
  }

  /**
   * Convert entity type to Prisma delegate name (lowercase first char).
   * e.g. 'User' -> 'user', 'AuditLog' -> 'auditLog'
   */
  private resolveModelName(entityType: string): string {
    return entityType.charAt(0).toLowerCase() + entityType.slice(1);
  }
}
