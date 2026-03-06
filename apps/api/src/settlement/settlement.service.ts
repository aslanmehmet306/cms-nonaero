import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { DecimalHelper } from '../common/utils/decimal-helper';
import { buildObligationLineHash } from '../obligations/obligations.service';
import {
  ChargeType,
  ObligationStatus,
  ObligationType,
  SettlementType,
} from '@shared-types/enums';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Monthly MAG settlement — compares revenue_share obligation amount
   * for a given period against annual_MAG / 12.
   *
   * If shortfall > 0, upserts a mag_shortfall obligation (idempotent via lineHash).
   * Always creates a SettlementEntry for audit trail.
   */
  async calculateMonthlyMag(
    contractId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract || !contract.annualMag) {
      this.logger.log(
        `Contract ${contractId} has no annualMag — skipping monthly MAG`,
      );
      return;
    }

    // Monthly MAG = annualMag / 12
    const monthlyMag = DecimalHelper.divide(contract.annualMag.toString(), 12);

    // Find revenue_share obligation for this period (status=ready)
    const revShareObligation = await this.prisma.obligation.findFirst({
      where: {
        contractId,
        periodStart,
        chargeType: ChargeType.revenue_share,
        status: ObligationStatus.ready,
      },
    });

    const revenueShareAmount = revShareObligation
      ? new Decimal(revShareObligation.amount!.toString())
      : new Decimal(0);

    // Higher-of and shortfall
    const higherOfResult = DecimalHelper.max(revenueShareAmount, monthlyMag);
    const shortfall = DecimalHelper.subtract(monthlyMag, revenueShareAmount);

    // Create SettlementEntry for audit
    await this.prisma.settlementEntry.create({
      data: {
        airportId: contract.airportId,
        contractId: contract.id,
        tenantId: contract.tenantId,
        periodStart,
        periodEnd,
        settlementType: SettlementType.monthly_mag,
        revenueShareAmount: DecimalHelper.roundMoney(revenueShareAmount),
        magAmount: DecimalHelper.roundMoney(monthlyMag),
        higherOfResult: DecimalHelper.roundMoney(higherOfResult),
        shortfall: shortfall.isPositive()
          ? DecimalHelper.roundMoney(shortfall)
          : new Decimal(0),
        surplus: shortfall.isNegative()
          ? DecimalHelper.roundMoney(shortfall.abs())
          : new Decimal(0),
      },
    });

    // If shortfall > 0, create/update mag_shortfall obligation
    if (shortfall.isPositive()) {
      const lineHash = buildObligationLineHash(
        contract.tenantId,
        periodStart,
        ChargeType.mag_settlement,
      );
      const dueDate = new Date(periodEnd.getTime() + 30 * 86400000);

      await this.prisma.obligation.upsert({
        where: { lineHash },
        create: {
          airportId: contract.airportId,
          contractId: contract.id,
          contractVersion: contract.version,
          tenantId: contract.tenantId,
          serviceDefinitionId: null as unknown as string, // MAG has no service definition (nullable in schema, Prisma types not regenerated)
          obligationType: ObligationType.mag_shortfall,
          chargeType: ChargeType.mag_settlement,
          periodStart,
          periodEnd,
          dueDate,
          amount: DecimalHelper.roundMoney(shortfall),
          currency: (contract.magCurrency as string) ?? 'TRY',
          status: ObligationStatus.ready,
          lineHash,
          calculationTrace: {
            type: 'mag_settlement',
            monthlyMag: monthlyMag.toString(),
            revenueShareAmount: revenueShareAmount.toString(),
            shortfall: shortfall.toString(),
            formula: 'max(revenue_share, annual_mag / 12) - revenue_share',
          },
        },
        update: {
          amount: DecimalHelper.roundMoney(shortfall),
          calculationTrace: {
            type: 'mag_settlement_updated',
            monthlyMag: monthlyMag.toString(),
            revenueShareAmount: revenueShareAmount.toString(),
            shortfall: shortfall.toString(),
          },
        },
      });

      this.logger.log(
        `MAG shortfall created for contract ${contractId}: ${shortfall.toString()} TRY`,
      );
    } else {
      this.logger.log(
        `No MAG shortfall for contract ${contractId} — revenue exceeds monthly MAG`,
      );
    }
  }

  /**
   * Year-end true-up — admin-triggered, compares annual revenue total
   * vs annualMag and nets out already-paid monthly shortfalls.
   */
  async calculateYearEndTrueUp(
    contractId: string,
    fiscalYearStart: Date,
    fiscalYearEnd: Date,
  ): Promise<{ trueUpAmount: Decimal; created: boolean }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract || !contract.annualMag) {
      return { trueUpAmount: new Decimal(0), created: false };
    }

    // Sum all revenue_share obligations for the fiscal year
    const revShareObligations = await this.prisma.obligation.findMany({
      where: {
        contractId,
        chargeType: ChargeType.revenue_share,
        status: {
          in: [
            ObligationStatus.ready,
            ObligationStatus.invoiced,
            ObligationStatus.settled,
          ],
        },
        periodStart: { gte: fiscalYearStart },
        periodEnd: { lte: fiscalYearEnd },
      },
    });

    const annualRevenueShare = revShareObligations.reduce(
      (sum, o) => sum.plus(new Decimal(o.amount?.toString() ?? '0')),
      new Decimal(0),
    );

    const annualMag = new Decimal(contract.annualMag.toString());
    const gap = DecimalHelper.subtract(annualMag, annualRevenueShare);

    // Subtract already-paid monthly shortfalls
    const monthlyShortfalls = await this.prisma.obligation.findMany({
      where: {
        contractId,
        chargeType: ChargeType.mag_settlement,
        obligationType: ObligationType.mag_shortfall,
        status: {
          in: [
            ObligationStatus.ready,
            ObligationStatus.invoiced,
            ObligationStatus.settled,
          ],
        },
        periodStart: { gte: fiscalYearStart },
        periodEnd: { lte: fiscalYearEnd },
      },
    });

    const totalMonthlyShortfalls = monthlyShortfalls.reduce(
      (sum, o) => sum.plus(new Decimal(o.amount?.toString() ?? '0')),
      new Decimal(0),
    );

    const netTrueUp = DecimalHelper.subtract(gap, totalMonthlyShortfalls);

    // Create SettlementEntry
    await this.prisma.settlementEntry.create({
      data: {
        airportId: contract.airportId,
        contractId: contract.id,
        tenantId: contract.tenantId,
        periodStart: fiscalYearStart,
        periodEnd: fiscalYearEnd,
        settlementType: SettlementType.year_end_true_up,
        revenueShareAmount: DecimalHelper.roundMoney(annualRevenueShare),
        magAmount: DecimalHelper.roundMoney(annualMag),
        higherOfResult: DecimalHelper.roundMoney(
          DecimalHelper.max(annualRevenueShare, annualMag),
        ),
        shortfall: netTrueUp.isPositive()
          ? DecimalHelper.roundMoney(netTrueUp)
          : new Decimal(0),
        surplus: netTrueUp.isNegative()
          ? DecimalHelper.roundMoney(netTrueUp.abs())
          : new Decimal(0),
        trueUpAmount: netTrueUp.isPositive()
          ? DecimalHelper.roundMoney(netTrueUp)
          : new Decimal(0),
      },
    });

    // If net true-up > 0, create true-up obligation
    if (netTrueUp.isPositive()) {
      const baseHash = buildObligationLineHash(
        contract.tenantId,
        fiscalYearStart,
        ChargeType.mag_settlement,
      );
      const trueUpHash = createHash('sha256')
        .update(`true_up:${baseHash}`)
        .digest('hex');
      const dueDate = new Date(fiscalYearEnd.getTime() + 30 * 86400000);

      await this.prisma.obligation.create({
        data: {
          airportId: contract.airportId,
          contractId: contract.id,
          contractVersion: contract.version,
          tenantId: contract.tenantId,
          serviceDefinitionId: null as unknown as string, // MAG has no service definition (nullable in schema, Prisma types not regenerated)
          obligationType: ObligationType.mag_true_up,
          chargeType: ChargeType.mag_settlement,
          periodStart: fiscalYearStart,
          periodEnd: fiscalYearEnd,
          dueDate,
          amount: DecimalHelper.roundMoney(netTrueUp),
          currency: (contract.magCurrency as string) ?? 'TRY',
          status: ObligationStatus.ready,
          lineHash: trueUpHash,
          calculationTrace: {
            type: 'year_end_true_up',
            annualMag: annualMag.toString(),
            annualRevenueShare: annualRevenueShare.toString(),
            totalMonthlyShortfalls: totalMonthlyShortfalls.toString(),
            netTrueUp: netTrueUp.toString(),
          },
        },
      });

      this.logger.log(
        `Year-end true-up created for contract ${contractId}: ${netTrueUp.toString()} TRY`,
      );
      return { trueUpAmount: DecimalHelper.roundMoney(netTrueUp), created: true };
    }

    this.logger.log(
      `No year-end true-up needed for contract ${contractId}`,
    );
    return { trueUpAmount: new Decimal(0), created: false };
  }

  /**
   * List settlement entries with optional filters and pagination.
   */
  async findAllEntries(query: {
    contractId?: string;
    tenantId?: string;
    settlementType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.contractId) where.contractId = query.contractId;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.settlementType) where.settlementType = query.settlementType;

    const [data, total] = await Promise.all([
      this.prisma.settlementEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.settlementEntry.count({ where }),
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
}
