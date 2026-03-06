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
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { TenantGroupsService } from './tenant-groups.service';
import { CreateTenantGroupDto } from './dto/create-tenant-group.dto';
import { UpdateTenantGroupDto } from './dto/update-tenant-group.dto';

@ApiTags('Tenant Groups')
@ApiBearerAuth()
@Controller('tenant-groups')
export class TenantGroupsController {
  constructor(private readonly tenantGroupsService: TenantGroupsService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant groups with optional filters and pagination' })
  @ApiQuery({ name: 'airportId', required: false, description: 'Filter by airport' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default: 20)' })
  @ApiResponse({ status: 200, description: 'Paginated tenant group list' })
  findAll(
    @Query('airportId') airportId?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenantGroupsService.findAll(
      airportId,
      isActive !== undefined ? isActive === 'true' : undefined,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant group by ID with relations' })
  @ApiResponse({ status: 200, description: 'Tenant group details' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantGroupsService.findOne(id);
  }

  @Get(':id/hierarchy')
  @ApiOperation({ summary: 'Get full group hierarchy (parent + children tree)' })
  @ApiResponse({ status: 200, description: 'Group hierarchy tree' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  getHierarchy(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantGroupsService.getHierarchy(id);
  }

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('TenantGroup')
  @ApiOperation({ summary: 'Create a new tenant group (auto-generates code GRP-xxx)' })
  @ApiResponse({ status: 201, description: 'Tenant group created' })
  @ApiResponse({ status: 400, description: 'Validation error or circular hierarchy' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateTenantGroupDto) {
    return this.tenantGroupsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('TenantGroup')
  @ApiOperation({ summary: 'Update tenant group details' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  @ApiResponse({ status: 400, description: 'Validation error or circular hierarchy' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantGroupDto,
  ) {
    return this.tenantGroupsService.update(id, dto);
  }
}
