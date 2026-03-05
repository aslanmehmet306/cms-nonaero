import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContractStatus, BillingFrequency, GuaranteeType } from '@shared-types/enums';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { ContractsService } from './contracts.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeContract(overrides: Partial<any> = {}): any {
  return {
    id: 'contract-1',
    airportId: 'airport-1',
    tenantId: 'tenant-1',
    contractNumber: 'CNT-001',
    version: 1,
    previousVersionId: null,
    status: ContractStatus.draft,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: new Date('2026-12-31'),
    annualMag: null,
    magCurrency: 'TRY',
    billingFrequency: BillingFrequency.monthly,
    responsibleOwner: null,
    escalationRule: null,
    depositAmount: null,
    guaranteeType: null,
    guaranteeExpiry: null,
    signedAt: null,
    publishedAt: null,
    terminatedAt: null,
    terminationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contractAreas: [],
    contractServices: [],
    tenant: { id: 'tenant-1', name: 'Test Tenant' },
    airport: { id: 'airport-1', code: 'ADB' },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

const mockPrisma = {
  contract: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  contractService: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('ContractsService', () => {
  let service: ContractsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CONTRACT NUMBER GENERATION
  // ───────────────────────────────────────────────────────────────────────────

  describe('generateNextContractNumber', () => {
    it('returns CNT-001 when no contracts exist', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(null);
      const result = await service.generateNextContractNumber('airport-1');
      expect(result).toBe('CNT-001');
    });

    it('increments to CNT-002 when CNT-001 exists', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue({ contractNumber: 'CNT-001' });
      const result = await service.generateNextContractNumber('airport-1');
      expect(result).toBe('CNT-002');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CREATE
  // ───────────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a contract in draft status with auto-generated CNT-001 number', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(null);
      const contract = makeContract();
      mockPrisma.contract.create.mockResolvedValue(contract);

      const dto = {
        airportId: 'airport-1',
        tenantId: 'tenant-1',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      };

      const result = await service.create(dto as any);

      expect(mockPrisma.contract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractNumber: 'CNT-001',
            status: ContractStatus.draft,
            version: 1,
          }),
        }),
      );
      expect(result.status).toBe(ContractStatus.draft);
      expect(result.contractNumber).toBe('CNT-001');
    });

    it('second contract in same airport gets CNT-002', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue({ contractNumber: 'CNT-001' });
      const contract = makeContract({ contractNumber: 'CNT-002' });
      mockPrisma.contract.create.mockResolvedValue(contract);

      const dto = {
        airportId: 'airport-1',
        tenantId: 'tenant-1',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      };

      const result = await service.create(dto as any);
      expect(result.contractNumber).toBe('CNT-002');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FIND ALL
  // ───────────────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated results with { data, meta } shape', async () => {
      const contracts = [makeContract()];
      mockPrisma.contract.findMany.mockResolvedValue(contracts);
      mockPrisma.contract.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toEqual(
        expect.objectContaining({
          data: contracts,
          meta: expect.objectContaining({
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        }),
      );
    });

    it('supports ?status=draft filter', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([makeContract()]);
      mockPrisma.contract.count.mockResolvedValue(1);

      await service.findAll({ status: ContractStatus.draft });

      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ContractStatus.draft }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FIND ONE
  // ───────────────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ───────────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('update on draft contract succeeds', async () => {
      const contract = makeContract({ status: ContractStatus.draft });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      const updated = { ...contract, responsibleOwner: 'John' };
      mockPrisma.contract.update.mockResolvedValue(updated);

      const result = await service.update('contract-1', { responsibleOwner: 'John' } as any);
      expect(result.responsibleOwner).toBe('John');
    });

    it('update on published contract throws BadRequestException', async () => {
      const contract = makeContract({ status: ContractStatus.published });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.update('contract-1', { responsibleOwner: 'John' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TRANSITION (STATE MACHINE)
  // ───────────────────────────────────────────────────────────────────────────

  describe('transition', () => {
    it('transition draft->in_review succeeds', async () => {
      const contract = makeContract({ status: ContractStatus.draft });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      mockPrisma.contract.update.mockResolvedValue({
        ...contract,
        status: ContractStatus.in_review,
      });

      const result = await service.transition('contract-1', ContractStatus.in_review, {});
      expect(result.status).toBe(ContractStatus.in_review);
    });

    it('transition draft->active throws BadRequestException (invalid)', async () => {
      const contract = makeContract({ status: ContractStatus.draft });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.transition('contract-1', ContractStatus.active, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('transition in_review->published succeeds (sets publishedAt)', async () => {
      const contract = makeContract({ status: ContractStatus.in_review });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      const updated = {
        ...contract,
        status: ContractStatus.published,
        publishedAt: new Date(),
      };
      mockPrisma.contract.update.mockResolvedValue(updated);

      const result = await service.transition('contract-1', ContractStatus.published, {});
      expect(result.status).toBe(ContractStatus.published);
      expect(result.publishedAt).toBeDefined();
    });

    it('transition active->suspended succeeds', async () => {
      const contract = makeContract({ status: ContractStatus.active });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      mockPrisma.contract.update.mockResolvedValue({
        ...contract,
        status: ContractStatus.suspended,
      });

      const result = await service.transition('contract-1', ContractStatus.suspended, {});
      expect(result.status).toBe(ContractStatus.suspended);
    });

    it('transition suspended->active succeeds (re-activation)', async () => {
      const contract = makeContract({ status: ContractStatus.suspended });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      mockPrisma.contract.update.mockResolvedValue({
        ...contract,
        status: ContractStatus.active,
      });

      const result = await service.transition('contract-1', ContractStatus.active, {});
      expect(result.status).toBe(ContractStatus.active);
    });

    it('transition active->terminated succeeds (sets terminatedAt)', async () => {
      const contract = makeContract({ status: ContractStatus.active });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      const updated = {
        ...contract,
        status: ContractStatus.terminated,
        terminatedAt: new Date(),
        terminationReason: 'Lease ended',
      };
      mockPrisma.contract.update.mockResolvedValue(updated);

      const result = await service.transition('contract-1', ContractStatus.terminated, {
        terminationReason: 'Lease ended',
      });
      expect(result.status).toBe(ContractStatus.terminated);
      expect(result.terminatedAt).toBeDefined();
    });

    it('transition terminated->anything throws BadRequestException', async () => {
      const contract = makeContract({ status: ContractStatus.terminated });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.transition('contract-1', ContractStatus.active, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AMEND
  // ───────────────────────────────────────────────────────────────────────────

  describe('amend', () => {
    // Future first-day: first day of next month relative to now (UTC-based to avoid timezone issues)
    function nextMonthStart(): string {
      const d = new Date();
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1; // next month (0-indexed + 1 for next month)
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    }

    it('amend() on active contract creates new version with pending_amendment status, version+1, same contractNumber', async () => {
      const contract = makeContract({ status: ContractStatus.active, version: 1 });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      // No existing pending amendment
      mockPrisma.contract.findFirst.mockResolvedValue(null);
      // Existing contract services
      mockPrisma.contractService.findMany.mockResolvedValue([]);

      const amendedContract = makeContract({
        id: 'contract-2',
        version: 2,
        status: ContractStatus.pending_amendment,
        previousVersionId: 'contract-1',
        effectiveFrom: new Date(nextMonthStart()),
      });

      // $transaction returns [amendedContract]
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        // Simulate the transaction callback
        const txPrisma = {
          contract: {
            create: jest.fn().mockResolvedValue(amendedContract),
          },
          contractService: {
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return fn(txPrisma);
      });

      const dto = {
        effectiveFrom: nextMonthStart(),
        annualMag: 120000,
      };

      const result = await service.amend('contract-1', dto as any);

      expect(result.status).toBe(ContractStatus.pending_amendment);
      expect(result.version).toBe(2);
      expect(result.previousVersionId).toBe('contract-1');
      expect(result.contractNumber).toBe('CNT-001');
    });

    it('amend() on non-active contract throws BadRequestException', async () => {
      const contract = makeContract({ status: ContractStatus.draft });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.amend('contract-1', { effectiveFrom: nextMonthStart() } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('amend() with mid-month effectiveFrom throws BadRequestException', async () => {
      const contract = makeContract({ status: ContractStatus.active });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      // Mid-month date in future (UTC-based)
      const midMonth = (() => {
        const d = new Date();
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth() + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        return `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`;
      })();

      await expect(
        service.amend('contract-1', { effectiveFrom: midMonth } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('amend() with past effectiveFrom throws BadRequestException', async () => {
      const contract = makeContract({ status: ContractStatus.active });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.amend('contract-1', { effectiveFrom: '2020-01-01' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('amend() rejects if pending amendment already exists for this contract', async () => {
      const contract = makeContract({ status: ContractStatus.active });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      // Pending amendment exists
      mockPrisma.contract.findFirst.mockResolvedValue(
        makeContract({ status: ContractStatus.pending_amendment }),
      );

      await expect(
        service.amend('contract-1', { effectiveFrom: nextMonthStart() } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // VERSION HISTORY
  // ───────────────────────────────────────────────────────────────────────────

  describe('getVersionHistory', () => {
    it('returns versions with field-level diff', async () => {
      const v1 = makeContract({
        id: 'contract-1',
        version: 1,
        annualMag: 100000,
        magCurrency: 'TRY',
        contractNumber: 'CNT-001',
      });
      const v2 = makeContract({
        id: 'contract-2',
        version: 2,
        annualMag: 120000,
        magCurrency: 'TRY',
        previousVersionId: 'contract-1',
        contractNumber: 'CNT-001',
      });

      // findOne returns v1
      mockPrisma.contract.findUnique.mockResolvedValue(v1);
      // findMany returns all versions
      mockPrisma.contract.findMany.mockResolvedValue([v1, v2]);

      const result = await service.getVersionHistory('contract-1');

      expect(result).toHaveLength(2);
      // v2 should have a diff showing annualMag changed
      const v2result = result.find((v: any) => v.version === 2) as any;
      expect(v2result).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(v2result?.diff).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(v2result?.diff?.annualMag).toEqual(
        expect.objectContaining({ old: expect.anything(), new: expect.anything() }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SNAPSHOT
  // ───────────────────────────────────────────────────────────────────────────

  describe('createSnapshot', () => {
    it('createSnapshot returns full contract JSON with relations', async () => {
      const contract = makeContract({
        contractAreas: [{ id: 'ca-1', area: { id: 'area-1' } }],
        contractServices: [{ id: 'cs-1', serviceDefinition: { id: 'sd-1' } }],
      });
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      const result = await service.createSnapshot('contract-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('contract-1');
      expect(result.contractAreas).toBeDefined();
      expect(result.contractServices).toBeDefined();
      // Must be plain JSON (no circular refs)
      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
