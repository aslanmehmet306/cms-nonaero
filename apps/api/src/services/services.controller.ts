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
import { UserRole, ServiceStatus, ServiceType } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List service definitions for an airport' })
  @ApiQuery({ name: 'airportId', required: true, description: 'Airport ID' })
  @ApiQuery({ name: 'serviceType', required: false, enum: ServiceType, description: 'Filter by type' })
  @ApiQuery({ name: 'status', required: false, enum: ServiceStatus, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Service definition list' })
  findAll(
    @Query('airportId') airportId: string,
    @Query('serviceType') serviceType?: ServiceType,
    @Query('status') status?: ServiceStatus,
  ) {
    return this.servicesService.findAll(airportId, serviceType, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service definition by ID' })
  @ApiResponse({ status: 200, description: 'Service definition details' })
  @ApiResponse({ status: 404, description: 'Service definition not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ServiceDefinition')
  @ApiOperation({ summary: 'Create a new service definition (status=draft)' })
  @ApiResponse({ status: 201, description: 'Service definition created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Formula not found' })
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ServiceDefinition')
  @ApiOperation({ summary: 'Update draft service definition (published are immutable)' })
  @ApiResponse({ status: 200, description: 'Service definition updated' })
  @ApiResponse({ status: 400, description: 'Published service is immutable' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Service definition not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ServiceDefinition')
  @ApiOperation({ summary: 'Publish a service definition (validates formula is published)' })
  @ApiResponse({ status: 201, description: 'Service definition published' })
  @ApiResponse({ status: 400, description: 'Already published or formula not published' })
  @ApiResponse({ status: 404, description: 'Service definition not found' })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.publish(id);
  }

  @Post(':id/new-version')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ServiceDefinition')
  @ApiOperation({ summary: 'Create a new version of a service definition (version+1, status=draft)' })
  @ApiResponse({ status: 201, description: 'New service definition version created' })
  @ApiResponse({ status: 404, description: 'Service definition not found' })
  createNewVersion(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.createNewVersion(id);
  }

  @Post(':id/deprecate')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ServiceDefinition')
  @ApiOperation({ summary: 'Deprecate a published service definition' })
  @ApiResponse({ status: 201, description: 'Service definition deprecated' })
  @ApiResponse({ status: 400, description: 'Only published services can be deprecated' })
  @ApiResponse({ status: 404, description: 'Service definition not found' })
  deprecate(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.deprecate(id);
  }
}
