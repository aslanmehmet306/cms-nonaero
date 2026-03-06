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
import { AreaOccupanciesService } from './area-occupancies.service';
import { CreateAreaOccupancyDto } from './dto/create-area-occupancy.dto';
import { UpdateAreaOccupancyDto } from './dto/update-area-occupancy.dto';
import { TransitionAreaOccupancyDto } from './dto/transition-area-occupancy.dto';
import { QueryAreaOccupanciesDto } from './dto/query-area-occupancies.dto';

@ApiTags('Area Occupancies')
@ApiBearerAuth()
@Controller('area-occupancies')
export class AreaOccupanciesController {
  constructor(
    private readonly areaOccupanciesService: AreaOccupanciesService,
  ) {}

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaOccupancy')
  @ApiOperation({ summary: 'Create a new area occupancy in planned state' })
  @ApiResponse({ status: 201, description: 'Area occupancy created' })
  @ApiResponse({ status: 400, description: 'Validation error or overlap conflict' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Area not found' })
  create(@Body() dto: CreateAreaOccupancyDto) {
    return this.areaOccupanciesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List area occupancies with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated area occupancy list' })
  findAll(@Query() query: QueryAreaOccupanciesDto) {
    return this.areaOccupanciesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get area occupancy by ID with full relations' })
  @ApiResponse({ status: 200, description: 'Area occupancy details' })
  @ApiResponse({ status: 404, description: 'Area occupancy not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.areaOccupanciesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaOccupancy')
  @ApiOperation({ summary: 'Update area occupancy details' })
  @ApiResponse({ status: 200, description: 'Area occupancy updated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Area occupancy not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAreaOccupancyDto,
  ) {
    return this.areaOccupanciesService.update(id, dto);
  }

  @Post(':id/transition')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('AreaOccupancy')
  @ApiOperation({ summary: 'Transition area occupancy status via state machine' })
  @ApiResponse({ status: 201, description: 'Area occupancy transitioned' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Area occupancy not found' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionAreaOccupancyDto,
  ) {
    return this.areaOccupanciesService.transition(id, dto.status);
  }
}
