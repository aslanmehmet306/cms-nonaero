import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { DeclarationsService } from './declarations.service';
import { CreateDeclarationDto } from './dto/create-declaration.dto';
import { UpdateDeclarationDto } from './dto/update-declaration.dto';
import { QueryDeclarationsDto } from './dto/query-declarations.dto';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';

const ALLOWED_UPLOAD_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

@ApiTags('Declarations')
@ApiBearerAuth()
@Controller('declarations')
export class DeclarationsController {
  constructor(private readonly declarationsService: DeclarationsService) {}

  // ─── Declaration CRUD ────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.tenant_admin)
  @Audit('Declaration')
  @ApiOperation({ summary: 'Create a new declaration in draft state' })
  @ApiResponse({ status: 201, description: 'Declaration created' })
  @ApiResponse({ status: 400, description: 'Validation error or contract not found' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateDeclarationDto) {
    return this.declarationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List declarations with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated declaration list' })
  findAll(@Query() query: QueryDeclarationsDto) {
    return this.declarationsService.findAll(query);
  }

  @Get('template')
  @ApiOperation({ summary: 'Download CSV template for bulk upload' })
  @ApiResponse({ status: 200, description: 'CSV template with column headers' })
  getTemplate() {
    return this.declarationsService.getTemplate();
  }

  // ─── Meter Reading (placed before :id to avoid UUID parse collision) ──────

  @Post('meter-reading')
  @Roles(
    UserRole.commercial_manager,
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.tenant_admin,
  )
  @Audit('Declaration')
  @ApiOperation({ summary: 'Submit a meter reading (creates auto-submitted declaration with consumption calculation)' })
  @ApiResponse({ status: 201, description: 'Meter reading declaration created and submitted' })
  @ApiResponse({ status: 400, description: 'Negative consumption or invalid data' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  submitMeterReading(@Body() dto: CreateMeterReadingDto) {
    return this.declarationsService.submitMeterReading(dto);
  }

  @Post('meter-reading/upload')
  @Roles(
    UserRole.commercial_manager,
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
  )
  @Audit('Declaration')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_UPLOAD_TYPES.includes(file.mimetype));
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        airportId: { type: 'string', format: 'uuid' },
        tenantId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiOperation({ summary: 'Bulk upload meter readings from CSV file' })
  @ApiResponse({ status: 201, description: 'Upload summary with created count and per-row errors' })
  uploadMeterReadings(
    @UploadedFile() file: Express.Multer.File,
    @Body('airportId') airportId: string,
    @Body('tenantId') tenantId: string,
  ) {
    return this.declarationsService.parseMeterReadingUpload(file, airportId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get declaration by ID with lines and attachments' })
  @ApiResponse({ status: 200, description: 'Declaration details' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.tenant_admin)
  @Audit('Declaration')
  @ApiOperation({ summary: 'Update declaration (frozen declarations are immutable)' })
  @ApiResponse({ status: 200, description: 'Declaration updated' })
  @ApiResponse({ status: 400, description: 'Declaration is frozen' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeclarationDto) {
    return this.declarationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin)
  @Audit('Declaration')
  @ApiOperation({ summary: 'Delete a declaration (frozen declarations cannot be deleted)' })
  @ApiResponse({ status: 200, description: 'Declaration deleted' })
  @ApiResponse({ status: 400, description: 'Declaration is frozen' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.remove(id);
  }

  // ─── State Machine Transitions ───────────────────────────────────────────

  @Post(':id/submit')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.tenant_admin)
  @Audit('Declaration')
  @ApiOperation({ summary: 'Submit declaration (draft -> submitted)' })
  @ApiResponse({ status: 201, description: 'Declaration submitted' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.submit(id);
  }

  @Post(':id/validate')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.finance)
  @Audit('Declaration')
  @ApiOperation({ summary: 'Validate declaration (submitted -> validated)' })
  @ApiResponse({ status: 201, description: 'Declaration validated' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  validate(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.validate(id);
  }

  @Post(':id/reject')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.finance)
  @Audit('Declaration')
  @ApiOperation({ summary: 'Reject declaration (submitted or validated -> rejected)' })
  @ApiResponse({ status: 201, description: 'Declaration rejected' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.reject(id);
  }

  @Post(':id/redraft')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.tenant_admin)
  @Audit('Declaration')
  @ApiOperation({ summary: 'Re-draft declaration for correction (rejected -> draft)' })
  @ApiResponse({ status: 201, description: 'Declaration re-drafted' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  redraft(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.redraft(id);
  }

  @Post(':id/freeze')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.finance)
  @Audit('Declaration')
  @ApiOperation({ summary: 'Freeze declaration (validated -> frozen) — makes it immutable' })
  @ApiResponse({ status: 201, description: 'Declaration frozen' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  freeze(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.freeze(id);
  }

  // ─── Bulk Upload ─────────────────────────────────────────────────────────

  @Post('upload')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.tenant_admin)
  @Audit('Declaration')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_UPLOAD_TYPES.includes(file.mimetype));
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        airportId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiOperation({ summary: 'Bulk upload declarations from CSV or Excel file' })
  @ApiResponse({ status: 201, description: 'Upload summary with created count and per-row errors' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('airportId') airportId: string,
  ) {
    return this.declarationsService.parseAndValidateUpload(file, airportId);
  }

  // ─── Attachments ─────────────────────────────────────────────────────────

  @Post(':id/attachments')
  @Roles(UserRole.commercial_manager, UserRole.airport_admin, UserRole.super_admin, UserRole.tenant_admin)
  @Audit('Declaration')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload attachment (POS report, Z report, etc.) to a declaration' })
  @ApiResponse({ status: 201, description: 'Attachment stored' })
  @ApiResponse({ status: 400, description: 'File exceeds 10MB limit' })
  createAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const userId = req.user?.sub ?? req.user?.id ?? 'unknown';
    return this.declarationsService.createAttachment(id, file, userId);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'List attachments for a declaration' })
  @ApiResponse({ status: 200, description: 'Attachment list' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  findAttachments(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.findAttachments(id);
  }
}
