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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { MetersService } from './meters.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';

@ApiTags('Meters')
@ApiBearerAuth()
@Controller('meters')
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  @Get()
  @ApiOperation({ summary: 'List meters for an area' })
  @ApiQuery({ name: 'areaId', required: true, description: 'Area ID to list meters for' })
  @ApiResponse({ status: 200, description: 'List of meters' })
  findByArea(@Query('areaId') areaId: string) {
    return this.metersService.findByArea(areaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get meter by ID' })
  @ApiResponse({ status: 200, description: 'Meter details with area' })
  @ApiResponse({ status: 404, description: 'Meter not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.metersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.airport_admin)
  @Audit('Meter')
  @ApiOperation({ summary: 'Create a new meter linked to an area' })
  @ApiResponse({ status: 201, description: 'Meter created' })
  @ApiResponse({ status: 404, description: 'Area not found' })
  create(@Body() dto: CreateMeterDto) {
    return this.metersService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.airport_admin)
  @Audit('Meter')
  @ApiOperation({ summary: 'Update a meter' })
  @ApiResponse({ status: 200, description: 'Meter updated' })
  @ApiResponse({ status: 404, description: 'Meter not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeterDto) {
    return this.metersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.super_admin, UserRole.airport_admin)
  @Audit('Meter')
  @ApiOperation({ summary: 'Delete a meter' })
  @ApiResponse({ status: 200, description: 'Meter deleted' })
  @ApiResponse({ status: 404, description: 'Meter not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.metersService.remove(id);
  }
}
