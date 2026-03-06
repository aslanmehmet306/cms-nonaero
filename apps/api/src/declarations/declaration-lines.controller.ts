import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { DeclarationLinesService } from './declaration-lines.service';
import { CreateDeclarationLineDto } from './dto/create-declaration-line.dto';

@ApiTags('Declaration Lines')
@ApiBearerAuth()
@Controller()
export class DeclarationLinesController {
  constructor(private readonly linesService: DeclarationLinesService) {}

  @Post('declarations/:declarationId/lines')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.tenant_admin)
  @Audit('DeclarationLine')
  @ApiOperation({ summary: 'Add a line item to a declaration' })
  @ApiResponse({ status: 201, description: 'Line created with computed net amount' })
  @ApiResponse({ status: 400, description: 'Declaration is frozen or validation error' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  create(
    @Param('declarationId', ParseUUIDPipe) declarationId: string,
    @Body() dto: CreateDeclarationLineDto,
  ) {
    return this.linesService.create(declarationId, dto);
  }

  @Get('declarations/:declarationId/lines')
  @ApiOperation({ summary: 'List line items for a declaration' })
  @ApiResponse({ status: 200, description: 'Declaration line list' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  findByDeclaration(@Param('declarationId', ParseUUIDPipe) declarationId: string) {
    return this.linesService.findByDeclaration(declarationId);
  }

  @Patch('declaration-lines/:id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.tenant_admin)
  @Audit('DeclarationLine')
  @ApiOperation({ summary: 'Update a declaration line item' })
  @ApiResponse({ status: 200, description: 'Line updated with recomputed net amount' })
  @ApiResponse({ status: 400, description: 'Parent declaration is frozen' })
  @ApiResponse({ status: 404, description: 'Line not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateDeclarationLineDto>,
  ) {
    return this.linesService.update(id, dto);
  }

  @Delete('declaration-lines/:id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('DeclarationLine')
  @ApiOperation({ summary: 'Delete a declaration line item' })
  @ApiResponse({ status: 200, description: 'Line deleted' })
  @ApiResponse({ status: 400, description: 'Parent declaration is frozen' })
  @ApiResponse({ status: 404, description: 'Line not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.linesService.remove(id);
  }
}
