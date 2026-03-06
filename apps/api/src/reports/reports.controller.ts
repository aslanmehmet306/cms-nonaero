import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { RevenueSummaryQueryDto } from './dto/revenue-summary-query.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { ObligationListQueryDto } from './dto/obligation-list-query.dto';
import { BillingHistoryQueryDto } from './dto/billing-history-query.dto';

/**
 * ReportsController — REST endpoints for dashboard KPIs, revenue summaries,
 * aging report, obligation list, and billing history.
 *
 * All endpoints are read-only (GET). Role guards restrict access to
 * finance, admin, and auditor roles.
 */
@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.commercial_manager,
    UserRole.auditor,
  )
  @ApiOperation({
    summary: 'Dashboard with revenue KPIs, outstanding invoices, collection rate',
  })
  @ApiResponse({ status: 200, description: 'Dashboard KPIs and revenue summaries' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.reportsService.getDashboard(query);
  }

  @Get('revenue-summary')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.commercial_manager,
    UserRole.auditor,
  )
  @ApiOperation({
    summary: 'Revenue summary by tenant and/or service type with optional currency conversion',
  })
  @ApiResponse({ status: 200, description: 'Revenue summary grouped by tenant and/or charge type' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  getRevenueSummary(@Query() query: RevenueSummaryQueryDto) {
    return this.reportsService.getRevenueSummary(query);
  }

  @Get('aging')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.auditor,
  )
  @ApiOperation({
    summary: 'Aging report with 30/60/90 day overdue buckets',
  })
  @ApiResponse({ status: 200, description: 'Invoice aging buckets with amounts per currency' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  getAgingReport(@Query() query: AgingReportQueryDto) {
    return this.reportsService.getAgingReport(query);
  }

  @Get('obligations')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.commercial_manager,
    UserRole.auditor,
  )
  @ApiOperation({
    summary: 'Obligation list with filters and calculation trace drill-down',
  })
  @ApiResponse({ status: 200, description: 'Paginated obligation list with calculation trace' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  getObligationList(@Query() query: ObligationListQueryDto) {
    return this.reportsService.getObligationList(query);
  }

  @Get('billing-history')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.auditor,
  )
  @ApiOperation({
    summary: 'Billing run history with status and amount summaries',
  })
  @ApiResponse({ status: 200, description: 'Paginated billing run history' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  getBillingHistory(@Query() query: BillingHistoryQueryDto) {
    return this.reportsService.getBillingHistory(query);
  }
}
