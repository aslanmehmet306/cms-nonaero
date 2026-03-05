import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.airport_admin, UserRole.auditor, UserRole.finance)
  @ApiOperation({ summary: 'List audit log entries with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  findAll(@Query() query: QueryAuditDto) {
    return this.auditService.findAll(query);
  }

  @Get('timeline/:entityType/:entityId')
  @Roles(UserRole.super_admin, UserRole.airport_admin, UserRole.auditor, UserRole.finance)
  @ApiOperation({
    summary: 'Get entity timeline with audit trail, field-level diffs, and domain context',
    description:
      'Returns the full change history of an entity with field-level diffs per entry. ' +
      'For Obligations, includes calculationTrace (formula + inputs + result). ' +
      'For Contracts, includes obligation count and status summary.',
  })
  @ApiResponse({
    status: 200,
    description: 'Entity timeline with changes and enrichment',
    schema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', example: 'Obligation' },
        entityId: { type: 'string', format: 'uuid' },
        enrichment: {
          type: 'object',
          nullable: true,
          description: 'Domain-specific context (calculationTrace for Obligations, obligationCount for Contracts, null for others)',
        },
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              action: { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE'] },
              actor: { type: 'string' },
              changes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    from: {},
                    to: {},
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  getEntityTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getEntityTimeline(entityType, entityId);
  }

  @Get('entity/:entityType/:entityId')
  @Roles(UserRole.super_admin, UserRole.airport_admin, UserRole.auditor, UserRole.finance)
  @ApiOperation({ summary: 'Get audit trail for a specific entity' })
  @ApiResponse({ status: 200, description: 'Audit trail entries for the entity' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  findByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.auditService.findByEntity(entityType, entityId);
  }
}
