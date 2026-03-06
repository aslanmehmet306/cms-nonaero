import {
  Body,
  Controller,
  Delete,
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
import { AreaAllocationsService } from './area-allocations.service';
import { CreateAreaAllocationDto } from './dto/create-area-allocation.dto';
import { UpdateAreaAllocationDto } from './dto/update-area-allocation.dto';
import { TransitionAreaAllocationDto } from './dto/transition-area-allocation.dto';
import { UpsertShareDto } from './dto/upsert-share.dto';
import { QueryAreaAllocationsDto } from './dto/query-area-allocations.dto';

@ApiTags('Area Allocations')
@ApiBearerAuth()
@Controller('area-allocations')
export class AreaAllocationsController {
  constructor(private readonly areaAllocationsService: AreaAllocationsService) {}

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaAllocation')
  @ApiOperation({ summary: 'Create a new area allocation in draft status' })
  @ApiResponse({ status: 201, description: 'Area allocation created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Area not found' })
  create(@Body() dto: CreateAreaAllocationDto) {
    return this.areaAllocationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List area allocations with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated area allocation list' })
  findAll(@Query() query: QueryAreaAllocationsDto) {
    return this.areaAllocationsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get area allocation by ID with relations' })
  @ApiResponse({ status: 200, description: 'Area allocation details' })
  @ApiResponse({ status: 404, description: 'Allocation not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.areaAllocationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaAllocation')
  @ApiOperation({ summary: 'Update a draft area allocation' })
  @ApiResponse({ status: 200, description: 'Allocation updated' })
  @ApiResponse({ status: 400, description: 'Only draft allocations can be updated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Allocation not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAreaAllocationDto,
  ) {
    return this.areaAllocationsService.update(id, dto);
  }

  @Post(':id/transition')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaAllocation')
  @ApiOperation({ summary: 'Transition area allocation status via state machine' })
  @ApiResponse({ status: 201, description: 'Allocation transitioned' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Allocation not found' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionAreaAllocationDto,
  ) {
    return this.areaAllocationsService.transition(id, dto.status);
  }

  @Post(':id/shares')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaAllocation')
  @ApiOperation({ summary: 'Upsert a share for a draft area allocation' })
  @ApiResponse({ status: 201, description: 'Share upserted' })
  @ApiResponse({ status: 400, description: 'Only draft allocations allow share changes' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Allocation not found' })
  upsertShare(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertShareDto,
  ) {
    return this.areaAllocationsService.upsertShare(id, dto);
  }

  @Get(':id/shares')
  @ApiOperation({ summary: 'List all shares for an area allocation' })
  @ApiResponse({ status: 200, description: 'List of shares with tenant info' })
  listShares(@Param('id', ParseUUIDPipe) id: string) {
    return this.areaAllocationsService.listShares(id);
  }

  @Delete(':id/shares/:tenantId')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaAllocation')
  @ApiOperation({ summary: 'Remove a share from a draft area allocation' })
  @ApiResponse({ status: 200, description: 'Share removed' })
  @ApiResponse({ status: 400, description: 'Only draft allocations allow share removal' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Allocation not found' })
  removeShare(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.areaAllocationsService.removeShare(id, tenantId);
  }

  @Post(':id/calculate')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaAllocation')
  @ApiOperation({ summary: 'Calculate share amounts (totalCost * shareRatio)' })
  @ApiResponse({ status: 201, description: 'Shares calculated' })
  @ApiResponse({ status: 400, description: 'Only approved or active allocations' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Allocation not found' })
  calculateShares(@Param('id', ParseUUIDPipe) id: string) {
    return this.areaAllocationsService.calculateShares(id);
  }
}
