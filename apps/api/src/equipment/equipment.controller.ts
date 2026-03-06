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
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { TransitionEquipmentDto } from './dto/transition-equipment.dto';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { QueryMeterReadingsDto } from './dto/query-meter-readings.dto';
import { ValidateMeterReadingDto } from './dto/validate-meter-reading.dto';
import { CreateMaintenanceLogDto } from './dto/create-maintenance-log.dto';

@ApiTags('Equipment')
@ApiBearerAuth()
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Equipment CRUD
  // ───────────────────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Equipment')
  @ApiOperation({ summary: 'Create a new equipment item in registered state' })
  @ApiResponse({ status: 201, description: 'Equipment created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateEquipmentDto) {
    return this.equipmentService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List equipment with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated equipment list' })
  findAll(@Query() query: QueryEquipmentDto) {
    return this.equipmentService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get equipment by ID with full relations' })
  @ApiResponse({ status: 200, description: 'Equipment details' })
  @ApiResponse({ status: 404, description: 'Equipment not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Equipment')
  @ApiOperation({ summary: 'Update equipment fields' })
  @ApiResponse({ status: 200, description: 'Equipment updated' })
  @ApiResponse({ status: 404, description: 'Equipment not found' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEquipmentDto) {
    return this.equipmentService.update(id, dto);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Machine
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/transition')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Equipment')
  @ApiOperation({ summary: 'Transition equipment status via state machine' })
  @ApiResponse({ status: 201, description: 'Equipment transitioned' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Equipment not found' })
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionEquipmentDto) {
    return this.equipmentService.transition(id, dto.status);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Meter Readings
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/meter-readings')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Equipment')
  @ApiOperation({ summary: 'Create a meter reading for metered equipment' })
  @ApiResponse({ status: 201, description: 'Meter reading created' })
  @ApiResponse({ status: 400, description: 'Equipment is not metered' })
  @ApiResponse({ status: 404, description: 'Equipment not found' })
  createMeterReading(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMeterReadingDto,
  ) {
    return this.equipmentService.createMeterReading(id, dto);
  }

  @Get(':id/meter-readings')
  @ApiOperation({ summary: 'List meter readings for an equipment item' })
  @ApiResponse({ status: 200, description: 'Paginated meter readings' })
  listMeterReadings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryMeterReadingsDto,
  ) {
    return this.equipmentService.listMeterReadings(id, query.page, query.limit);
  }

  @Patch(':id/meter-readings/:readingId/validate')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Equipment')
  @ApiOperation({ summary: 'Validate a meter reading' })
  @ApiResponse({ status: 200, description: 'Meter reading validated' })
  @ApiResponse({ status: 404, description: 'Meter reading not found' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  validateMeterReading(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('readingId', ParseUUIDPipe) readingId: string,
    @Body() dto: ValidateMeterReadingDto,
  ) {
    return this.equipmentService.validateMeterReading(id, readingId, dto);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Maintenance Logs
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/maintenance-logs')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Equipment')
  @ApiOperation({ summary: 'Create a maintenance log entry' })
  @ApiResponse({ status: 201, description: 'Maintenance log created' })
  @ApiResponse({ status: 404, description: 'Equipment not found' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  createMaintenanceLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMaintenanceLogDto,
  ) {
    return this.equipmentService.createMaintenanceLog(id, dto);
  }

  @Get(':id/maintenance-logs')
  @ApiOperation({ summary: 'List maintenance logs for an equipment item' })
  @ApiResponse({ status: 200, description: 'Paginated maintenance logs' })
  listMaintenanceLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryMeterReadingsDto,
  ) {
    return this.equipmentService.listMaintenanceLogs(id, query.page, query.limit);
  }
}
