import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
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
import { TenantScoresService } from './tenant-scores.service';
import { QueryTenantScoresDto } from './dto/query-tenant-scores.dto';
import { CalculateScoreDto } from './dto/calculate-score.dto';

@ApiTags('Tenant Scores')
@ApiBearerAuth()
@Controller('tenant-scores')
export class TenantScoresController {
  constructor(private readonly tenantScoresService: TenantScoresService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant scores with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated tenant score list' })
  findAll(@Query() query: QueryTenantScoresDto) {
    return this.tenantScoresService.findAll(query);
  }

  @Post('calculate')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Calculate score for a specific tenant and period' })
  @ApiResponse({ status: 201, description: 'Score calculated and saved' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  calculateScore(@Body() dto: CalculateScoreDto) {
    return this.tenantScoresService.calculateScore(dto);
  }

  @Post('calculate-all')
  @Roles(UserRole.super_admin)
  @ApiOperation({ summary: 'Batch-calculate scores for all active tenants' })
  @ApiResponse({ status: 201, description: 'Batch calculation completed' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  calculateAll() {
    return this.tenantScoresService.calculateAll();
  }

  @Get('latest/:tenantId')
  @ApiOperation({ summary: 'Get the latest score for a tenant' })
  @ApiResponse({ status: 200, description: 'Latest tenant score' })
  @ApiResponse({ status: 404, description: 'No scores found for tenant' })
  getLatestScore(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.tenantScoresService.getLatestScore(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant score by ID' })
  @ApiResponse({ status: 200, description: 'Tenant score details' })
  @ApiResponse({ status: 404, description: 'Score not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantScoresService.findOne(id);
  }
}
