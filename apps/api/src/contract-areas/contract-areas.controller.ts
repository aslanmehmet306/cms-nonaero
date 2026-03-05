import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { ContractAreasService } from './contract-areas.service';
import { AssignAreaDto } from './dto/assign-area.dto';

@ApiTags('Contract Areas')
@ApiBearerAuth()
@Controller('contracts/:contractId/areas')
export class ContractAreasController {
  constructor(private readonly contractAreasService: ContractAreasService) {}

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ContractArea')
  @ApiOperation({ summary: 'Assign an area to a contract (draft contracts only)' })
  @ApiResponse({ status: 201, description: 'Area assigned to contract' })
  @ApiResponse({ status: 400, description: 'Contract is not in draft status' })
  @ApiResponse({ status: 404, description: 'Contract or area not found' })
  @ApiResponse({ status: 409, description: 'Area already assigned to this contract' })
  assignArea(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: AssignAreaDto,
  ) {
    return this.contractAreasService.assignArea(contractId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all areas assigned to a contract' })
  @ApiResponse({ status: 200, description: 'List of assigned areas' })
  listAreas(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.contractAreasService.listAreas(contractId);
  }

  @Delete(':areaId')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('ContractArea')
  @ApiOperation({ summary: 'Remove an area assignment from a contract (draft contracts only)' })
  @ApiResponse({ status: 200, description: 'Area removed from contract' })
  @ApiResponse({ status: 400, description: 'Contract is not in draft status' })
  @ApiResponse({ status: 404, description: 'Contract or assignment not found' })
  removeArea(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ) {
    return this.contractAreasService.removeArea(contractId, areaId);
  }
}
