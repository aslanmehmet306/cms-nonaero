import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreditNotesService } from './credit-notes.service';
import { PrismaService } from '../database/prisma.service';
import { CreditNoteReason, CreditNoteStatus, ContractStatus } from '@shared-types/enums';

describe('CreditNotesService', () => {
  let service: CreditNotesService;
  let prisma: {
    creditNote: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    contract: {
      findUnique: jest.Mock;
    };
  };
  let eventEmitter: {
    emit: jest.Mock;
  };

  const mockCreditNote = {
    id: 'cn-uuid-1',
    airportId: 'airport-uuid-1',
    tenantId: 'tenant-uuid-1',
    contractId: 'contract-uuid-1',
    creditNoteNumber: 'CN-001',
    reason: CreditNoteReason.billing_error,
    status: CreditNoteStatus.draft,
    amount: '5000.00',
    currency: 'TRY',
    description: 'Billing error adjustment',
    relatedObligationId: null,
    relatedInvoiceLogId: null,
    approvedBy: null,
    approvedAt: null,
    issuedAt: null,
    voidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockContract = {
    id: 'contract-uuid-1',
    status: ContractStatus.active,
  };

  beforeEach(async () => {
    prisma = {
      creditNote: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      contract: {
        findUnique: jest.fn(),
      },
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditNotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CreditNotesService>(CreditNotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Code Generation ───────────────────────────────────────────────

  describe('generateNextCreditNoteNumber', () => {
    it('should return CN-001 when no existing credit notes', async () => {
      prisma.creditNote.findFirst.mockResolvedValue(null);

      const number = await service.generateNextCreditNoteNumber('airport-uuid-1');
      expect(number).toBe('CN-001');
    });

    it('should return CN-004 when last credit note has number CN-003', async () => {
      prisma.creditNote.findFirst.mockResolvedValue({ creditNoteNumber: 'CN-003' });

      const number = await service.generateNextCreditNoteNumber('airport-uuid-1');
      expect(number).toBe('CN-004');
    });

    it('should pad numbers to 3 digits', async () => {
      prisma.creditNote.findFirst.mockResolvedValue({ creditNoteNumber: 'CN-009' });

      const number = await service.generateNextCreditNoteNumber('airport-uuid-1');
      expect(number).toBe('CN-010');
    });
  });

  // ─── Create ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create credit note with generated number', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockContract);
      prisma.creditNote.findFirst.mockResolvedValue(null);
      prisma.creditNote.create.mockResolvedValue(mockCreditNote);

      const dto = {
        airportId: 'airport-uuid-1',
        tenantId: 'tenant-uuid-1',
        contractId: 'contract-uuid-1',
        reason: CreditNoteReason.billing_error,
        amount: '5000.00',
        description: 'Billing error adjustment',
      };

      const result = await service.create(dto);

      expect(prisma.creditNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creditNoteNumber: 'CN-001',
            status: CreditNoteStatus.draft,
            reason: CreditNoteReason.billing_error,
          }),
        }),
      );
      expect(result).toEqual(mockCreditNote);
    });

    it('should throw NotFoundException when contract not found', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      const dto = {
        airportId: 'airport-uuid-1',
        tenantId: 'tenant-uuid-1',
        contractId: 'non-existent-contract',
        reason: CreditNoteReason.billing_error,
        amount: '5000.00',
        description: 'Test',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should reject credit note for contract not in active or terminated status', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'contract-uuid-1',
        status: ContractStatus.draft,
      });

      const dto = {
        airportId: 'airport-uuid-1',
        tenantId: 'tenant-uuid-1',
        contractId: 'contract-uuid-1',
        reason: CreditNoteReason.billing_error,
        amount: '5000.00',
        description: 'Test',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── FindAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated credit notes', async () => {
      prisma.creditNote.findMany.mockResolvedValue([mockCreditNote]);
      prisma.creditNote.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should filter by tenantId and status', async () => {
      prisma.creditNote.findMany.mockResolvedValue([]);
      prisma.creditNote.count.mockResolvedValue(0);

      await service.findAll({
        tenantId: 'tenant-uuid-1',
        status: CreditNoteStatus.draft,
      });

      expect(prisma.creditNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-uuid-1',
            status: CreditNoteStatus.draft,
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.creditNote.findMany.mockResolvedValue([mockCreditNote]);
      prisma.creditNote.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(prisma.creditNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ─── FindOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return credit note with relations', async () => {
      prisma.creditNote.findUnique.mockResolvedValue({
        ...mockCreditNote,
        tenant: {},
        contract: {},
      });

      const result = await service.findOne('cn-uuid-1');
      expect(result.creditNoteNumber).toBe('CN-001');
    });

    it('should throw NotFoundException for non-existent credit note', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Update ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update draft credit note fields', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(mockCreditNote);
      prisma.creditNote.update.mockResolvedValue({
        ...mockCreditNote,
        amount: '7500.00',
      });

      const result = await service.update('cn-uuid-1', { amount: '7500.00' });

      expect(prisma.creditNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cn-uuid-1' },
          data: expect.objectContaining({ amount: '7500.00' }),
        }),
      );
      expect(result.amount).toBe('7500.00');
    });

    it('should reject update for non-draft credit note', async () => {
      prisma.creditNote.findUnique.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.pending_approval,
      });

      await expect(
        service.update('cn-uuid-1', { amount: '7500.00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when credit note not found', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { amount: '7500.00' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Transition ───────────────────────────────────────────────────

  describe('transition', () => {
    it('should transition from draft to pending_approval', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(mockCreditNote);
      prisma.creditNote.update.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.pending_approval,
      });

      const result = await service.transition(
        'cn-uuid-1',
        CreditNoteStatus.pending_approval,
      );

      expect(prisma.creditNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CreditNoteStatus.pending_approval,
          }),
        }),
      );
      expect(result.status).toBe(CreditNoteStatus.pending_approval);
    });

    it('should transition from pending_approval to approved_cn with approvedBy and approvedAt', async () => {
      prisma.creditNote.findUnique.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.pending_approval,
      });
      prisma.creditNote.update.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.approved_cn,
        approvedBy: 'user-uuid-1',
        approvedAt: new Date(),
      });

      const result = await service.transition(
        'cn-uuid-1',
        CreditNoteStatus.approved_cn,
        { approvedBy: 'user-uuid-1' },
      );

      expect(prisma.creditNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CreditNoteStatus.approved_cn,
            approvedBy: 'user-uuid-1',
            approvedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe(CreditNoteStatus.approved_cn);
    });

    it('should require approvedBy when transitioning to approved_cn', async () => {
      prisma.creditNote.findUnique.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.pending_approval,
      });

      await expect(
        service.transition('cn-uuid-1', CreditNoteStatus.approved_cn),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition from approved_cn to issued with issuedAt and emit event', async () => {
      const approvedCreditNote = {
        ...mockCreditNote,
        status: CreditNoteStatus.approved_cn,
      };
      prisma.creditNote.findUnique.mockResolvedValue(approvedCreditNote);

      const issuedCreditNote = {
        ...mockCreditNote,
        id: 'cn-uuid-1',
        status: CreditNoteStatus.issued,
        issuedAt: new Date(),
      };
      prisma.creditNote.update.mockResolvedValue(issuedCreditNote);

      const result = await service.transition(
        'cn-uuid-1',
        CreditNoteStatus.issued,
      );

      expect(prisma.creditNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CreditNoteStatus.issued,
            issuedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe(CreditNoteStatus.issued);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'credit_note.issued',
        expect.objectContaining({
          creditNoteId: 'cn-uuid-1',
          tenantId: 'tenant-uuid-1',
          contractId: 'contract-uuid-1',
          creditNoteNumber: 'CN-001',
        }),
      );
    });

    it('should transition from draft to voided', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(mockCreditNote);
      prisma.creditNote.update.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.voided,
      });

      const result = await service.transition(
        'cn-uuid-1',
        CreditNoteStatus.voided,
      );

      expect(result.status).toBe(CreditNoteStatus.voided);
    });

    it('should reject invalid transition (issued to draft)', async () => {
      prisma.creditNote.findUnique.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.issued,
      });

      await expect(
        service.transition('cn-uuid-1', CreditNoteStatus.draft),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent credit note', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(null);

      await expect(
        service.transition('non-existent-id', CreditNoteStatus.pending_approval),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Event Emission ───────────────────────────────────────────────

  describe('event emission', () => {
    it('should emit credit_note.issued event with correct payload', async () => {
      prisma.creditNote.findUnique.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.approved_cn,
      });

      const issuedCreditNote = {
        ...mockCreditNote,
        id: 'cn-uuid-1',
        status: CreditNoteStatus.issued,
        issuedAt: new Date(),
      };
      prisma.creditNote.update.mockResolvedValue(issuedCreditNote);

      await service.transition('cn-uuid-1', CreditNoteStatus.issued);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('credit_note.issued', {
        creditNoteId: 'cn-uuid-1',
        tenantId: 'tenant-uuid-1',
        contractId: 'contract-uuid-1',
        amount: '5000.00',
        creditNoteNumber: 'CN-001',
      });
    });

    it('should not emit event for non-issued transitions', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(mockCreditNote);
      prisma.creditNote.update.mockResolvedValue({
        ...mockCreditNote,
        status: CreditNoteStatus.pending_approval,
      });

      await service.transition('cn-uuid-1', CreditNoteStatus.pending_approval);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
