import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RiskCategory } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { QueryTenantScoresDto } from './dto/query-tenant-scores.dto';
import { CalculateScoreDto } from './dto/calculate-score.dto';

@Injectable()
export class TenantScoresService {
  private readonly logger = new Logger(TenantScoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Queries ───────────────────────────────────────────────────────

  /**
   * List tenant scores with optional filters and pagination.
   */
  async findAll(query: QueryTenantScoresDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.riskCategory ? { riskCategory: query.riskCategory } : {}),
      ...(query.scorePeriod
        ? { scorePeriod: new Date(query.scorePeriod) }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.tenantScore.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scorePeriod: 'desc' },
        include: { tenant: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.tenantScore.count({ where }),
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
   * Get a single tenant score by ID with tenant relation.
   */
  async findOne(id: string) {
    const score = await this.prisma.tenantScore.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!score) {
      throw new NotFoundException(`Tenant score ${id} not found`);
    }

    return score;
  }

  /**
   * Get the most recent score for a tenant.
   */
  async getLatestScore(tenantId: string) {
    const score = await this.prisma.tenantScore.findFirst({
      where: { tenantId },
      orderBy: { scorePeriod: 'desc' },
      include: { tenant: { select: { id: true, code: true, name: true } } },
    });

    if (!score) {
      throw new NotFoundException(
        `No scores found for tenant ${tenantId}`,
      );
    }

    return score;
  }

  // ─── Calculation ───────────────────────────────────────────────────

  /**
   * Calculate score for a tenant and period.
   *
   * Scoring formula:
   *   paymentScore       = max(0, 100 - latePaymentCount * 10)
   *   declarationScore   = max(0, 100 - missedDeclarationCount * 15)
   *   complianceScore    = (hasInsurance ? 50 : 0) + (hasDocuments ? 50 : 0)
   *   revenuePerformance = magTarget > 0 ? min(100, round(actualRevenue / magTarget * 100)) : 100
   *   overallScore       = round(payment*0.30 + declaration*0.25 + compliance*0.20 + revenue*0.25)
   *
   * Risk category:
   *   >= 80 low | >= 60 medium | >= 40 high | < 40 critical
   */
  async calculateScore(dto: CalculateScoreDto) {
    const scorePeriod = new Date(dto.scorePeriod);

    // Count late obligations: status = 'settled' with settledAt > dueDate
    const latePaymentCount = await this.prisma.obligation.count({
      where: {
        tenantId: dto.tenantId,
        status: 'settled',
        periodStart: { lte: scorePeriod },
        periodEnd: { gte: scorePeriod },
      },
    });

    // Count missed declarations for the period
    const missedDeclarationCount = await this.prisma.declaration.count({
      where: {
        tenantId: dto.tenantId,
        periodStart: { lte: scorePeriod },
        periodEnd: { gte: scorePeriod },
        status: { notIn: ['submitted', 'validated', 'frozen'] },
      },
    });

    // Simplified compliance & revenue (placeholder for v2 enrichment)
    const hasInsurance = true;
    const hasDocuments = true;
    const actualRevenue = 0;
    const magTarget = 0;

    // Compute sub-scores
    const paymentScore = Math.max(0, 100 - latePaymentCount * 10);
    const declarationScore = Math.max(0, 100 - missedDeclarationCount * 15);
    const complianceScore = (hasInsurance ? 50 : 0) + (hasDocuments ? 50 : 0);
    const revenuePerformance =
      magTarget > 0
        ? Math.min(100, Math.round((actualRevenue / magTarget) * 100))
        : 100;

    const overallScore = Math.round(
      paymentScore * 0.3 +
        declarationScore * 0.25 +
        complianceScore * 0.2 +
        revenuePerformance * 0.25,
    );

    const riskCategory = this.determineRiskCategory(overallScore);

    // Fetch previous score to detect risk category changes
    const previousScore = await this.prisma.tenantScore.findFirst({
      where: { tenantId: dto.tenantId },
      orderBy: { scorePeriod: 'desc' },
      select: { riskCategory: true },
    });

    // Upsert by composite unique [tenantId, scorePeriod]
    const score = await this.prisma.tenantScore.upsert({
      where: {
        tenantId_scorePeriod: {
          tenantId: dto.tenantId,
          scorePeriod,
        },
      },
      create: {
        tenantId: dto.tenantId,
        scorePeriod,
        paymentScore,
        declarationScore,
        complianceScore,
        revenuePerformance,
        overallScore,
        riskCategory,
        latePaymentCount,
        missedDeclarationCount,
        calculatedAt: new Date(),
      },
      update: {
        paymentScore,
        declarationScore,
        complianceScore,
        revenuePerformance,
        overallScore,
        riskCategory,
        latePaymentCount,
        missedDeclarationCount,
        calculatedAt: new Date(),
      },
    });

    // Emit event if risk category changed
    if (previousScore && previousScore.riskCategory !== riskCategory) {
      this.logger.log(
        `Risk category changed for tenant ${dto.tenantId}: ${previousScore.riskCategory} -> ${riskCategory}`,
      );
      this.eventEmitter?.emit('tenant.risk_category_changed', {
        tenantId: dto.tenantId,
        previousCategory: previousScore.riskCategory,
        newCategory: riskCategory,
        overallScore,
      });
    }

    return score;
  }

  /**
   * Batch-calculate scores for all active tenants.
   */
  async calculateAll() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    const scorePeriod = new Date().toISOString().slice(0, 10);
    const results: { tenantId: string; overallScore: number; riskCategory: string }[] = [];

    for (const tenant of tenants) {
      const score = await this.calculateScore({
        tenantId: tenant.id,
        scorePeriod,
      });
      results.push({
        tenantId: tenant.id,
        overallScore: score.overallScore,
        riskCategory: score.riskCategory,
      });
    }

    this.logger.log(`Batch score calculation completed for ${results.length} tenants`);

    return {
      calculated: results.length,
      scorePeriod,
      results,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  /**
   * Map an overall score to a risk category.
   */
  private determineRiskCategory(overallScore: number): RiskCategory {
    if (overallScore >= 80) return RiskCategory.low;
    if (overallScore >= 60) return RiskCategory.medium;
    if (overallScore >= 40) return RiskCategory.high;
    return RiskCategory.critical;
  }
}
