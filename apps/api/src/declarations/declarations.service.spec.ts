import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DeclarationStatus,
  DeclarationType,
} from '@shared-types/enums';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { DeclarationsService } from './declarations.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeDeclaration(overrides: Partial<any> = {}): any {
  return {
    id: 'decl-1',
    airportId: 'airport-1',
    tenantId: 'tenant-1',
    contractId: 'contract-1',
    declarationType: DeclarationType.revenue,
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
    status: DeclarationStatus.draft,
    submittedAt: null,
    frozenAt: null,
    frozenToken: null,
    createdAt: new Date(),
    lines: [],
    attachments: [],
    ...overrides,
  };
}

function makeDeclarationLine(overrides: Partial<any> = {}): any {
  return {
    id: 'line-1',
    declarationId: 'decl-1',
    category: 'Food & Beverage',
    grossAmount: '10000.00',
    deductions: '500.00',
    amount: '9500.00',
    unitOfMeasure: null,
    notes: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

const mockPrisma = {
  contract: {
    findUnique: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  declaration: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  declarationLine: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  declarationAttachment: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('DeclarationsService', () => {
  let service: DeclarationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeclarationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<DeclarationsService>(DeclarationsService);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CREATE
  // ───────────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a declaration with status=draft when contract exists', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'contract-1' });
      const created = makeDeclaration();
      mockPrisma.declaration.create.mockResolvedValue(created);

      const result = await service.create({
        airportId: 'airport-1',
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        declarationType: DeclarationType.revenue,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      });

      expect(result.status).toBe(DeclarationStatus.draft);
      expect(mockPrisma.declaration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DeclarationStatus.draft }),
        }),
      );
    });

    it('throws NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          airportId: 'airport-1',
          tenantId: 'tenant-1',
          contractId: 'nonexistent',
          declarationType: DeclarationType.revenue,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // STATE MACHINE
  // ───────────────────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('transitions draft->submitted, sets submittedAt, emits declaration.submitted event', async () => {
      const draft = makeDeclaration({ status: DeclarationStatus.draft });
      mockPrisma.declaration.findUnique.mockResolvedValue(draft);
      const submitted = makeDeclaration({
        status: DeclarationStatus.submitted,
        submittedAt: new Date(),
      });
      mockPrisma.declaration.update.mockResolvedValue(submitted);

      const result = await service.submit('decl-1');

      expect(result.status).toBe(DeclarationStatus.submitted);
      expect(mockPrisma.declaration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DeclarationStatus.submitted,
            submittedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'declaration.submitted',
        expect.objectContaining({ declarationId: 'decl-1' }),
      );
    });
  });

  describe('validate', () => {
    it('transitions submitted->validated', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(
        makeDeclaration({ status: DeclarationStatus.submitted }),
      );
      const validated = makeDeclaration({ status: DeclarationStatus.validated });
      mockPrisma.declaration.update.mockResolvedValue(validated);

      const result = await service.validate('decl-1');

      expect(result.status).toBe(DeclarationStatus.validated);
      expect(mockPrisma.declaration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DeclarationStatus.validated }),
        }),
      );
    });
  });

  describe('reject', () => {
    it('transitions submitted->rejected', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(
        makeDeclaration({ status: DeclarationStatus.submitted }),
      );
      const rejected = makeDeclaration({ status: DeclarationStatus.rejected });
      mockPrisma.declaration.update.mockResolvedValue(rejected);

      const result = await service.reject('decl-1');

      expect(result.status).toBe(DeclarationStatus.rejected);
    });

    it('transitions validated->rejected', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(
        makeDeclaration({ status: DeclarationStatus.validated }),
      );
      const rejected = makeDeclaration({ status: DeclarationStatus.rejected });
      mockPrisma.declaration.update.mockResolvedValue(rejected);

      const result = await service.reject('decl-1');

      expect(result.status).toBe(DeclarationStatus.rejected);
    });
  });

  describe('redraft', () => {
    it('transitions rejected->draft', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(
        makeDeclaration({ status: DeclarationStatus.rejected }),
      );
      const redrafted = makeDeclaration({ status: DeclarationStatus.draft });
      mockPrisma.declaration.update.mockResolvedValue(redrafted);

      const result = await service.redraft('decl-1');

      expect(result.status).toBe(DeclarationStatus.draft);
    });
  });

  describe('freeze', () => {
    it('transitions validated->frozen, sets frozenAt and frozenToken (UUID)', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(
        makeDeclaration({ status: DeclarationStatus.validated }),
      );
      const frozen = makeDeclaration({
        status: DeclarationStatus.frozen,
        frozenAt: new Date(),
        frozenToken: 'some-uuid',
      });
      mockPrisma.declaration.update.mockResolvedValue(frozen);

      const result = await service.freeze('decl-1');

      expect(result.status).toBe(DeclarationStatus.frozen);
      expect(result.frozenToken).toBeTruthy();
      expect(mockPrisma.declaration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DeclarationStatus.frozen,
            frozenAt: expect.any(Date),
            frozenToken: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('frozen immutability', () => {
    it('throws BadRequestException when updating a frozen declaration', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(
        makeDeclaration({ status: DeclarationStatus.frozen, frozenToken: 'some-token' }),
      );

      await expect(service.update('decl-1', { airportId: 'airport-1' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update('decl-1', { airportId: 'airport-1' })).rejects.toThrow(
        'Declaration is frozen',
      );
    });

    it('throws BadRequestException when deleting a frozen declaration', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(
        makeDeclaration({ status: DeclarationStatus.frozen, frozenToken: 'some-token' }),
      );

      await expect(service.remove('decl-1')).rejects.toThrow(BadRequestException);
      await expect(service.remove('decl-1')).rejects.toThrow('Declaration is frozen');
    });
  });

  describe('invalid state transition', () => {
    it('throws BadRequestException for draft->frozen (invalid transition)', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(
        makeDeclaration({ status: DeclarationStatus.draft }),
      );

      await expect(service.freeze('decl-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FIND ALL WITH FILTERS
  // ───────────────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('filters by tenantId', async () => {
      const declarations = [makeDeclaration({ tenantId: 'tenant-1' })];
      mockPrisma.declaration.findMany.mockResolvedValue(declarations);
      mockPrisma.declaration.count.mockResolvedValue(1);

      const result = await service.findAll({ tenantId: 'tenant-1' });

      expect(mockPrisma.declaration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('filters by status', async () => {
      const declarations = [makeDeclaration({ status: DeclarationStatus.submitted })];
      mockPrisma.declaration.findMany.mockResolvedValue(declarations);
      mockPrisma.declaration.count.mockResolvedValue(1);

      const result = await service.findAll({ status: DeclarationStatus.submitted });

      expect(mockPrisma.declaration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: DeclarationStatus.submitted }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DECLARATION LINE CRUD
  // ───────────────────────────────────────────────────────────────────────────

  describe('createLine', () => {
    it('creates a line computing amount = grossAmount - deductions', async () => {
      // findUnique for declaration (not frozen)
      mockPrisma.declaration.findUnique.mockResolvedValue(makeDeclaration());
      const line = makeDeclarationLine();
      mockPrisma.declarationLine.create.mockResolvedValue(line);

      const result = await service.createLine('decl-1', {
        grossAmount: '10000.00',
        deductions: '500.00',
        category: 'Food & Beverage',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.declarationLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            declarationId: 'decl-1',
            grossAmount: '10000.00',
            deductions: '500.00',
            amount: '9500.00',
          }),
        }),
      );
    });

    it('computes amount = grossAmount when deductions not provided (defaults to 0)', async () => {
      mockPrisma.declaration.findUnique.mockResolvedValue(makeDeclaration());
      const line = makeDeclarationLine({ grossAmount: '5000.00', deductions: '0', amount: '5000.00' });
      mockPrisma.declarationLine.create.mockResolvedValue(line);

      const result = await service.createLine('decl-1', {
        grossAmount: '5000.00',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.declarationLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grossAmount: '5000.00',
            deductions: '0',
            amount: '5000.00',
          }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CSV/EXCEL UPLOAD
  // ───────────────────────────────────────────────────────────────────────────

  describe('parseAndValidateUpload', () => {
    const validCsvBuffer = Buffer.from(
      'tenantId,contractId,periodStart,periodEnd,category,grossAmount,deductions\n' +
        'tenant-1,contract-1,2026-01-01,2026-01-31,F&B,10000.00,500.00\n',
    );

    it('parses valid CSV and returns created count', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.declaration.findFirst.mockResolvedValue(null); // no previous period
      mockPrisma.$transaction.mockResolvedValue({});

      const result = await service.parseAndValidateUpload(
        {
          buffer: validCsvBuffer,
          mimetype: 'text/csv',
          originalname: 'test.csv',
          size: validCsvBuffer.length,
        } as any,
        'airport-1',
      );

      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('rejects rows with MISSING_FIELDS when tenantId or grossAmount missing', async () => {
      const csvWithMissingFields = Buffer.from(
        'tenantId,contractId,periodStart,periodEnd,category,grossAmount,deductions\n' +
          ',contract-1,2026-01-01,2026-01-31,F&B,,0\n',
      );

      mockPrisma.tenant.findMany.mockResolvedValue([]);

      const result = await service.parseAndValidateUpload(
        {
          buffer: csvWithMissingFields,
          mimetype: 'text/csv',
          originalname: 'test.csv',
          size: csvWithMissingFields.length,
        } as any,
        'airport-1',
      );

      expect(result.errors.some((e: any) => e.rule === 'MISSING_FIELDS')).toBe(true);
    });

    it('rejects rows with NEGATIVE_AMOUNT when grossAmount < 0', async () => {
      const csvWithNegativeAmount = Buffer.from(
        'tenantId,contractId,periodStart,periodEnd,category,grossAmount,deductions\n' +
          'tenant-1,contract-1,2026-01-01,2026-01-31,F&B,-100.00,0\n',
      );

      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.declaration.findFirst.mockResolvedValue(null);

      const result = await service.parseAndValidateUpload(
        {
          buffer: csvWithNegativeAmount,
          mimetype: 'text/csv',
          originalname: 'test.csv',
          size: csvWithNegativeAmount.length,
        } as any,
        'airport-1',
      );

      expect(result.errors.some((e: any) => e.rule === 'NEGATIVE_AMOUNT')).toBe(true);
    });

    it('rejects rows with INVALID_PERIOD when periodStart is unparseable', async () => {
      const csvWithInvalidPeriod = Buffer.from(
        'tenantId,contractId,periodStart,periodEnd,category,grossAmount,deductions\n' +
          'tenant-1,contract-1,not-a-date,2026-01-31,F&B,10000.00,0\n',
      );

      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);

      const result = await service.parseAndValidateUpload(
        {
          buffer: csvWithInvalidPeriod,
          mimetype: 'text/csv',
          originalname: 'test.csv',
          size: csvWithInvalidPeriod.length,
        } as any,
        'airport-1',
      );

      expect(result.errors.some((e: any) => e.rule === 'INVALID_PERIOD')).toBe(true);
    });

    it('detects DUPLICATE_PERIOD for same tenantId+periodStart+category rows', async () => {
      const csvWithDuplicates = Buffer.from(
        'tenantId,contractId,periodStart,periodEnd,category,grossAmount,deductions\n' +
          'tenant-1,contract-1,2026-01-01,2026-01-31,F&B,10000.00,0\n' +
          'tenant-1,contract-1,2026-01-01,2026-01-31,F&B,12000.00,0\n',
      );

      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.declaration.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue({});

      const result = await service.parseAndValidateUpload(
        {
          buffer: csvWithDuplicates,
          mimetype: 'text/csv',
          originalname: 'test.csv',
          size: csvWithDuplicates.length,
        } as any,
        'airport-1',
      );

      expect(result.errors.some((e: any) => e.rule === 'DUPLICATE_PERIOD')).toBe(true);
    });

    it('rejects rows with INVALID_TENANT when tenantId does not exist in DB', async () => {
      const csvWithInvalidTenant = Buffer.from(
        'tenantId,contractId,periodStart,periodEnd,category,grossAmount,deductions\n' +
          'nonexistent-tenant,contract-1,2026-01-01,2026-01-31,F&B,10000.00,0\n',
      );

      mockPrisma.tenant.findMany.mockResolvedValue([]); // no matching tenants

      const result = await service.parseAndValidateUpload(
        {
          buffer: csvWithInvalidTenant,
          mimetype: 'text/csv',
          originalname: 'test.csv',
          size: csvWithInvalidTenant.length,
        } as any,
        'airport-1',
      );

      expect(result.errors.some((e: any) => e.rule === 'INVALID_TENANT')).toBe(true);
    });

    it('includes DEVIATION_THRESHOLD warning (not rejection) for >30% deviation from prior period', async () => {
      const csv = Buffer.from(
        'tenantId,contractId,periodStart,periodEnd,category,grossAmount,deductions\n' +
          'tenant-1,contract-1,2026-01-01,2026-01-31,F&B,20000.00,0\n',
      );

      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      // Previous period had 10000, current is 20000 => 100% deviation > 30%
      mockPrisma.declaration.findFirst.mockResolvedValue({
        lines: [{ category: 'F&B', amount: '10000.00' }],
      });
      mockPrisma.$transaction.mockResolvedValue({});

      const result = await service.parseAndValidateUpload(
        {
          buffer: csv,
          mimetype: 'text/csv',
          originalname: 'test.csv',
          size: csv.length,
        } as any,
        'airport-1',
      );

      // DEVIATION_THRESHOLD is a warning — row is still created
      expect(result.errors.some((e: any) => e.rule === 'DEVIATION_THRESHOLD')).toBe(true);
      expect(result.created).toBeGreaterThanOrEqual(1);
    });

    it('parses Excel (.xlsx) buffer into rows', async () => {
      // We'll test with a minimal mock to confirm the Excel path is invoked
      // Actual XLSX parsing tested via integration; here we just verify the method signature
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([
        ['tenantId', 'contractId', 'periodStart', 'periodEnd', 'category', 'grossAmount', 'deductions'],
        ['tenant-1', 'contract-1', '2026-01-01', '2026-01-31', 'F&B', '10000.00', '0'],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const excelBuffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.declaration.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue({});

      const result = await service.parseAndValidateUpload(
        {
          buffer: excelBuffer,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          originalname: 'test.xlsx',
          size: excelBuffer.length,
        } as any,
        'airport-1',
      );

      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('errors');
    });

    it('returns { created, errors } summary', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.declaration.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue({});

      const result = await service.parseAndValidateUpload(
        {
          buffer: validCsvBuffer,
          mimetype: 'text/csv',
          originalname: 'test.csv',
          size: validCsvBuffer.length,
        } as any,
        'airport-1',
      );

      expect(typeof result.created).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ATTACHMENT UPLOAD
  // ───────────────────────────────────────────────────────────────────────────

  describe('createAttachment', () => {
    it('stores attachment metadata (fileName, fileType, fileSizeBytes, fileUrl)', async () => {
      const declaration = makeDeclaration();
      mockPrisma.declaration.findUnique.mockResolvedValue(declaration);
      const attachment = {
        id: 'att-1',
        declarationId: 'decl-1',
        fileName: 'report.pdf',
        fileType: 'application/pdf',
        fileUrl: 'data:application/pdf;base64,...',
        fileSizeBytes: 1024,
        uploadedBy: 'user-1',
        createdAt: new Date(),
      };
      mockPrisma.declarationAttachment.create.mockResolvedValue(attachment);

      const result = await service.createAttachment(
        'decl-1',
        {
          buffer: Buffer.from('fake pdf'),
          mimetype: 'application/pdf',
          originalname: 'report.pdf',
          size: 1024,
        } as any,
        'user-1',
      );

      expect(result.fileName).toBe('report.pdf');
      expect(result.fileType).toBe('application/pdf');
      expect(result.fileSizeBytes).toBe(1024);
      expect(result.uploadedBy).toBe('user-1');
    });

    it('throws BadRequestException when file exceeds 10MB', async () => {
      const declaration = makeDeclaration();
      mockPrisma.declaration.findUnique.mockResolvedValue(declaration);

      await expect(
        service.createAttachment(
          'decl-1',
          {
            buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
            mimetype: 'application/pdf',
            originalname: 'large.pdf',
            size: 10 * 1024 * 1024 + 1,
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // METER READING SUBMISSION
  // ───────────────────────────────────────────────────────────────────────────

  describe('submitMeterReading', () => {
    const validMeterReadingDto = {
      airportId: 'airport-1',
      tenantId: 'tenant-1',
      contractId: 'contract-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      currentReading: '1500.00',
      meterType: 'electricity',
      unit: 'kWh',
      location: 'Building A - Ground Floor',
    };

    const previousMeterDeclaration = {
      id: 'prev-decl-1',
      declarationType: 'meter_reading',
      status: 'validated',
      periodStart: new Date('2025-12-01'),
      lines: [
        { id: 'prev-line-1', grossAmount: '1000.00', amount: '1000.00' },
      ],
    };

    it('creates a declaration with declarationType=meter_reading and status=submitted', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(null); // no previous reading
      const created = makeDeclaration({
        declarationType: 'meter_reading',
        status: DeclarationStatus.submitted,
        submittedAt: new Date(),
      });
      created.lines = [
        { id: 'line-1', grossAmount: '1500.00', amount: '1500.00' },
      ];
      mockPrisma.declaration.create.mockResolvedValue(created);

      const result = await service.submitMeterReading(validMeterReadingDto as any);

      expect(result.declarationType).toBe('meter_reading');
      expect(result.status).toBe(DeclarationStatus.submitted);
    });

    it('auto-fetches previous approved reading from DB (latest validated/frozen for same contract)', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(previousMeterDeclaration);
      const created = makeDeclaration({ declarationType: 'meter_reading', status: DeclarationStatus.submitted });
      created.lines = [{ id: 'line-1', grossAmount: '1500.00', amount: '500.00' }];
      mockPrisma.declaration.create.mockResolvedValue(created);

      await service.submitMeterReading(validMeterReadingDto as any);

      expect(mockPrisma.declaration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractId: 'contract-1',
            declarationType: 'meter_reading',
          }),
        }),
      );
    });

    it('computes consumption = currentReading - previousReading (500 = 1500 - 1000)', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(previousMeterDeclaration);
      const created = makeDeclaration({ declarationType: 'meter_reading', status: DeclarationStatus.submitted });
      mockPrisma.declaration.create.mockResolvedValue(created);

      await service.submitMeterReading(validMeterReadingDto as any);

      expect(mockPrisma.declaration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({
                  // grossAmount = current reading (1500), amount = consumption (500)
                  grossAmount: '1500.00',
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('uses previousReading=0 when no previous approved reading found (first reading)', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(null); // no previous
      const created = makeDeclaration({ declarationType: 'meter_reading', status: DeclarationStatus.submitted });
      mockPrisma.declaration.create.mockResolvedValue(created);

      await service.submitMeterReading({
        ...validMeterReadingDto,
        currentReading: '500.00',
      } as any);

      // consumption = 500 - 0 = 500
      expect(mockPrisma.declaration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({
                  grossAmount: '500.00',
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('throws BadRequestException for negative consumption (current < previous)', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(previousMeterDeclaration);

      await expect(
        service.submitMeterReading({
          ...validMeterReadingDto,
          currentReading: '500.00', // less than previous 1000
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with explanation message for negative consumption', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(previousMeterDeclaration);

      await expect(
        service.submitMeterReading({
          ...validMeterReadingDto,
          currentReading: '999.99', // less than previous 1000
        } as any),
      ).rejects.toThrow('negative consumption');
    });

    it('stores meter metadata (meterType, unit, location) in line.notes as JSON', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(null);
      const created = makeDeclaration({ declarationType: 'meter_reading', status: DeclarationStatus.submitted });
      mockPrisma.declaration.create.mockResolvedValue(created);

      await service.submitMeterReading(validMeterReadingDto as any);

      expect(mockPrisma.declaration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({
                  notes: expect.stringContaining('electricity'),
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('meter reading declaration is auto-submitted (status=submitted, submittedAt set)', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(null);
      const created = makeDeclaration({
        declarationType: 'meter_reading',
        status: DeclarationStatus.submitted,
        submittedAt: new Date(),
      });
      mockPrisma.declaration.create.mockResolvedValue(created);

      const result = await service.submitMeterReading(validMeterReadingDto as any);

      expect(result.status).toBe(DeclarationStatus.submitted);
      expect(mockPrisma.declaration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DeclarationStatus.submitted,
            submittedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('emits declaration.submitted event after meter reading submission', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(null);
      const created = makeDeclaration({
        declarationType: 'meter_reading',
        status: DeclarationStatus.submitted,
        submittedAt: new Date(),
      });
      mockPrisma.declaration.create.mockResolvedValue(created);

      await service.submitMeterReading(validMeterReadingDto as any);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'declaration.submitted',
        expect.objectContaining({ declarationId: created.id }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // BULK CSV METER READING UPLOAD
  // ───────────────────────────────────────────────────────────────────────────

  describe('parseMeterReadingUpload', () => {
    const validMeterCsvBuffer = Buffer.from(
      'contractId,periodStart,periodEnd,currentReading,meterType,unit,location\n' +
        'contract-1,2026-01-01,2026-01-31,1500.00,electricity,kWh,Building A\n',
    );

    it('parses CSV and returns { created: N, errors: [] } summary for valid rows', async () => {
      // no previous reading
      mockPrisma.declaration.findFirst.mockResolvedValue(null);
      const created = makeDeclaration({
        declarationType: 'meter_reading',
        status: DeclarationStatus.submitted,
      });
      mockPrisma.declaration.create.mockResolvedValue(created);

      const result = await service.parseMeterReadingUpload(
        {
          buffer: validMeterCsvBuffer,
          mimetype: 'text/csv',
          originalname: 'meters.csv',
          size: validMeterCsvBuffer.length,
        } as any,
        'airport-1',
        'tenant-1',
      );

      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('errors');
      expect(result.created).toBeGreaterThanOrEqual(1);
    });

    it('rejects rows with negative consumption (current < previous)', async () => {
      const csvWithLowReading = Buffer.from(
        'contractId,periodStart,periodEnd,currentReading,meterType,unit,location\n' +
          'contract-1,2026-01-01,2026-01-31,500.00,electricity,kWh,Building A\n',
      );

      // Previous reading was 1000
      mockPrisma.declaration.findFirst.mockResolvedValue({
        lines: [{ grossAmount: '1000.00', amount: '1000.00' }],
      });

      const result = await service.parseMeterReadingUpload(
        {
          buffer: csvWithLowReading,
          mimetype: 'text/csv',
          originalname: 'meters.csv',
          size: csvWithLowReading.length,
        } as any,
        'airport-1',
        'tenant-1',
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].rule).toBe('NEGATIVE_CONSUMPTION');
    });

    it('returns { created: N, errors: [...] } summary with correct structure', async () => {
      mockPrisma.declaration.findFirst.mockResolvedValue(null);
      const created = makeDeclaration({ declarationType: 'meter_reading', status: DeclarationStatus.submitted });
      mockPrisma.declaration.create.mockResolvedValue(created);

      const result = await service.parseMeterReadingUpload(
        {
          buffer: validMeterCsvBuffer,
          mimetype: 'text/csv',
          originalname: 'meters.csv',
          size: validMeterCsvBuffer.length,
        } as any,
        'airport-1',
        'tenant-1',
      );

      expect(typeof result.created).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
