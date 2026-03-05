import { Injectable, Logger } from '@nestjs/common';
import { ObligationStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../database/prisma.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { DecimalHelper } from '../common/utils/decimal-helper';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { RevenueSummaryQueryDto } from './dto/revenue-summary-query.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { ObligationListQueryDto } from './dto/obligation-list-query.dto';
import { BillingHistoryQueryDto } from './dto/billing-history-query.dto';

/**
 * ReportsService — dashboard KPIs, revenue summaries, aging report,
 * obligation list, and billing history.
 *
 * All monetary aggregations use Prisma groupBy with currency always in
 * the groupBy clause to prevent cross-currency sum errors (pitfall #3).
 *
 * Null-safe Decimal: `new Decimal(result._sum.amount?.toString() ?? '0')`
 * prevents NaN from empty aggregation results (pitfall #1).
 *
 * Currency conversion is display-only via ExchangeRatesService.convert()
 * -- never mutates stored amounts (R10.4).
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  /**
   * Dashboard KPIs: total revenue per currency, outstanding invoices,
   * collection rate, active contracts, active tenants.
   *
   * Runs 5 parallel queries via Promise.all for efficiency.
   */
  async getDashboard(query: DashboardQueryDto) {
    const { airportId, periodFrom, periodTo } = query;

    // Build optional period filters for obligations
    const periodFilter: Record<string, any> = {};
    if (periodFrom) periodFilter.periodStart = { gte: new Date(periodFrom) };
    if (periodTo) periodFilter.periodEnd = { lte: new Date(periodTo) };

    const [
      revenueGroups,
      outstandingGroups,
      paidGroups,
      activeContracts,
      activeTenants,
    ] = await Promise.all([
      // a) Total revenue from obligations with billable statuses
      this.prisma.obligation.groupBy({
        by: ['currency'],
        where: {
          airportId,
          status: { in: ['ready', 'invoiced', 'settled'] },
          ...periodFilter,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // b) Outstanding invoices
      this.prisma.invoiceLog.groupBy({
        by: ['currency'],
        where: {
          airportId,
          status: { in: ['finalized', 'sent', 'past_due'] },
        },
        _sum: { amountTotal: true },
        _count: { _all: true },
      }),

      // c) Paid invoices
      this.prisma.invoiceLog.groupBy({
        by: ['currency'],
        where: {
          airportId,
          status: 'paid',
        },
        _sum: { amountTotal: true },
        _count: { _all: true },
      }),

      // d) Active contracts
      this.prisma.contract.count({
        where: { airportId, status: 'active' },
      }),

      // e) Active tenants
      this.prisma.tenant.count({
        where: { airportId, status: 'active' },
      }),
    ]);

    // Map revenue groups with null-safe Decimal
    const totalRevenue = revenueGroups.map((g) => ({
      amount: new Decimal(g._sum.amount?.toString() ?? '0').toFixed(2),
      currency: g.currency,
      count: g._count.id,
    }));

    // Map outstanding invoices
    const outstandingInvoices = outstandingGroups.map((g) => ({
      amount: new Decimal(g._sum.amountTotal?.toString() ?? '0').toFixed(2),
      currency: g.currency,
      count: g._count._all,
    }));

    // Collection rate: paid / (paid + outstanding) * 100
    // Sum across all currencies for a rough KPI metric
    let paidTotal = new Decimal(0);
    for (const g of paidGroups) {
      paidTotal = DecimalHelper.add(
        paidTotal,
        new Decimal(g._sum.amountTotal?.toString() ?? '0'),
      );
    }

    let outstandingTotal = new Decimal(0);
    for (const g of outstandingGroups) {
      outstandingTotal = DecimalHelper.add(
        outstandingTotal,
        new Decimal(g._sum.amountTotal?.toString() ?? '0'),
      );
    }

    let collectionRate = 0;
    const denominator = DecimalHelper.add(paidTotal, outstandingTotal);
    if (!DecimalHelper.isZero(denominator)) {
      collectionRate = DecimalHelper.divide(paidTotal, denominator)
        .times(100)
        .toDecimalPlaces(0)
        .toNumber();
    }

    return {
      totalRevenue,
      outstandingInvoices,
      collectionRate,
      activeContracts,
      activeTenants,
    };
  }

  /**
   * Revenue summary grouped by tenant and/or chargeType.
   *
   * Optional reportingCurrency converts amounts using exchange rates
   * at the period-end date. Conversion failures include a warning
   * instead of erroring out.
   */
  async getRevenueSummary(query: RevenueSummaryQueryDto) {
    const { airportId, periodFrom, periodTo, groupBy, reportingCurrency } =
      query;

    const baseWhere = {
      airportId,
      periodStart: { gte: new Date(periodFrom) },
      periodEnd: { lte: new Date(periodTo) },
      status: {
        in: [
          ObligationStatus.ready,
          ObligationStatus.invoiced,
          ObligationStatus.settled,
        ],
      },
    };

    // Run both groupBy queries in parallel
    const [byTenantRaw, byChargeTypeRaw] = await Promise.all([
      // By tenant (skip if groupBy === 'chargeType')
      groupBy === 'chargeType'
        ? ([] as any[])
        : this.prisma.obligation.groupBy({
            by: ['tenantId', 'currency'],
            where: baseWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),

      // By charge type (skip if groupBy === 'tenant')
      groupBy === 'tenant'
        ? ([] as any[])
        : this.prisma.obligation.groupBy({
            by: ['chargeType', 'currency'],
            where: baseWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
    ]);

    // Resolve tenant names
    const tenantIds = [
      ...new Set(byTenantRaw.map((g: any) => g.tenantId)),
    ];
    const tenants =
      tenantIds.length > 0
        ? await this.prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true },
          })
        : [];
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

    // Map by-tenant results
    const byTenant = await Promise.all(
      byTenantRaw.map(async (g: any) => {
        const amount = new Decimal(g._sum.amount?.toString() ?? '0');
        const entry: any = {
          tenantId: g.tenantId,
          tenantName: tenantMap.get(g.tenantId) ?? 'Unknown',
          amount: amount.toFixed(2),
          currency: g.currency,
          obligationCount: g._count.id,
        };

        // Optional currency conversion
        if (reportingCurrency && g.currency !== reportingCurrency) {
          try {
            const conversion = await this.exchangeRatesService.convert(
              amount,
              g.currency,
              reportingCurrency,
              new Date(periodTo),
            );
            entry.convertedAmount = conversion.convertedAmount.toFixed(2);
            entry.convertedCurrency = reportingCurrency;
            entry.exchangeRate = conversion.rate.toString();
          } catch (err) {
            this.logger.warn(
              `No rate for ${g.currency}/${reportingCurrency}: ${(err as Error).message}`,
            );
            entry.conversionWarning = `No exchange rate found for ${g.currency}/${reportingCurrency}`;
          }
        } else if (reportingCurrency && g.currency === reportingCurrency) {
          entry.convertedAmount = amount.toFixed(2);
          entry.convertedCurrency = reportingCurrency;
          entry.exchangeRate = '1';
        }

        return entry;
      }),
    );

    // Map by-chargeType results
    const byChargeType = await Promise.all(
      byChargeTypeRaw.map(async (g: any) => {
        const amount = new Decimal(g._sum.amount?.toString() ?? '0');
        const entry: any = {
          chargeType: g.chargeType,
          amount: amount.toFixed(2),
          currency: g.currency,
          obligationCount: g._count.id,
        };

        if (reportingCurrency && g.currency !== reportingCurrency) {
          try {
            const conversion = await this.exchangeRatesService.convert(
              amount,
              g.currency,
              reportingCurrency,
              new Date(periodTo),
            );
            entry.convertedAmount = conversion.convertedAmount.toFixed(2);
            entry.convertedCurrency = reportingCurrency;
            entry.exchangeRate = conversion.rate.toString();
          } catch (err) {
            this.logger.warn(
              `No rate for ${g.currency}/${reportingCurrency}: ${(err as Error).message}`,
            );
            entry.conversionWarning = `No exchange rate found for ${g.currency}/${reportingCurrency}`;
          }
        } else if (reportingCurrency && g.currency === reportingCurrency) {
          entry.convertedAmount = amount.toFixed(2);
          entry.convertedCurrency = reportingCurrency;
          entry.exchangeRate = '1';
        }

        return entry;
      }),
    );

    return { byTenant, byChargeType };
  }

  /**
   * Aging report: bucket overdue invoices into current/1-30/31-60/61-90/90+
   * categories using raw SQL with parameterized date.
   *
   * Uses COUNT(*)::int to avoid BigInt issue (pitfall #4).
   * Uses application-level asOfDate instead of CURRENT_DATE (pitfall #5).
   */
  async getAgingReport(query: AgingReportQueryDto) {
    const { airportId } = query;
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();

    const rawBuckets = await this.prisma.$queryRaw<
      Array<{
        bucket: string;
        count: number | bigint;
        total_amount: Decimal | null;
        currency: string;
      }>
    >`
      SELECT
        CASE
          WHEN ${asOfDate}::date - due_date <= 0 THEN 'current'
          WHEN ${asOfDate}::date - due_date BETWEEN 1 AND 30 THEN '1-30'
          WHEN ${asOfDate}::date - due_date BETWEEN 31 AND 60 THEN '31-60'
          WHEN ${asOfDate}::date - due_date BETWEEN 61 AND 90 THEN '61-90'
          WHEN ${asOfDate}::date - due_date > 90 THEN '90+'
        END AS bucket,
        COUNT(*)::int AS count,
        SUM(amount_total) AS total_amount,
        currency
      FROM invoice_log
      WHERE airport_id = ${airportId}
        AND status NOT IN ('paid', 'voided')
        AND due_date IS NOT NULL
      GROUP BY bucket, currency
      ORDER BY bucket
    `;

    // Convert raw results with null-safe Decimal and BigInt safety
    const buckets = rawBuckets.map((row) => ({
      bucket: row.bucket,
      count: Number(row.count),
      totalAmount: new Decimal(row.total_amount?.toString() ?? '0').toFixed(2),
      currency: row.currency,
    }));

    return { buckets };
  }

  /**
   * Obligation list with filtering and calculationTrace drill-down (R12.7).
   *
   * Supports filtering by tenantId, periodStart/periodEnd range, status,
   * chargeType. Includes calculationTrace, contract, and tenant relations.
   */
  async getObligationList(query: ObligationListQueryDto) {
    const { airportId, tenantId, periodStart, periodEnd, status, chargeType } =
      query;
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;

    // Build dynamic where clause
    const where: Record<string, any> = { airportId };
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
    if (chargeType) where.chargeType = chargeType;
    if (periodStart) where.periodStart = { gte: new Date(periodStart) };
    if (periodEnd) where.periodEnd = { lte: new Date(periodEnd) };

    const [data, total] = await Promise.all([
      this.prisma.obligation.findMany({
        where,
        include: {
          contract: { select: { contractNumber: true, tenantId: true } },
          tenant: { select: { name: true } },
        },
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.obligation.count({ where }),
    ]);

    return { data, total, page, perPage };
  }

  /**
   * Billing history: past billing runs with status, dates, tenant counts,
   * and amount totals (R12.8).
   */
  async getBillingHistory(query: BillingHistoryQueryDto) {
    const { airportId, periodFrom, periodTo, status } = query;
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;

    const where: Record<string, any> = { airportId };
    if (status) where.status = status;
    if (periodFrom) where.periodStart = { gte: new Date(periodFrom) };
    if (periodTo) where.periodEnd = { lte: new Date(periodTo) };

    const [data, total] = await Promise.all([
      this.prisma.billingRun.findMany({
        where,
        include: {
          _count: { select: { invoiceLogs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.billingRun.count({ where }),
    ]);

    return { data, total, page, perPage };
  }
}
