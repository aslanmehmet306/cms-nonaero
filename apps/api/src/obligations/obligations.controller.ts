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
import { Audit } from '../common/decorators/audit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ObligationsService } from './obligations.service';
import { QueryObligationsDto } from './dto/query-obligations.dto';
import { TransitionObligationDto } from './dto/transition-obligation.dto';
import { CalculateObligationDto } from './dto/calculate-obligation.dto';

/**
 * ObligationsController — obligation read and state-transition endpoints.
 *
 * Obligations are system-generated (via contract.published event).
 * Mutations are limited to state transitions via PATCH /obligations/:id/transition.
 */
@ApiTags('Obligations')
@ApiBearerAuth()
@Controller('obligations')
export class ObligationsController {
  constructor(private readonly obligationsService: ObligationsService) {}

  @Get()
  @Roles(
    UserRole.commercial_manager,
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.auditor,
  )
  @ApiOperation({ summary: 'List obligations with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated obligation list' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  findAll(@Query() query: QueryObligationsDto) {
    return this.obligationsService.findAll(query);
  }

  @Get(':id')
  @Roles(
    UserRole.commercial_manager,
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.auditor,
  )
  @ApiOperation({ summary: 'Get obligation by ID with contract and tenant relations' })
  @ApiResponse({ status: 200, description: 'Obligation details' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Obligation not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.obligationsService.findOne(id);
  }

  @Patch(':id/transition')
  @Roles(
    UserRole.commercial_manager,
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
  )
  @Audit('Obligation')
  @ApiOperation({ summary: 'Transition an obligation to a new status' })
  @ApiResponse({ status: 200, description: 'Obligation updated with new status' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Obligation not found' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionObligationDto,
  ) {
    return this.obligationsService.transitionObligation(id, dto.toStatus, {
      skippedReason: dto.skippedReason,
    });
  }

  @Get(':id/trace')
  @Roles(
    UserRole.commercial_manager,
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.auditor,
  )
  @ApiOperation({ summary: 'Get the calculation trace for an obligation (UI drill-down convenience)' })
  @ApiResponse({ status: 200, description: 'Calculation trace object or null if not yet calculated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Obligation not found' })
  async getTrace(@Param('id', ParseUUIDPipe) id: string) {
    const obligation = await this.obligationsService.findOne(id);
    return obligation.calculationTrace ?? null;
  }

  @Post(':id/calculate')
  @Roles(
    UserRole.commercial_manager,
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
  )
  @Audit('Obligation')
  @ApiOperation({ summary: 'Manually trigger formula evaluation for an obligation' })
  @ApiResponse({ status: 201, description: 'Obligation calculated and status updated to ready or skipped' })
  @ApiResponse({ status: 400, description: 'Formula evaluation failed or obligation not found' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Obligation not found' })
  async calculate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CalculateObligationDto,
  ) {
    await this.obligationsService.calculateObligation(id, dto.declarationId);
    return this.obligationsService.findOne(id);
  }
}
