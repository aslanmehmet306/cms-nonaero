import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole, TenantStatus } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'List tenants for an airport with optional status filter' })
  @ApiQuery({ name: 'airportId', required: true, description: 'Airport ID to scope tenants' })
  @ApiQuery({ name: 'status', required: false, enum: TenantStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default: 20)' })
  @ApiResponse({ status: 200, description: 'Paginated tenant list' })
  findAll(
    @Query('airportId') airportId: string,
    @Query('status') status?: TenantStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenantsService.findAll(
      airportId,
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Tenant')
  @ApiOperation({
    summary: 'Create a new tenant (auto-generates code, creates Stripe customer)',
  })
  @ApiResponse({ status: 201, description: 'Tenant created with auto-generated code' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Tenant')
  @ApiOperation({ summary: 'Update tenant details (name, email, phone, address)' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Tenant')
  @ApiOperation({
    summary: 'Update tenant status (active/suspended/deactivated — fully reversible)',
  })
  @ApiResponse({ status: 200, description: 'Tenant status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.tenantsService.updateStatus(id, dto.status);
  }
}
