import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AreaType, UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@ApiTags('Areas')
@ApiBearerAuth()
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  @ApiOperation({ summary: 'List all areas for an airport (flat list with optional filters)' })
  @ApiQuery({ name: 'airportId', required: true, description: 'Airport ID to scope areas' })
  @ApiQuery({ name: 'areaType', required: false, enum: AreaType, description: 'Filter by area type' })
  @ApiQuery({ name: 'isLeasable', required: false, type: Boolean, description: 'Filter by leasability' })
  @ApiResponse({ status: 200, description: 'Flat list of areas' })
  findAll(
    @Query('airportId') airportId: string,
    @Query('areaType') areaType?: AreaType,
    @Query('isLeasable') isLeasable?: string,
  ) {
    const filters: { areaType?: AreaType; isLeasable?: boolean } = {};

    if (areaType) filters.areaType = areaType;
    if (isLeasable !== undefined) filters.isLeasable = isLeasable === 'true';

    return this.areasService.findAll(airportId, filters);
  }

  @Get('roots')
  @ApiOperation({ summary: 'Get terminal-level areas with full subtrees for an airport' })
  @ApiQuery({ name: 'airportId', required: true, description: 'Airport ID' })
  @ApiResponse({ status: 200, description: 'Array of terminal areas with nested children (3 levels)' })
  findRoots(@Query('airportId') airportId: string) {
    return this.areasService.findRoots(airportId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get area by ID with parent and immediate children' })
  @ApiResponse({ status: 200, description: 'Area with parent and children' })
  @ApiResponse({ status: 404, description: 'Area not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.findOne(id);
  }

  @Get(':id/tree')
  @ApiOperation({ summary: 'Get full subtree (up to 3 levels deep) rooted at area' })
  @ApiResponse({ status: 200, description: 'Area with 3-level nested children' })
  @ApiResponse({ status: 404, description: 'Area not found' })
  findTree(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.findTree(id);
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.airport_admin)
  @Audit('Area')
  @ApiOperation({ summary: 'Create a new area in the hierarchy' })
  @ApiResponse({ status: 201, description: 'Area created' })
  @ApiResponse({ status: 400, description: 'Depth or areaType validation failed' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.airport_admin)
  @Audit('Area')
  @ApiOperation({ summary: 'Update an area (name, areaM2, isLeasable, isActive)' })
  @ApiResponse({ status: 200, description: 'Area updated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Area not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAreaDto) {
    return this.areasService.update(id, dto);
  }
}
