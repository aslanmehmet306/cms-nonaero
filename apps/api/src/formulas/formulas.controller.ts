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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole, FormulaStatus } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { FormulasService } from './formulas.service';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { UpdateFormulaDto } from './dto/update-formula.dto';
import { DryRunFormulaDto } from './dto/dry-run-formula.dto';

@ApiTags('Formulas')
@ApiBearerAuth()
@Controller('formulas')
export class FormulasController {
  constructor(private readonly formulasService: FormulasService) {}

  @Get()
  @ApiOperation({ summary: 'List formulas for an airport with optional status filter' })
  @ApiQuery({ name: 'airportId', required: true, description: 'Airport ID' })
  @ApiQuery({ name: 'status', required: false, enum: FormulaStatus, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Formula list' })
  findAll(
    @Query('airportId') airportId: string,
    @Query('status') status?: FormulaStatus,
  ) {
    return this.formulasService.findAll(airportId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get formula by ID including linked service definitions' })
  @ApiResponse({ status: 200, description: 'Formula details' })
  @ApiResponse({ status: 404, description: 'Formula not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.formulasService.findOne(id);
  }

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Formula')
  @ApiOperation({ summary: 'Create a new formula (validates expression via formula-engine)' })
  @ApiResponse({ status: 201, description: 'Formula created with status=draft' })
  @ApiResponse({ status: 400, description: 'Invalid expression or validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateFormulaDto) {
    return this.formulasService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Formula')
  @ApiOperation({ summary: 'Update draft formula (published formulas are immutable)' })
  @ApiResponse({ status: 200, description: 'Formula updated' })
  @ApiResponse({ status: 400, description: 'Published formula is immutable or invalid expression' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Formula not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFormulaDto) {
    return this.formulasService.update(id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Formula')
  @ApiOperation({ summary: 'Publish a draft formula (sets status=published, immutable after)' })
  @ApiResponse({ status: 201, description: 'Formula published' })
  @ApiResponse({ status: 400, description: 'Already published or invalid expression' })
  @ApiResponse({ status: 404, description: 'Formula not found' })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.formulasService.publish(id);
  }

  @Post(':id/new-version')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Formula')
  @ApiOperation({ summary: 'Create a new version of a formula (version+1, status=draft)' })
  @ApiResponse({ status: 201, description: 'New formula version created' })
  @ApiResponse({ status: 404, description: 'Formula not found' })
  createNewVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: UpdateFormulaDto,
  ) {
    return this.formulasService.createNewVersion(id, dto);
  }

  @Post(':id/deprecate')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Formula')
  @ApiOperation({ summary: 'Deprecate (archive) a published formula' })
  @ApiResponse({ status: 201, description: 'Formula archived' })
  @ApiResponse({ status: 400, description: 'Only published formulas can be deprecated' })
  @ApiResponse({ status: 404, description: 'Formula not found' })
  deprecate(@Param('id', ParseUUIDPipe) id: string) {
    return this.formulasService.deprecate(id);
  }

  @Post(':id/dry-run')
  @ApiOperation({
    summary: 'Dry-run formula evaluation with sample data — returns result + trace',
  })
  @ApiResponse({ status: 201, description: 'Evaluation result with trace' })
  @ApiResponse({ status: 400, description: 'Evaluation failed' })
  @ApiResponse({ status: 404, description: 'Formula not found' })
  dryRun(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DryRunFormulaDto,
  ) {
    return this.formulasService.dryRun(id, dto?.variables);
  }
}
