import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { ObligationsService } from './obligations.service';
import { QueryObligationsDto } from './dto/query-obligations.dto';

/**
 * ObligationsController — read-only obligation endpoints.
 *
 * Obligations are system-generated (via contract.published event) and
 * cannot be created or updated via the API in Phase 3.
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
}
