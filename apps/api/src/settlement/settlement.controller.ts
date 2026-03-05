import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SettlementService } from './settlement.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { UserRole, SettlementType } from '@shared-types/enums';

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

class TrueUpDto {
  @IsISO8601()
  fiscalYearStart!: string;

  @IsISO8601()
  fiscalYearEnd!: string;
}

class QuerySettlementEntriesDto {
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsEnum(SettlementType)
  settlementType?: SettlementType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Settlement')
@ApiBearerAuth()
@Controller('settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /**
   * POST /settlement/true-up/:contractId
   * Trigger year-end MAG true-up for a contract. Admin-only.
   */
  @Post('true-up/:contractId')
  @Roles(UserRole.finance, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Settlement')
  @ApiOperation({ summary: 'Trigger year-end MAG true-up' })
  @ApiResponse({ status: 201, description: 'True-up calculated' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async trueUp(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: TrueUpDto,
  ) {
    const result = await this.settlementService.calculateYearEndTrueUp(
      contractId,
      new Date(dto.fiscalYearStart),
      new Date(dto.fiscalYearEnd),
    );
    return {
      contractId,
      trueUpAmount: result.trueUpAmount.toString(),
      obligationCreated: result.created,
    };
  }

  /**
   * GET /settlement/entries
   * List settlement entries with pagination and filters.
   */
  @Get('entries')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.commercial_manager,
    UserRole.auditor,
  )
  @ApiOperation({ summary: 'List settlement entries' })
  @ApiResponse({ status: 200, description: 'Paginated settlement entries' })
  async listEntries(@Query() query: QuerySettlementEntriesDto) {
    return this.settlementService.findAllEntries(query);
  }
}
