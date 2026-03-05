import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import {
  BillingRunMode,
  BillingRunStatus,
  ObligationStatus,
} from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateBillingRunDto } from './dto/create-billing-run.dto';
import { ApproveBillingRunDto } from './dto/approve-billing-run.dto';
import { CancelTenantDto } from './dto/cancel-tenant.dto';
import { RerunBillingRunDto } from './dto/rerun-billing-run.dto';
import {
  validateBillingRunTransition,
  isTerminalStatus,
  TERMINAL_STATUSES,
} from './billing-run.state-machine';
import { BillingRunProgressEvent } from './events/billing-run-progress.event';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('billing-run') private readonly billingRunQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Create Billing Run
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new billing run and enqueue it for async processing.
   *
   * Enforces R8.7 concurrency rule: max 1 active billing run per airport+period.
   * Returns the created billing run with status=initiated.
   */
  async createBillingRun(dto: CreateBillingRunDto) {
    // Enforce concurrency rule R8.7
    const existingRun = await this.prisma.billingRun.findFirst({
      where: {
        airportId: dto.airportId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        status: { notIn: TERMINAL_STATUSES },
      },
    });

    if (existingRun) {
      throw new ConflictException(
        `Active billing run already exists for airport ${dto.airportId} ` +
          `and period ${dto.periodStart} to ${dto.periodEnd} (run ${existingRun.id}, status: ${existingRun.status})`,
      );
    }

    // Create billing run with status=initiated
    const billingRun = await this.prisma.billingRun.create({
      data: {
        airportId: dto.airportId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        runType: dto.runType ?? 'manual',
        runMode: dto.runMode ?? 'full',
        status: BillingRunStatus.initiated,
        filters: { tenantIds: dto.tenantIds ?? [] },
        previousRunId: dto.previousRunId ?? null,
      },
    });

    // Enqueue for async processing
    await this.billingRunQueue.add(
      'process-billing-run',
      { billingRunId: billingRun.id },
      {
        jobId: billingRun.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(
      `Billing run ${billingRun.id} created and enqueued for airport ${dto.airportId}`,
    );

    return billingRun;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Machine Transition
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Transition a billing run to a new status with validation.
   *
   * Sets completedAt for cancelled/completed/partial states.
   * Sets approvedBy/approvedAt when transitioning to approved.
   * Emits billing.progress event on every transition.
   */
  async transitionRun(
    id: string,
    toStatus: BillingRunStatus,
    opts?: { approvedBy?: string },
  ) {
    const billingRun = await this.prisma.billingRun.findUnique({
      where: { id },
    });

    if (!billingRun) {
      throw new NotFoundException(`Billing run ${id} not found`);
    }

    const currentStatus = billingRun.status as BillingRunStatus;

    if (!validateBillingRunTransition(currentStatus, toStatus)) {
      throw new BadRequestException(
        `Cannot transition billing run from '${currentStatus}' to '${toStatus}'`,
      );
    }

    const updateData: Record<string, unknown> = { status: toStatus };

    // Set completedAt for terminal states
    if (isTerminalStatus(toStatus)) {
      updateData.completedAt = new Date();
    }

    // Set approval fields
    if (toStatus === BillingRunStatus.approved && opts?.approvedBy) {
      updateData.approvedBy = opts.approvedBy;
      updateData.approvedAt = new Date();
    }

    const updated = await this.prisma.billingRun.update({
      where: { id },
      data: updateData,
    });

    // Emit progress event
    this.eventEmitter.emit(
      'billing.progress',
      new BillingRunProgressEvent(id, toStatus as BillingRunProgressEvent['phase'], 0),
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scope Obligations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Scope obligations for a billing run.
   *
   * Finds all obligations matching the airport, period, and status=ready.
   * In delta mode, excludes obligations that are already invoiced.
   * Links matched obligations to the billing run.
   */
  async scopeObligations(billingRunId: string) {
    const billingRun = await this.prisma.billingRun.findUnique({
      where: { id: billingRunId },
    });

    if (!billingRun) {
      throw new NotFoundException(`Billing run ${billingRunId} not found`);
    }

    const filters = billingRun.filters as { tenantIds?: string[] } | null;
    const tenantIds = filters?.tenantIds ?? [];

    // Build query
    const where: Record<string, unknown> = {
      airportId: billingRun.airportId,
      periodStart: billingRun.periodStart,
      periodEnd: billingRun.periodEnd,
      status: ObligationStatus.ready,
    };

    // Filter by tenantIds if specified
    if (tenantIds.length > 0) {
      where.tenantId = { in: tenantIds };
    }

    // Delta mode: exclude already-invoiced obligations
    if (billingRun.runMode === BillingRunMode.delta) {
      where.invoiceLogId = null;
    }

    const obligations = await this.prisma.obligation.findMany({ where });

    // Link obligations to billing run
    if (obligations.length > 0) {
      const obligationIds = obligations.map((o: { id: string }) => o.id);
      await this.prisma.obligation.updateMany({
        where: { id: { in: obligationIds } },
        data: { billingRunId },
      });
    }

    // Update total count
    await this.prisma.billingRun.update({
      where: { id: billingRunId },
      data: { totalObligations: obligations.length },
    });

    this.logger.log(
      `Scoped ${obligations.length} obligations for billing run ${billingRunId}`,
    );

    return obligations;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Contract Snapshot
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Freeze a JSONB snapshot of active contracts referenced by the billing run's obligations.
   *
   * Captures contract metadata, services, and areas at billing time for audit trail.
   */
  async createContractSnapshot(billingRunId: string) {
    const billingRun = await this.prisma.billingRun.findUnique({
      where: { id: billingRunId },
      include: { obligations: { select: { contractId: true } } },
    });

    if (!billingRun) {
      throw new NotFoundException(`Billing run ${billingRunId} not found`);
    }

    // Get unique contract IDs from obligations
    const contractIds = [
      ...new Set(
        billingRun.obligations.map((o: { contractId: string }) => o.contractId),
      ),
    ];

    if (contractIds.length === 0) {
      await this.prisma.billingRun.update({
        where: { id: billingRunId },
        data: { contractSnapshot: [] },
      });
      return;
    }

    // Fetch full contract data for snapshot
    const contracts = await this.prisma.contract.findMany({
      where: { id: { in: contractIds } },
      include: {
        contractServices: true,
        contractAreas: true,
      },
    });

    // Build snapshot array
    const snapshot = contracts.map((c) => ({
      id: c.id,
      contractNumber: c.contractNumber,
      version: c.version,
      tenantId: c.tenantId,
      contractServices: c.contractServices,
      contractAreas: c.contractAreas,
    }));

    await this.prisma.billingRun.update({
      where: { id: billingRunId },
      data: { contractSnapshot: snapshot },
    });

    this.logger.log(
      `Contract snapshot created for billing run ${billingRunId}: ${contractIds.length} contracts`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Approve / Reject / Cancel
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Approve a billing run (draft_ready -> approved).
   * Sets approvedBy and approvedAt.
   */
  async approveBillingRun(id: string, dto: ApproveBillingRunDto) {
    const billingRun = await this.prisma.billingRun.findUnique({
      where: { id },
    });

    if (!billingRun) {
      throw new NotFoundException(`Billing run ${id} not found`);
    }

    if (billingRun.status !== BillingRunStatus.draft_ready) {
      throw new BadRequestException(
        `Billing run must be in draft_ready to approve. Current: ${billingRun.status}`,
      );
    }

    return this.prisma.billingRun.update({
      where: { id },
      data: {
        status: BillingRunStatus.approved,
        approvedBy: dto.approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Reject a billing run (draft_ready -> rejected).
   */
  async rejectBillingRun(id: string) {
    const billingRun = await this.prisma.billingRun.findUnique({
      where: { id },
    });

    if (!billingRun) {
      throw new NotFoundException(`Billing run ${id} not found`);
    }

    if (billingRun.status !== BillingRunStatus.draft_ready) {
      throw new BadRequestException(
        `Billing run must be in draft_ready to reject. Current: ${billingRun.status}`,
      );
    }

    return this.prisma.billingRun.update({
      where: { id },
      data: {
        status: BillingRunStatus.rejected,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Cancel a billing run (any non-terminal -> cancelled).
   * Unlinks obligations (sets billingRunId=null) so they can be re-run.
   */
  async cancelBillingRun(id: string) {
    const result = await this.transitionRun(id, BillingRunStatus.cancelled);

    // Unlink obligations so they can be included in future runs
    await this.prisma.obligation.updateMany({
      where: { billingRunId: id },
      data: { billingRunId: null },
    });

    this.logger.log(`Billing run ${id} cancelled, obligations unlinked`);
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Partial Tenant Cancellation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cancel specific tenants from an in-progress billing run.
   *
   * Unlinks obligations for the specified tenants (sets billingRunId=null).
   * Tracks cancelled tenants in filters.cancelledTenants.
   * If ALL tenants are cancelled, transitions the entire run to cancelled.
   */
  async cancelTenants(billingRunId: string, dto: CancelTenantDto) {
    const billingRun = await this.prisma.billingRun.findUnique({
      where: { id: billingRunId },
    });

    if (!billingRun) {
      throw new NotFoundException(`Billing run ${billingRunId} not found`);
    }

    const currentStatus = billingRun.status as BillingRunStatus;
    if (isTerminalStatus(currentStatus)) {
      throw new BadRequestException(
        `Cannot cancel tenants from billing run in terminal state '${currentStatus}'`,
      );
    }

    // Unlink obligations for the specified tenants
    await this.prisma.obligation.updateMany({
      where: {
        billingRunId,
        tenantId: { in: dto.tenantIds },
      },
      data: { billingRunId: null },
    });

    // Update filters: track cancelled tenants
    const filters = billingRun.filters as {
      tenantIds?: string[];
      cancelledTenants?: string[];
    } | null;
    const existingCancelled = filters?.cancelledTenants ?? [];
    const updatedCancelled = [
      ...new Set([...existingCancelled, ...dto.tenantIds]),
    ];
    const allTenantIds = filters?.tenantIds ?? [];

    // Check if ALL tenants are now cancelled
    const allCancelled =
      allTenantIds.length > 0 &&
      allTenantIds.every((tid: string) => updatedCancelled.includes(tid));

    // Update filters with cancelled tenants
    const updatedRun = await this.prisma.billingRun.update({
      where: { id: billingRunId },
      data: {
        filters: { ...filters, cancelledTenants: updatedCancelled },
      },
    });

    // If ALL tenants cancelled, transition run to cancelled
    if (allCancelled) {
      await this.transitionRun(billingRunId, BillingRunStatus.cancelled);
    }

    // Emit progress event with updated tenant info
    this.eventEmitter.emit(
      'billing.progress',
      new BillingRunProgressEvent(
        billingRunId,
        currentStatus as BillingRunProgressEvent['phase'],
        0,
        `Cancelled tenants: ${dto.tenantIds.join(', ')}`,
      ),
    );

    this.logger.log(
      `Cancelled ${dto.tenantIds.length} tenant(s) from billing run ${billingRunId}` +
        (allCancelled ? ' — all tenants cancelled, run terminated' : ''),
    );

    return updatedRun;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Re-run Billing Run
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new billing run from a previous run.
   *
   * Run mode is determined by the previous run's status:
   * - cancelled -> full (re-do everything)
   * - completed -> delta (only new/changed obligations)
   * - partial -> delta (re-run failed tenants)
   * - rejected -> full (re-do everything)
   *
   * Rejects re-run from non-terminal states (still in progress).
   */
  async rerunBillingRun(dto: RerunBillingRunDto) {
    const previousRun = await this.prisma.billingRun.findUnique({
      where: { id: dto.previousRunId },
    });

    if (!previousRun) {
      throw new NotFoundException(
        `Previous billing run ${dto.previousRunId} not found`,
      );
    }

    const prevStatus = previousRun.status as BillingRunStatus;

    if (!isTerminalStatus(prevStatus)) {
      throw new BadRequestException(
        `Cannot re-run billing run in non-terminal state '${prevStatus}'. ` +
          `Cancel or wait for completion first.`,
      );
    }

    // Determine run mode based on previous run status
    let runMode: BillingRunMode;
    if (
      prevStatus === BillingRunStatus.cancelled ||
      prevStatus === BillingRunStatus.rejected
    ) {
      runMode = BillingRunMode.full;
    } else {
      // completed or partial -> delta
      runMode = BillingRunMode.delta;
    }

    const filters = previousRun.filters as {
      tenantIds?: string[];
    } | null;

    // Create new billing run reusing previous run's parameters
    return this.createBillingRun({
      airportId: previousRun.airportId,
      periodStart: previousRun.periodStart.toISOString().split('T')[0],
      periodEnd: previousRun.periodEnd.toISOString().split('T')[0],
      tenantIds: filters?.tenantIds,
      runMode,
      previousRunId: dto.previousRunId,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List billing runs with pagination and filtering.
   */
  async findAll(query: {
    airportId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.airportId) where.airportId = query.airportId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.billingRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.billingRun.count({ where }),
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
   * Get a single billing run by ID with obligation count.
   */
  async findOne(id: string) {
    const billingRun = await this.prisma.billingRun.findUnique({
      where: { id },
      include: {
        _count: { select: { obligations: true } },
      },
    });

    if (!billingRun) {
      throw new NotFoundException(`Billing run ${id} not found`);
    }

    return billingRun;
  }
}
