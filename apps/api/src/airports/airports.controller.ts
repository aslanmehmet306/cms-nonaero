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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AirportsService } from './airports.service';
import { CreateAirportDto } from './dto/create-airport.dto';
import { UpdateAirportDto } from './dto/update-airport.dto';

@ApiTags('Airports')
@ApiBearerAuth()
@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.airport_admin)
  @ApiOperation({ summary: 'List all airports' })
  @ApiResponse({ status: 200, description: 'Array of airports with area counts' })
  findAll(@Query() _query?: Record<string, string>) {
    return this.airportsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get airport by ID' })
  @ApiResponse({ status: 200, description: 'Airport details with areas count' })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.airportsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.super_admin)
  @Audit('Airport')
  @ApiOperation({ summary: 'Create a new airport (super_admin only)' })
  @ApiResponse({ status: 201, description: 'Airport created' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateAirportDto) {
    return this.airportsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.airport_admin)
  @Audit('Airport')
  @ApiOperation({ summary: 'Update an airport' })
  @ApiResponse({ status: 200, description: 'Airport updated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAirportDto) {
    return this.airportsService.update(id, dto);
  }
}
