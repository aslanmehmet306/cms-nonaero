import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ChargeType,
  ObligationStatus,
  ObligationType,
  PolicyStatus,
  ServiceType,
} from '@shared-types/enums';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../database/prisma.service';
import { QueryObligationsDto } from './dto/query-obligations.dto';

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid state transitions for obligations.
 * Terminal states (settled, skipped, cancelled) have empty arrays.
 * Rollbacks are explicitly listed:
 *   pending_calculation -> pending_input
 *   on_hold -> pending_input | pending_calculation
 */
const OBLIGATION_TRANSITIONS: Record<ObligationStatus, ObligationStatus[]> = {
  [ObligationStatus.scheduled]:           [ObligationStatus.pending_input, ObligationStatus.skipped, ObligationStatus.cancelled],
  [ObligationStatus.pending_input]:       [ObligationStatus.pending_calculation, ObligationStatus.on_hold, ObligationStatus.cancelled],
  [ObligationStatus.pending_calculation]: [ObligationStatus.ready, ObligationStatus.pending_input, ObligationStatus.on_hold],
  [ObligationStatus.ready]:               [ObligationStatus.invoiced, ObligationStatus.on_hold, ObligationStatus.cancelled],
  [ObligationStatus.invoiced]:            [ObligationStatus.settled],
  [ObligationStatus.settled]:             [],
  [ObligationStatus.skipped]:             [],
  [ObligationStatus.on_hold]:             [ObligationStatus.pending_input, ObligationStatus.pending_calculation, ObligationStatus.cancelled],
  [ObligationStatus.cancelled]:           [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Hash Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a deterministic SHA256 line hash for deduplication.
 * Input: tenantId + periodStart ISO string + chargeType
 * Used by generateSchedule and externally by settlement service.
 */
function buildLineHash(tenantId: string, periodStart: Date, chargeType: ChargeType): string {
  const input = `${tenantId}:${periodStart.toISOString()}:${chargeType}`;
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Static version for use by other modules (e.g. settlement service in plan 04-04).
 * Delegates to the module-level buildLineHash function.
 */
export function buildObligationLineHash(tenantId: string, periodStart: Date, chargeType: ChargeType): string {
  return buildLineHash(tenantId, periodStart, chargeType);
}

// ─────────────────────────────────────────────────────────────────────────────
// Proration Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the proration factor for a mid-period contract start.
 *
 * Returns 1.0 if effectiveFrom falls on the 1st day of the periodStart month.
 * Otherwise returns remainingDays/totalDays using inclusive day count.
 *
 * Note: Proration is stored and applied at formula evaluation time (plan 04-03),
 * not at schedule generation time. This helper is called during calculateObligation.
 *
 * @param effectiveFrom - Contract start date (any day)
 * @param periodStart   - First day of the billing period
 * @param periodEnd     - Last day of the billing period
 */
export function calculateProration(effectiveFrom: Date, periodStart: Date, periodEnd: Date): Decimal {
  // No proration when contract starts on 1st of the same month as periodStart
  if (
    effectiveFrom.getDate() === 1 &&
    effectiveFrom.getMonth() === periodStart.getMonth() &&
    effectiveFrom.getFullYear() === periodStart.getFullYear()
  ) {
    return new Decimal(1);
  }

  const totalDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
  const remainingDays = Math.floor((periodEnd.getTime() - effectiveFrom.getTime()) / 86400000) + 1;
  return new Decimal(remainingDays).dividedBy(totalDays);
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Mapping Tables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps ServiceType to ObligationType.
 * service_charge and utility share the base `rent` obligation type.
 */
const OBLIGATION_TYPE_MAP: Record<ServiceType, ObligationType> = {
  [ServiceType.rent]: ObligationType.rent,
  [ServiceType.revenue_share]: ObligationType.revenue_share,
  [ServiceType.service_charge]: ObligationType.rent,
  [ServiceType.utility]: ObligationType.rent,
};

/**
 * Maps ServiceType to ChargeType for line-item specificity.
 */
const CHARGE_TYPE_MAP: Record<ServiceType, ChargeType> = {
  [ServiceType.rent]: ChargeType.base_rent,
  [ServiceType.revenue_share]: ChargeType.revenue_share,
  [ServiceType.service_charge]: ChargeType.service_charge,
  [ServiceType.utility]: ChargeType.utility,
};

// ─────────────────────────────────────────────────────────────────────────────
// Date Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate monthly billing periods between two dates.
 * Each period spans from the 1st to the last day of each calendar month.
 *
 * @param effectiveFrom - Contract start date (any day, period starts from its month's 1st)
 * @param effectiveTo   - Contract end date (exclusive upper bound)
 * @returns Array of { periodStart, periodEnd } pairs
 */
function generateMonthlyPeriods(
  effectiveFrom: Date,
  effectiveTo: Date,
): Array<{ periodStart: Date; periodEnd: Date }> {
  const periods: Array<{ periodStart: Date; periodEnd: Date }> = [];

  // Normalize to 1st of the month for effectiveFrom
  let current = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);

  while (current < effectiveTo) {
    const year = current.getFullYear();
    const month = current.getMonth();

    const periodStart = new Date(year, month, 1);
    // Last day of the month: day 0 of the next month
    const periodEnd = new Date(year, month + 1, 0);

    periods.push({ periodStart, periodEnd });

    // Advance to first day of next month
    current = new Date(year, month + 1, 1);
  }

  return periods;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ObligationsService {
  private readonly logger = new Logger(ObligationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Schedule Generation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate an obligation schedule for a published contract.
   *
   * Creates one obligation row per assigned service per billing period
   * (monthly from effectiveFrom to effectiveTo).
   *
   * Each obligation includes a lineHash for deduplication.
   *
   * Returns the count of created obligations (0 if no services assigned).
   */
  async generateSchedule(contractId: string): Promise<number> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        contractServices: {
          include: { serviceDefinition: true },
        },
        contractAreas: true,
        tenant: true,
        airport: true,
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    // Early exit: no services assigned means no obligations
    if (!contract.contractServices || contract.contractServices.length === 0) {
      this.logger.log(
        `Contract ${contract.contractNumber} has no assigned services — skipping schedule generation`,
      );
      return 0;
    }

    // Fetch active BillingPolicy for due date calculation
    const billingPolicy = await this.prisma.billingPolicy.findFirst({
      where: { airportId: contract.airportId, status: PolicyStatus.active },
    });

    let dueDateDays: number;
    if (billingPolicy) {
      dueDateDays = billingPolicy.dueDateDays;
    } else {
      this.logger.warn(
        `No active BillingPolicy found for airport ${contract.airportId} — using default dueDateDays=30`,
      );
      dueDateDays = 30;
    }

    // Generate monthly periods for the contract's duration
    const periods = generateMonthlyPeriods(contract.effectiveFrom, contract.effectiveTo);

    // Build obligation rows: one per service per period
    const obligations = [];

    for (const contractService of contract.contractServices) {
      const serviceType = contractService.serviceDefinition.serviceType as ServiceType;
      const obligationType = OBLIGATION_TYPE_MAP[serviceType];
      const chargeType = CHARGE_TYPE_MAP[serviceType];

      // Currency priority: overrideCurrency > contract.magCurrency > 'TRY'
      const currency =
        (contractService.overrideCurrency as string | null) ??
        (contract.magCurrency as string | null) ??
        'TRY';

      for (const { periodStart, periodEnd } of periods) {
        // dueDate = periodEnd + dueDateDays
        const dueDate = new Date(periodEnd.getTime() + dueDateDays * 86400000);

        // Build deterministic line hash for deduplication
        const lineHash = buildLineHash(contract.tenantId, periodStart, chargeType);

        obligations.push({
          airportId: contract.airportId,
          contractId: contract.id,
          contractVersion: contract.version,
          tenantId: contract.tenantId,
          serviceDefinitionId: contractService.serviceDefinitionId,
          obligationType,
          chargeType,
          periodStart,
          periodEnd,
          dueDate,
          amount: null,
          currency,
          status: ObligationStatus.scheduled,
          lineHash,
        });
      }
    }

    // Bulk insert all obligations
    const result = await this.prisma.obligation.createMany({ data: obligations });

    this.logger.log(
      `Generated ${result.count} obligations for contract ${contract.contractNumber} ` +
        `(${contract.contractServices.length} services × ${periods.length} periods)`,
    );

    return result.count;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Machine
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Transition an obligation to a new status.
   *
   * Validates the transition using OBLIGATION_TRANSITIONS map.
   * When transitioning to `skipped`, sets skippedAt and skippedReason.
   *
   * @throws NotFoundException   when obligation not found
   * @throws BadRequestException when transition is not allowed
   */
  async transitionObligation(
    id: string,
    toStatus: ObligationStatus,
    opts: { skippedReason?: string } = {},
  ) {
    const obligation = await this.prisma.obligation.findUnique({ where: { id } });

    if (!obligation) {
      throw new NotFoundException(`Obligation ${id} not found`);
    }

    const currentStatus = obligation.status as ObligationStatus;
    const allowedTransitions = OBLIGATION_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition obligation from '${currentStatus}' to '${toStatus}'. ` +
          `Allowed: [${allowedTransitions.join(', ')}]`,
      );
    }

    const updateData: Record<string, unknown> = { status: toStatus };

    if (toStatus === ObligationStatus.skipped) {
      updateData.skippedAt = new Date();
      if (opts.skippedReason !== undefined) {
        updateData.skippedReason = opts.skippedReason;
      }
    }

    return this.prisma.obligation.update({
      where: { id },
      data: updateData,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Read Queries
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * List obligations with optional filters and pagination.
   * Returns { data, meta } envelope.
   */
  async findAll(query: QueryObligationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.contractId) where.contractId = query.contractId;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;

    // periodStart range filter
    if (query.periodStart || query.periodEnd) {
      const dateFilter: Record<string, Date> = {};
      if (query.periodStart) dateFilter['gte'] = new Date(query.periodStart);
      if (query.periodEnd) dateFilter['lte'] = new Date(query.periodEnd);
      where.periodStart = dateFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.obligation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ periodStart: 'asc' }, { createdAt: 'asc' }],
        include: {
          contract: true,
          tenant: true,
        },
      }),
      this.prisma.obligation.count({ where }),
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
   * Get a single obligation by ID with contract, tenant, and serviceDefinition relations.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const obligation = await this.prisma.obligation.findUnique({
      where: { id },
      include: {
        contract: true,
        tenant: true,
      },
    });

    if (!obligation) {
      throw new NotFoundException(`Obligation ${id} not found`);
    }

    return obligation;
  }
}
