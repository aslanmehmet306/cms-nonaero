import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { BillingService } from './billing.service';
import { CreateBillingRunDto } from './dto/create-billing-run.dto';
import { ApproveBillingRunDto } from './dto/approve-billing-run.dto';

@Controller('billing-runs')
@Roles(UserRole.airport_admin, UserRole.finance, UserRole.commercial_manager)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * POST / - Create a new billing run.
   * Returns 202 Accepted with the billing run ID and status.
   * The actual billing pipeline runs asynchronously via BullMQ.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body() dto: CreateBillingRunDto) {
    const billingRun = await this.billingService.createBillingRun(dto);
    return {
      billingRunId: billingRun.id,
      status: billingRun.status,
    };
  }

  /**
   * GET / - List billing runs with optional filters.
   */
  @Get()
  async findAll(
    @Query('airportId') airportId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAll({
      airportId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /:id - Get a single billing run.
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findOne(id);
  }

  /**
   * PATCH /:id/approve - Approve a billing run.
   * Only finance or airport_admin roles.
   */
  @Patch(':id/approve')
  @Roles(UserRole.finance, UserRole.airport_admin)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveBillingRunDto,
  ) {
    return this.billingService.approveBillingRun(id, dto);
  }

  /**
   * PATCH /:id/reject - Reject a billing run.
   */
  @Patch(':id/reject')
  async reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.rejectBillingRun(id);
  }

  /**
   * PATCH /:id/cancel - Cancel a billing run.
   */
  @Patch(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.cancelBillingRun(id);
  }
}
