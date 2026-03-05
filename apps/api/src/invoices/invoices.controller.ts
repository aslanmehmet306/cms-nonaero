import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { InvoicesService } from './invoices.service';

/**
 * InvoicesController provides read-only access to invoice records.
 *
 * Prefix: /api/v1/invoices
 * Roles: airport_admin, finance, commercial_manager, auditor (read access)
 */
@Controller('invoices')
@Roles(
  UserRole.airport_admin,
  UserRole.finance,
  UserRole.commercial_manager,
  UserRole.auditor,
)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * GET / - List invoices with optional filters.
   */
  @Get()
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('billingRunId') billingRunId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll({
      tenantId,
      billingRunId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /:id - Get a single invoice with obligation details.
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(id);
  }
}
