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
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { UpdateCreditNoteDto } from './dto/update-credit-note.dto';
import { TransitionCreditNoteDto } from './dto/transition-credit-note.dto';
import { QueryCreditNotesDto } from './dto/query-credit-notes.dto';

@ApiTags('Credit Notes')
@ApiBearerAuth()
@Controller('credit-notes')
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('CreditNote')
  @ApiOperation({ summary: 'Create a new credit note in draft state' })
  @ApiResponse({ status: 201, description: 'Credit note created' })
  @ApiResponse({ status: 400, description: 'Validation error or ineligible contract status' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  create(@Body() dto: CreateCreditNoteDto) {
    return this.creditNotesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List credit notes with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated credit note list' })
  findAll(@Query() query: QueryCreditNotesDto) {
    return this.creditNotesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get credit note by ID with relations' })
  @ApiResponse({ status: 200, description: 'Credit note details' })
  @ApiResponse({ status: 404, description: 'Credit note not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditNotesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('CreditNote')
  @ApiOperation({ summary: 'Update draft credit note' })
  @ApiResponse({ status: 200, description: 'Credit note updated' })
  @ApiResponse({ status: 400, description: 'Only draft credit notes can be updated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Credit note not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreditNoteDto,
  ) {
    return this.creditNotesService.update(id, dto);
  }

  @Post(':id/transition')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('CreditNote')
  @ApiOperation({ summary: 'Transition credit note status via state machine' })
  @ApiResponse({ status: 201, description: 'Credit note transitioned' })
  @ApiResponse({ status: 400, description: 'Invalid state transition or missing preconditions' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Credit note not found' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionCreditNoteDto,
  ) {
    return this.creditNotesService.transition(id, dto.status, {
      approvedBy: dto.approvedBy,
    });
  }
}
