import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeclarationStatus, DeclarationType } from '@shared-types/enums';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { CreateDeclarationDto } from './dto/create-declaration.dto';
import { UpdateDeclarationDto } from './dto/update-declaration.dto';
import { QueryDeclarationsDto } from './dto/query-declarations.dto';
import { CreateDeclarationLineDto } from './dto/create-declaration-line.dto';
import { DeclarationSubmittedEvent } from './events/declaration-submitted.event';

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid status transitions for the Declaration state machine.
 * Frozen is terminal — no further transitions allowed.
 */
const DECLARATION_TRANSITIONS: Record<DeclarationStatus, DeclarationStatus[]> = {
  [DeclarationStatus.draft]: [DeclarationStatus.submitted, DeclarationStatus.rejected],
  [DeclarationStatus.submitted]: [DeclarationStatus.validated, DeclarationStatus.rejected],
  [DeclarationStatus.validated]: [DeclarationStatus.frozen, DeclarationStatus.rejected],
  [DeclarationStatus.rejected]: [DeclarationStatus.draft],
  [DeclarationStatus.frozen]: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Upload Types
// ─────────────────────────────────────────────────────────────────────────────

interface DeclarationRow {
  rowIndex: number;
  tenantId: string;
  contractId: string;
  periodStart: string;
  periodEnd: string;
  category: string;
  grossAmount: string;
  deductions: string;
}

export interface UploadError {
  row: number;
  field: string;
  rule: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class DeclarationsService {
  private readonly logger = new Logger(DeclarationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventEmitter: EventEmitter2,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // CRUD
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new declaration in draft status.
   * Validates that the referenced contract exists.
   */
  async create(dto: CreateDeclarationDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${dto.contractId} not found`);
    }

    return this.prisma.declaration.create({
      data: {
        airportId: dto.airportId,
        tenantId: dto.tenantId,
        contractId: dto.contractId,
        declarationType: dto.declarationType,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        status: DeclarationStatus.draft,
      },
      include: {
        lines: true,
        attachments: true,
      },
    });
  }

  /**
   * List declarations with optional filters and standard pagination envelope.
   */
  async findAll(query: QueryDeclarationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.contractId) where.contractId = query.contractId;
    if (query.declarationType) where.declarationType = query.declarationType;
    if (query.status) where.status = query.status;
    if (query.periodStart) where.periodStart = new Date(query.periodStart);
    if (query.periodEnd) where.periodEnd = new Date(query.periodEnd);

    const [data, total] = await Promise.all([
      this.prisma.declaration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: true,
          attachments: true,
        },
      }),
      this.prisma.declaration.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single declaration by ID with full relations.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const declaration = await this.prisma.declaration.findUnique({
      where: { id },
      include: {
        lines: true,
        attachments: true,
      },
    });

    if (!declaration) {
      throw new NotFoundException(`Declaration ${id} not found`);
    }

    return declaration;
  }

  /**
   * Update a declaration's mutable fields.
   * Frozen declarations cannot be updated.
   */
  async update(id: string, dto: UpdateDeclarationDto) {
    const declaration = await this.findOne(id);

    if (declaration.frozenToken) {
      throw new BadRequestException('Declaration is frozen');
    }

    return this.prisma.declaration.update({
      where: { id },
      data: {
        ...(dto.airportId !== undefined ? { airportId: dto.airportId } : {}),
        ...(dto.tenantId !== undefined ? { tenantId: dto.tenantId } : {}),
        ...(dto.contractId !== undefined ? { contractId: dto.contractId } : {}),
        ...(dto.declarationType !== undefined ? { declarationType: dto.declarationType } : {}),
        ...(dto.periodStart !== undefined ? { periodStart: new Date(dto.periodStart) } : {}),
        ...(dto.periodEnd !== undefined ? { periodEnd: new Date(dto.periodEnd) } : {}),
      },
    });
  }

  /**
   * Delete a declaration.
   * Frozen declarations cannot be deleted.
   */
  async remove(id: string) {
    const declaration = await this.findOne(id);

    if (declaration.frozenToken) {
      throw new BadRequestException('Declaration is frozen');
    }

    return this.prisma.declaration.delete({ where: { id } });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Machine Transitions
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Validate that the transition from current status to target status is allowed.
   * Throws BadRequestException if invalid.
   */
  private assertTransition(current: DeclarationStatus, target: DeclarationStatus): void {
    const allowed = DECLARATION_TRANSITIONS[current] ?? [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Invalid state transition: ${current} → ${target}. Allowed from ${current}: [${allowed.join(', ')}]`,
      );
    }
  }

  /**
   * Transition draft -> submitted.
   * Sets submittedAt and emits declaration.submitted event.
   */
  async submit(id: string) {
    const declaration = await this.findOne(id);
    this.assertTransition(declaration.status as DeclarationStatus, DeclarationStatus.submitted);

    const updated = await this.prisma.declaration.update({
      where: { id },
      data: {
        status: DeclarationStatus.submitted,
        submittedAt: new Date(),
      },
    });

    // Emit event for downstream listeners (e.g., obligation calculation)
    if (this.eventEmitter) {
      const event = new DeclarationSubmittedEvent(
        id,
        declaration.contractId,
        declaration.tenantId,
        declaration.periodStart,
        declaration.periodEnd,
        declaration.declarationType as DeclarationType,
      );
      this.eventEmitter.emit('declaration.submitted', event);
    }

    this.logger.log(`Declaration ${id} submitted`);
    return updated;
  }

  /**
   * Transition submitted -> validated.
   */
  async validate(id: string) {
    const declaration = await this.findOne(id);
    this.assertTransition(declaration.status as DeclarationStatus, DeclarationStatus.validated);

    const updated = await this.prisma.declaration.update({
      where: { id },
      data: { status: DeclarationStatus.validated },
    });

    this.logger.log(`Declaration ${id} validated`);
    return updated;
  }

  /**
   * Transition submitted->rejected or validated->rejected.
   */
  async reject(id: string) {
    const declaration = await this.findOne(id);
    this.assertTransition(declaration.status as DeclarationStatus, DeclarationStatus.rejected);

    const updated = await this.prisma.declaration.update({
      where: { id },
      data: { status: DeclarationStatus.rejected },
    });

    this.logger.log(`Declaration ${id} rejected`);
    return updated;
  }

  /**
   * Transition rejected -> draft (re-draft for correction).
   */
  async redraft(id: string) {
    const declaration = await this.findOne(id);
    this.assertTransition(declaration.status as DeclarationStatus, DeclarationStatus.draft);

    const updated = await this.prisma.declaration.update({
      where: { id },
      data: { status: DeclarationStatus.draft },
    });

    this.logger.log(`Declaration ${id} re-drafted`);
    return updated;
  }

  /**
   * Transition validated -> frozen.
   * Sets frozenAt and frozenToken (UUID v4). Frozen declarations are immutable.
   */
  async freeze(id: string) {
    const declaration = await this.findOne(id);
    this.assertTransition(declaration.status as DeclarationStatus, DeclarationStatus.frozen);

    const updated = await this.prisma.declaration.update({
      where: { id },
      data: {
        status: DeclarationStatus.frozen,
        frozenAt: new Date(),
        frozenToken: uuidv4(),
      },
    });

    this.logger.log(`Declaration ${id} frozen`);
    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Declaration Line CRUD
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a declaration line.
   * Computes amount = grossAmount - deductions.
   * Rejects if parent declaration is frozen.
   */
  async createLine(declarationId: string, dto: CreateDeclarationLineDto) {
    const declaration = await this.findOne(declarationId);

    if (declaration.frozenToken) {
      throw new BadRequestException('Declaration is frozen');
    }

    const gross = parseFloat(dto.grossAmount);
    const deductions = parseFloat(dto.deductions ?? '0');
    const amount = gross - deductions;

    return this.prisma.declarationLine.create({
      data: {
        declarationId,
        grossAmount: dto.grossAmount,
        deductions: dto.deductions ?? '0',
        amount: amount.toFixed(2),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.unitOfMeasure !== undefined ? { unitOfMeasure: dto.unitOfMeasure } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  /**
   * List all lines for a declaration.
   */
  async findLinesByDeclaration(declarationId: string) {
    return this.prisma.declarationLine.findMany({
      where: { declarationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update a declaration line.
   * Recomputes amount = grossAmount - deductions.
   * Rejects if parent declaration is frozen.
   */
  async updateLine(lineId: string, dto: Partial<CreateDeclarationLineDto>) {
    const line = await this.prisma.declarationLine.findUnique({
      where: { id: lineId },
    });

    if (!line) {
      throw new NotFoundException(`Declaration line ${lineId} not found`);
    }

    const declaration = await this.findOne(line.declarationId);

    if (declaration.frozenToken) {
      throw new BadRequestException('Declaration is frozen');
    }

    const gross = parseFloat(dto.grossAmount ?? String(line.grossAmount));
    const deductions = parseFloat(dto.deductions ?? String(line.deductions));
    const amount = gross - deductions;

    return this.prisma.declarationLine.update({
      where: { id: lineId },
      data: {
        ...(dto.grossAmount !== undefined ? { grossAmount: dto.grossAmount } : {}),
        ...(dto.deductions !== undefined ? { deductions: dto.deductions } : {}),
        amount: amount.toFixed(2),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.unitOfMeasure !== undefined ? { unitOfMeasure: dto.unitOfMeasure } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  /**
   * Delete a declaration line.
   * Rejects if parent declaration is frozen.
   */
  async removeLine(lineId: string) {
    const line = await this.prisma.declarationLine.findUnique({
      where: { id: lineId },
    });

    if (!line) {
      throw new NotFoundException(`Declaration line ${lineId} not found`);
    }

    const declaration = await this.findOne(line.declarationId);

    if (declaration.frozenToken) {
      throw new BadRequestException('Declaration is frozen');
    }

    return this.prisma.declarationLine.delete({ where: { id: lineId } });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CSV / Excel Upload
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Parse and validate a CSV or Excel file upload.
   * Applies 6 validation rules per row.
   * DEVIATION_THRESHOLD is a warning — row is still created.
   *
   * Returns { created, errors } summary.
   */
  async parseAndValidateUpload(
    file: Express.Multer.File,
    airportId: string,
  ): Promise<{ created: number; errors: UploadError[] }> {
    let rows: DeclarationRow[];

    if (file.mimetype === 'text/csv') {
      rows = this.parseCSV(file.buffer);
    } else {
      rows = this.parseExcel(file.buffer);
    }

    const errors: UploadError[] = [];
    const validRows: DeclarationRow[] = [];

    // Batch tenant validation — fetch all unique tenantIds at once for efficiency
    const uniqueTenantIds = [...new Set(rows.map((r) => r.tenantId).filter(Boolean))];
    const existingTenants = await this.prisma.tenant.findMany({
      where: { id: { in: uniqueTenantIds } },
      select: { id: true },
    });
    const existingTenantIds = new Set(existingTenants.map((t) => t.id));

    // Track seen duplicates within the upload batch
    const seenKeys = new Set<string>();

    for (const row of rows) {
      let rowValid = true;

      // Rule 1: MISSING_FIELDS
      if (!row.tenantId || !row.grossAmount || !row.periodStart) {
        errors.push({
          row: row.rowIndex,
          field: !row.tenantId ? 'tenantId' : !row.grossAmount ? 'grossAmount' : 'periodStart',
          rule: 'MISSING_FIELDS',
          message: `Row ${row.rowIndex}: Required field missing (tenantId, grossAmount, periodStart required)`,
        });
        rowValid = false;
      }

      // Rule 2: INVALID_TENANT
      if (row.tenantId && !existingTenantIds.has(row.tenantId)) {
        errors.push({
          row: row.rowIndex,
          field: 'tenantId',
          rule: 'INVALID_TENANT',
          message: `Row ${row.rowIndex}: Tenant '${row.tenantId}' does not exist`,
        });
        rowValid = false;
      }

      // Rule 3: INVALID_PERIOD
      if (row.periodStart && isNaN(Date.parse(row.periodStart))) {
        errors.push({
          row: row.rowIndex,
          field: 'periodStart',
          rule: 'INVALID_PERIOD',
          message: `Row ${row.rowIndex}: periodStart '${row.periodStart}' is not a valid date`,
        });
        rowValid = false;
      }

      // Rule 4: NEGATIVE_AMOUNT
      if (row.grossAmount) {
        const grossVal = parseFloat(row.grossAmount);
        if (!isNaN(grossVal) && grossVal < 0) {
          errors.push({
            row: row.rowIndex,
            field: 'grossAmount',
            rule: 'NEGATIVE_AMOUNT',
            message: `Row ${row.rowIndex}: grossAmount cannot be negative`,
          });
          rowValid = false;
        }
      }

      // Rule 5: DUPLICATE_PERIOD (within this upload batch)
      if (row.tenantId && row.periodStart) {
        const key = `${row.tenantId}:${row.periodStart}:${row.category ?? ''}`;
        if (seenKeys.has(key)) {
          errors.push({
            row: row.rowIndex,
            field: 'periodStart',
            rule: 'DUPLICATE_PERIOD',
            message: `Row ${row.rowIndex}: Duplicate tenantId+periodStart+category combination in upload`,
          });
          rowValid = false;
        } else {
          seenKeys.add(key);
        }
      }

      if (rowValid) {
        validRows.push(row);
      }
    }

    // Rule 6: DEVIATION_THRESHOLD — check for valid rows only (warning, not rejection)
    for (const row of validRows) {
      const previousDeclaration = await this.prisma.declaration.findFirst({
        where: {
          tenantId: row.tenantId,
          periodStart: { lt: new Date(row.periodStart) },
        },
        orderBy: { periodStart: 'desc' },
        include: { lines: true },
      });

      if (previousDeclaration && previousDeclaration.lines.length > 0) {
        const prevLine = previousDeclaration.lines.find(
          (l) => (l.category ?? '') === (row.category ?? ''),
        );

        if (prevLine) {
          const prevAmount = parseFloat(String(prevLine.amount));
          const currAmount = parseFloat(row.grossAmount);

          if (prevAmount > 0) {
            const deviation = Math.abs(currAmount - prevAmount) / prevAmount;
            if (deviation > 0.3) {
              errors.push({
                row: row.rowIndex,
                field: 'grossAmount',
                rule: 'DEVIATION_THRESHOLD',
                message: `Row ${row.rowIndex}: grossAmount deviates ${Math.round(deviation * 100)}% from previous period (threshold: 30%) — warning only`,
              });
              // Note: Not setting rowValid = false — DEVIATION_THRESHOLD is a warning
            }
          }
        }
      }
    }

    // Create declarations for valid rows
    let created = 0;
    for (const row of validRows) {
      await this.prisma.$transaction(async (tx: any) => {
        const declaration = await tx.declaration.create({
          data: {
            airportId,
            tenantId: row.tenantId,
            contractId: row.contractId || null,
            declarationType: DeclarationType.revenue,
            periodStart: new Date(row.periodStart),
            periodEnd: row.periodEnd ? new Date(row.periodEnd) : new Date(row.periodStart),
            status: DeclarationStatus.draft,
          },
        });

        const gross = parseFloat(row.grossAmount);
        const deductions = parseFloat(row.deductions ?? '0');
        const amount = gross - deductions;

        await tx.declarationLine.create({
          data: {
            declarationId: declaration.id,
            grossAmount: row.grossAmount,
            deductions: row.deductions ?? '0',
            amount: amount.toFixed(2),
            ...(row.category ? { category: row.category } : {}),
          },
        });
      });
      created++;
    }

    return { created, errors };
  }

  /**
   * Parse CSV buffer into DeclarationRow array.
   * Expects first row to be headers.
   */
  private parseCSV(buffer: Buffer): DeclarationRow[] {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const rows: DeclarationRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? '';
      });

      rows.push({
        rowIndex: i + 1, // 1-based, accounting for header row
        tenantId: row['tenantId'] ?? '',
        contractId: row['contractId'] ?? '',
        periodStart: row['periodStart'] ?? '',
        periodEnd: row['periodEnd'] ?? '',
        category: row['category'] ?? '',
        grossAmount: row['grossAmount'] ?? '',
        deductions: row['deductions'] ?? '0',
      });
    }

    return rows;
  }

  /**
   * Parse Excel (.xlsx) buffer into DeclarationRow array.
   * Uses xlsx library for parsing.
   */
  private parseExcel(buffer: Buffer): DeclarationRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: 1,
    });

    if (jsonData.length < 2) {
      return [];
    }

    const headers = (jsonData[0] as unknown as string[]).map((h) => String(h).trim());
    const rows: DeclarationRow[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const values = (jsonData[i] as unknown) as unknown[];
      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx] !== undefined ? String(values[idx]).trim() : '';
      });

      rows.push({
        rowIndex: i + 1,
        tenantId: row['tenantId'] ?? '',
        contractId: row['contractId'] ?? '',
        periodStart: row['periodStart'] ?? '',
        periodEnd: row['periodEnd'] ?? '',
        category: row['category'] ?? '',
        grossAmount: row['grossAmount'] ?? '',
        deductions: row['deductions'] ?? '0',
      });
    }

    return rows;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Attachment Management
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Upload an attachment and store its metadata.
   * Enforces 10MB file size limit.
   * Stores fileUrl as data URI placeholder for v1 (no cloud storage).
   */
  async createAttachment(declarationId: string, file: Express.Multer.File, uploadedBy: string) {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    if (file.size > MAX_SIZE) {
      throw new BadRequestException(`File size exceeds 10MB limit (${file.size} bytes)`);
    }

    // Verify declaration exists
    await this.findOne(declarationId);

    // Store metadata — fileUrl is a placeholder path for v1
    const fileUrl = `uploads/${declarationId}/${uuidv4()}/${file.originalname}`;

    return this.prisma.declarationAttachment.create({
      data: {
        declarationId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileUrl,
        fileSizeBytes: file.size,
        uploadedBy,
      },
    });
  }

  /**
   * List all attachments for a declaration.
   */
  async findAttachments(declarationId: string) {
    await this.findOne(declarationId); // verify exists
    return this.prisma.declarationAttachment.findMany({
      where: { declarationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Return the CSV template as a string for download.
   */
  getTemplate(): string {
    return 'tenantId,contractId,periodStart,periodEnd,category,grossAmount,deductions\n';
  }
}
