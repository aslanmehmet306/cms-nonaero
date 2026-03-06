import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ChargeType,
  ObligationStatus,
  ObligationType,
  PolicyStatus,
  ServiceType,
} from '@shared-types/enums';
import { evaluateWithTimeout } from '@airport-revenue/formula-engine';
import type { FormulaScope } from '@airport-revenue/formula-engine';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../database/prisma.service';
import { QueryObligationsDto } from './dto/query-obligations.dto';
import { ObligationCalculatedEvent } from './events/obligation-calculated.event';

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

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventEmitter: EventEmitter2,
  ) {}

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
  // Formula Evaluation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build the formula scope from contract context and optional declaration lines.
   *
   * Variable resolution priority (per variable name):
   *   1. Contract context (area_m2 from contractAreas)
   *   2. Declaration lines (revenue = sum of line amounts; consumption from meter_reading line)
   *   3. ContractService.customParameters
   *   4. Formula variable defaultValue
   */
  private async buildFormulaScope(
    obligation: {
      contractId: string;
      chargeType: ChargeType;
      periodStart: Date;
      periodEnd: Date;
    },
    formula: { variables: unknown },
    contract: {
      contractAreas: Array<{ area?: { areaM2?: unknown; size?: number } }>;
      contractServices: Array<{
        serviceDefinitionId: string;
        customParameters: unknown;
      }>;
    },
    declarationId?: string,
  ): Promise<FormulaScope> {
    const scope: FormulaScope = {};

    // Parse formula variables definition
    let variables: Array<{ name: string; type: string; defaultValue?: number }> = [];
    try {
      const rawVars = typeof formula.variables === 'string'
        ? JSON.parse(formula.variables)
        : formula.variables;
      variables = Array.isArray(rawVars) ? rawVars : [];
    } catch {
      variables = [];
    }

    // Set defaults from formula variable definitions
    for (const variable of variables) {
      if (variable.defaultValue !== undefined) {
        scope[variable.name] = variable.defaultValue;
      }
    }

    // Apply customParameters from matching contractService
    const matchingService = contract.contractServices.find(
      (cs) => cs.customParameters,
    );
    if (matchingService?.customParameters) {
      const params = matchingService.customParameters as Record<string, number>;
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'number') {
          scope[key] = value;
        }
      }
    }

    // Resolve area_m2 from contractAreas.
    // Prisma uses areaM2 (from Area model); tests may mock with 'size' for convenience.
    // Priority: area.areaM2 (production) > area.size (test compatibility)
    if (contract.contractAreas.length > 0) {
      const totalArea = contract.contractAreas.reduce((sum, ca) => {
        const m2 = ca.area?.areaM2 !== undefined && ca.area.areaM2 !== null
          ? parseFloat(String(ca.area.areaM2))
          : (ca.area?.size ?? 0);
        return sum + m2;
      }, 0);
      scope['area_m2'] = totalArea;
    }

    // Resolve declaration line values (revenue, consumption) if a declaration is linked
    if (declarationId) {
      const decl = await this.prisma.declaration.findFirst({
        where: { id: declarationId },
        include: { lines: true },
      });

      if (decl?.lines && decl.lines.length > 0) {
        // revenue = sum of all line amounts
        const totalRevenue = decl.lines.reduce((sum: number, line: { amount: unknown }) => {
          return sum + parseFloat(String(line.amount ?? '0'));
        }, 0);
        scope['revenue'] = totalRevenue;

        // consumption from meter_reading: use amount field (current - previous)
        if (decl.declarationType === 'meter_reading') {
          const consumptionLine = decl.lines[0];
          if (consumptionLine) {
            scope['consumption'] = parseFloat(String(consumptionLine.amount ?? '0'));
          }
        }
      }
    }

    return scope;
  }

  /**
   * Evaluate the formula for an obligation, store the result, and transition status.
   *
   * Flow:
   *   a. Fetch obligation with contract -> contractServices -> serviceDefinition -> formula
   *   b. Resolve formula (overrideFormula takes priority over serviceDefinition.formula)
   *   c. Build scope from contract context and optional declaration lines
   *   d. Check proration for first-period mid-month starts on fixed-charge types
   *   e. Evaluate formula expression with timeout
   *   f. Update obligation with amount, trace, formulaVersion, sourceDeclarationId
   *   g. Transition to ready (positive) or skipped (zero)
   *   h. Emit ObligationCalculatedEvent
   *
   * @param obligationId  - ID of the obligation to calculate
   * @param declarationId - Optional declaration ID to link as source (for revenue/meter events)
   * @throws BadRequestException if formula evaluation fails
   * @throws NotFoundException if obligation or contract not found
   */
  async calculateObligation(obligationId: string, declarationId?: string): Promise<void> {
    // a. Fetch obligation
    const obligation = await this.prisma.obligation.findUnique({
      where: { id: obligationId },
    });

    if (!obligation) {
      throw new NotFoundException(`Obligation ${obligationId} not found`);
    }

    // b. Fetch contract with full service/formula chain
    const contract = await this.prisma.contract.findUnique({
      where: { id: obligation.contractId },
      include: {
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
      throw new NotFoundException(`Contract ${obligation.contractId} not found`);
    }

    // If serviceDefinitionId is null (MAG obligation), skip formula eval
    // Amount comes from settlement in plan 04-04
    if (!obligation.serviceDefinitionId) {
      this.logger.log(`Obligation ${obligationId} has no serviceDefinitionId — skipping formula eval (MAG)`);
      return;
    }

    // Find matching contractService for this obligation's serviceDefinition
    const contractService = contract.contractServices.find(
      (cs) => cs.serviceDefinitionId === obligation.serviceDefinitionId,
    );

    if (!contractService) {
      throw new BadRequestException(
        `No ContractService found for serviceDefinitionId ${obligation.serviceDefinitionId} on contract ${obligation.contractId}`,
      );
    }

    // c. Resolve formula: overrideFormula takes priority
    const formula = contractService.overrideFormula ?? contractService.serviceDefinition.formula;

    if (!formula) {
      throw new BadRequestException(`No formula found for obligation ${obligationId}`);
    }

    // d. Build formula scope
    const scope = await this.buildFormulaScope(
      {
        contractId: obligation.contractId,
        chargeType: obligation.chargeType as ChargeType,
        periodStart: obligation.periodStart,
        periodEnd: obligation.periodEnd,
      },
      formula,
      contract,
      declarationId,
    );

    // e. Check proration for first-period mid-month contract starts
    // Only apply to fixed charges: base_rent, service_charge (not revenue-dependent)
    const fixedChargeTypes: string[] = [ChargeType.base_rent, ChargeType.service_charge];
    const prorationFactor = calculateProration(
      contract.effectiveFrom,
      obligation.periodStart,
      obligation.periodEnd,
    );

    const isFirstPeriod =
      obligation.periodStart.getFullYear() === contract.effectiveFrom.getFullYear() &&
      obligation.periodStart.getMonth() === contract.effectiveFrom.getMonth();

    const applyProration = isFirstPeriod && fixedChargeTypes.includes(obligation.chargeType as string);

    if (applyProration && !prorationFactor.equals(1)) {
      scope['proration_factor'] = prorationFactor.toNumber();
    }

    // f. Evaluate formula with 100ms timeout
    const evalResult = await evaluateWithTimeout(formula.expression, scope, 100);

    if (!evalResult.success) {
      throw new BadRequestException(
        `Formula evaluation failed for obligation ${obligationId}: ${evalResult.error}`,
      );
    }

    // g. Calculate amount, apply proration if formula doesn't reference it
    let amount = new Decimal(evalResult.result ?? '0');

    if (applyProration && !formula.expression.includes('proration_factor') && !prorationFactor.equals(1)) {
      amount = amount.mul(prorationFactor);
    }

    // Round to 2 decimal places (financial precision)
    amount = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // h. Determine new status: zero amount -> skipped, positive -> ready
    const isZero = amount.isZero();
    const newStatus = isZero ? ObligationStatus.skipped : ObligationStatus.ready;

    // Build update payload
    const updateData: Record<string, unknown> = {
      amount: amount.toString(),
      calculationTrace: evalResult.trace ?? null,
      formulaVersion: formula.version,
      status: newStatus,
    };

    if (declarationId) {
      updateData.sourceDeclarationId = declarationId;
    }

    if (isZero) {
      updateData.skippedAt = new Date();
      updateData.skippedReason = 'zero_amount';
    }

    // i. Persist update
    await this.prisma.obligation.update({
      where: { id: obligationId },
      data: updateData,
    });

    this.logger.log(
      `Obligation ${obligationId} calculated: amount=${amount.toString()}, status=${newStatus}`,
    );

    // j. Emit obligation.calculated event
    if (this.eventEmitter) {
      const event = new ObligationCalculatedEvent(
        obligationId,
        obligation.contractId,
        obligation.chargeType as ChargeType,
        amount.toString(),
        obligation.periodStart,
        obligation.periodEnd,
      );
      this.eventEmitter.emit('obligation.calculated', event);
    }
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
