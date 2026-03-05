import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { RevenueSummaryQueryDto } from './dto/revenue-summary-query.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { ObligationListQueryDto } from './dto/obligation-list-query.dto';
import { BillingHistoryQueryDto } from './dto/billing-history-query.dto';

/**
 * ReportsService — dashboard KPIs, revenue summaries, aging report,
 * obligation list, and billing history.
 *
 * Stub: implementation pending TDD GREEN phase.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getDashboard(_query: DashboardQueryDto): Promise<any> {
    throw new Error('Not implemented');
  }

  async getRevenueSummary(_query: RevenueSummaryQueryDto): Promise<any> {
    throw new Error('Not implemented');
  }

  async getAgingReport(_query: AgingReportQueryDto): Promise<any> {
    throw new Error('Not implemented');
  }

  async getObligationList(_query: ObligationListQueryDto): Promise<any> {
    throw new Error('Not implemented');
  }

  async getBillingHistory(_query: BillingHistoryQueryDto): Promise<any> {
    throw new Error('Not implemented');
  }
}
