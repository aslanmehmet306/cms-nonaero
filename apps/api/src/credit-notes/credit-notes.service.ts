import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreditNoteStatus, ContractStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { UpdateCreditNoteDto } from './dto/update-credit-note.dto';
import { QueryCreditNotesDto } from './dto/query-credit-notes.dto';

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ALLOWED_TRANSITIONS defines valid state machine transitions.
 * Keys are the FROM state; values are valid TO states.
 *
 * Terminal states (issued, voided) have empty arrays.
 */
const ALLOWED_TRANSITIONS: Record<CreditNoteStatus, CreditNoteStatus[]> = {
  [CreditNoteStatus.draft]: [CreditNoteStatus.pending_approval, CreditNoteStatus.voided],
  [CreditNoteStatus.pending_approval]: [CreditNoteStatus.approved_cn, CreditNoteStatus.draft, CreditNoteStatus.voided],
  [CreditNoteStatus.approved_cn]: [CreditNoteStatus.issued, CreditNoteStatus.voided],
  [CreditNoteStatus.issued]: [], // terminal
  [CreditNoteStatus.voided]: [], // terminal
};

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventEmitter: EventEmitter2,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Credit Note Number Generation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate the next sequential credit note number for a given airport.
   * Format: CN-001, CN-002, ..., CN-999, CN-1000, ...
   */
  async generateNextCreditNoteNumber(airportId: string): Promise<string> {
    const lastCreditNote = await this.prisma.creditNote.findFirst({
      where: { airportId },
      orderBy: { creditNoteNumber: 'desc' },
      select: { creditNoteNumber: true },
    });

    if (!lastCreditNote) {
      return 'CN-001';
    }

    const match = lastCreditNote.creditNoteNumber.match(/^CN-(\d+)$/);
    if (!match) {
      return 'CN-001';
    }

    const nextNumber = parseInt(match[1], 10) + 1;
    return `CN-${String(nextNumber).padStart(3, '0')}`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CRUD
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new credit note in draft state with an auto-generated credit note number.
   * Validates that the referenced contract exists and is in active or terminated status.
   */
  async create(dto: CreateCreditNoteDto) {
    // Validate contract exists and is in an eligible status
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      select: { id: true, status: true },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${dto.contractId} not found`);
    }

    const eligibleStatuses: string[] = [ContractStatus.active, ContractStatus.terminated];
    if (!eligibleStatuses.includes(contract.status as string)) {
      throw new BadRequestException(
        `Contract must be in active or terminated status to create a credit note. Current status: ${contract.status}`,
      );
    }

    const creditNoteNumber = await this.generateNextCreditNoteNumber(dto.airportId);

    return this.prisma.creditNote.create({
      data: {
        airportId: dto.airportId,
        tenantId: dto.tenantId,
        contractId: dto.contractId,
        creditNoteNumber,
        reason: dto.reason,
        status: CreditNoteStatus.draft,
        amount: dto.amount,
        currency: dto.currency ?? 'TRY',
        description: dto.description,
        relatedObligationId: dto.relatedObligationId,
        relatedInvoiceLogId: dto.relatedInvoiceLogId,
      },
    });
  }

  /**
   * List credit notes with optional filters and pagination.
   * Returns { data, meta } envelope.
   */
  async findAll(query: QueryCreditNotesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.contractId) where.contractId = query.contractId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: true,
          contract: true,
        },
      }),
      this.prisma.creditNote.count({ where }),
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
   * Get a single credit note by ID with tenant and contract relations.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const creditNote = await this.prisma.creditNote.findUnique({
      where: { id },
      include: {
        tenant: true,
        contract: true,
      },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${id} not found`);
    }

    return creditNote;
  }

  /**
   * Update credit note fields. Only allowed when status is draft.
   */
  async update(id: string, dto: UpdateCreditNoteDto) {
    const creditNote = await this.prisma.creditNote.findUnique({
      where: { id },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${id} not found`);
    }

    if (creditNote.status !== CreditNoteStatus.draft) {
      throw new BadRequestException(
        `Only draft credit notes can be updated. Current status: ${creditNote.status}`,
      );
    }

    return this.prisma.creditNote.update({
      where: { id },
      data: {
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.relatedObligationId !== undefined
          ? { relatedObligationId: dto.relatedObligationId }
          : {}),
        ...(dto.relatedInvoiceLogId !== undefined
          ? { relatedInvoiceLogId: dto.relatedInvoiceLogId }
          : {}),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Machine
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Transition a credit note to a new status.
   *
   * Validates the transition using ALLOWED_TRANSITIONS map.
   * Handles side effects for specific transitions:
   *   - pending_approval: validates amount > 0 and description not empty
   *   - approved_cn: requires approvedBy, sets approvedAt
   *   - issued: sets issuedAt, emits credit_note.issued event
   *   - voided: no special handling
   *
   * @throws NotFoundException   when credit note not found
   * @throws BadRequestException when transition is not allowed or preconditions fail
   */
  async transition(
    id: string,
    toStatus: CreditNoteStatus,
    opts: { approvedBy?: string } = {},
  ) {
    const creditNote = await this.prisma.creditNote.findUnique({ where: { id } });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${id} not found`);
    }

    const currentStatus = creditNote.status as CreditNoteStatus;
    const allowedTransitions = ALLOWED_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition credit note from '${currentStatus}' to '${toStatus}'. ` +
          `Allowed: [${allowedTransitions.join(', ')}]`,
      );
    }

    const updateData: Record<string, unknown> = { status: toStatus };

    // Transition-specific validations and side effects
    if (toStatus === CreditNoteStatus.pending_approval) {
      const amount = parseFloat(String(creditNote.amount));
      if (!amount || amount <= 0) {
        throw new BadRequestException(
          'Credit note amount must be greater than 0 to submit for approval',
        );
      }
      if (!creditNote.description || creditNote.description.trim() === '') {
        throw new BadRequestException(
          'Credit note description is required to submit for approval',
        );
      }
    }

    if (toStatus === CreditNoteStatus.approved_cn) {
      if (!opts.approvedBy) {
        throw new BadRequestException(
          'approvedBy is required when transitioning to approved_cn',
        );
      }
      updateData.approvedBy = opts.approvedBy;
      updateData.approvedAt = new Date();
    }

    if (toStatus === CreditNoteStatus.issued) {
      updateData.issuedAt = new Date();
    }

    const updated = await this.prisma.creditNote.update({
      where: { id },
      data: updateData,
    });

    // Emit event on issued transition
    if (toStatus === CreditNoteStatus.issued) {
      this.eventEmitter?.emit('credit_note.issued', {
        creditNoteId: updated.id,
        tenantId: updated.tenantId,
        contractId: updated.contractId,
        amount: updated.amount,
        creditNoteNumber: updated.creditNoteNumber,
      });
    }

    return updated;
  }
}
