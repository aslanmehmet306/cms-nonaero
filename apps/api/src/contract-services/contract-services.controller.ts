import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { ContractServicesService } from './contract-services.service';
import { AssignServiceDto } from './dto/assign-service.dto';
import { UpdateServiceOverrideDto } from './dto/update-service-override.dto';

@ApiTags('Contract Services')
@ApiBearerAuth()
@Controller('contracts/:contractId/services')
export class ContractServicesController {
  constructor(private readonly contractServicesService: ContractServicesService) {}

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ContractService')
  @ApiOperation({ summary: 'Assign a service to a contract (draft contracts only)' })
  @ApiResponse({ status: 201, description: 'Service assigned to contract' })
  @ApiResponse({ status: 400, description: 'Contract not draft, service not published, or invalid override formula' })
  @ApiResponse({ status: 404, description: 'Contract, service definition, or override formula not found' })
  @ApiResponse({ status: 409, description: 'Service already assigned to this contract' })
  assignService(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: AssignServiceDto,
  ) {
    return this.contractServicesService.assignService(contractId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all services assigned to a contract' })
  @ApiResponse({ status: 200, description: 'List of assigned services with overrides' })
  listServices(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.contractServicesService.listServices(contractId);
  }

  @Patch(':serviceDefinitionId')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ContractService')
  @ApiOperation({ summary: 'Update override fields on a contract-service assignment (draft contracts only)' })
  @ApiResponse({ status: 200, description: 'Service override updated' })
  @ApiResponse({ status: 400, description: 'Contract not draft or invalid override formula' })
  @ApiResponse({ status: 404, description: 'Contract, service assignment, or override formula not found' })
  updateOverride(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('serviceDefinitionId', ParseUUIDPipe) serviceDefinitionId: string,
    @Body() dto: UpdateServiceOverrideDto,
  ) {
    return this.contractServicesService.updateOverride(contractId, serviceDefinitionId, dto);
  }

  @Delete(':serviceDefinitionId')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ContractService')
  @ApiOperation({ summary: 'Remove a service assignment from a contract (draft contracts only)' })
  @ApiResponse({ status: 200, description: 'Service removed from contract' })
  @ApiResponse({ status: 400, description: 'Contract is not in draft status' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  removeService(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('serviceDefinitionId', ParseUUIDPipe) serviceDefinitionId: string,
  ) {
    return this.contractServicesService.removeService(contractId, serviceDefinitionId);
  }
}
