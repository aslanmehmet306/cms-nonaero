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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { TransitionContractDto } from './dto/transition-contract.dto';
import { AmendContractDto } from './dto/amend-contract.dto';
import { QueryContractsDto } from './dto/query-contracts.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Contract')
  @ApiOperation({ summary: 'Create a new contract in draft state' })
  @ApiResponse({ status: 201, description: 'Contract created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List contracts with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated contract list' })
  findAll(@Query() query: QueryContractsDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID with full relations' })
  @ApiResponse({ status: 200, description: 'Contract details' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Contract')
  @ApiOperation({ summary: 'Update draft contract (published/active contracts are immutable)' })
  @ApiResponse({ status: 200, description: 'Contract updated' })
  @ApiResponse({ status: 400, description: 'Only draft contracts can be updated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Post(':id/transition')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Contract')
  @ApiOperation({ summary: 'Transition contract status via state machine' })
  @ApiResponse({ status: 201, description: 'Contract transitioned' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionContractDto) {
    return this.contractsService.transition(id, dto.status, {
      terminationReason: dto.terminationReason,
    });
  }

  @Post(':id/amend')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Contract')
  @ApiOperation({ summary: 'Create an amendment (new version) for an active contract' })
  @ApiResponse({ status: 201, description: 'Amendment created with pending_amendment status' })
  @ApiResponse({ status: 400, description: 'Contract not active, invalid date, or existing pending amendment' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  amend(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AmendContractDto) {
    return this.contractsService.amend(id, dto);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get version history with field-level diffs' })
  @ApiResponse({ status: 200, description: 'Version history' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  getVersionHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.getVersionHistory(id);
  }

  @Get(':id/snapshot')
  @ApiOperation({ summary: 'Get full contract snapshot with all relations (for debugging/preview)' })
  @ApiResponse({ status: 200, description: 'Contract snapshot JSON' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  createSnapshot(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.createSnapshot(id);
  }
}
