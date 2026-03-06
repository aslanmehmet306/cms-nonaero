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
import { ContractEquipmentService } from './contract-equipment.service';
import { AssignEquipmentDto } from './dto/assign-equipment.dto';
import { UpdateContractEquipmentDto } from './dto/update-contract-equipment.dto';

@ApiTags('Contract Equipment')
@ApiBearerAuth()
@Controller('contracts/:contractId/equipment')
export class ContractEquipmentController {
  constructor(private readonly contractEquipmentService: ContractEquipmentService) {}

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ContractEquipment')
  @ApiOperation({ summary: 'Assign equipment to a contract (draft contracts only)' })
  @ApiResponse({ status: 201, description: 'Equipment assigned to contract' })
  @ApiResponse({ status: 400, description: 'Contract is not in draft status or equipment is not commissioned' })
  @ApiResponse({ status: 404, description: 'Contract or equipment not found' })
  @ApiResponse({ status: 409, description: 'Equipment already assigned to this contract' })
  assignEquipment(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: AssignEquipmentDto,
  ) {
    return this.contractEquipmentService.assignEquipment(contractId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all equipment assigned to a contract' })
  @ApiResponse({ status: 200, description: 'List of assigned equipment' })
  listEquipment(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.contractEquipmentService.listEquipment(contractId);
  }

  @Patch(':equipmentId')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ContractEquipment')
  @ApiOperation({ summary: 'Update an equipment assignment on a contract (draft contracts only)' })
  @ApiResponse({ status: 200, description: 'Equipment assignment updated' })
  @ApiResponse({ status: 400, description: 'Contract is not in draft status' })
  @ApiResponse({ status: 404, description: 'Contract or assignment not found' })
  updateEquipment(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Body() dto: UpdateContractEquipmentDto,
  ) {
    return this.contractEquipmentService.updateEquipment(contractId, equipmentId, dto);
  }

  @Delete(':equipmentId')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ContractEquipment')
  @ApiOperation({ summary: 'Remove an equipment assignment from a contract (draft contracts only)' })
  @ApiResponse({ status: 200, description: 'Equipment removed from contract' })
  @ApiResponse({ status: 400, description: 'Contract is not in draft status' })
  @ApiResponse({ status: 404, description: 'Contract or assignment not found' })
  removeEquipment(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
  ) {
    return this.contractEquipmentService.removeEquipment(contractId, equipmentId);
  }
}
