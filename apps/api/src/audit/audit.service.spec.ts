import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { AuditService } from './audit.service';
import { PrismaService } from '../database/prisma.service';

// ============================================================================
// AuditService Tests — Entity Timeline & Field-Level Diffs
// ============================================================================

describe('AuditService', () => {
  let service: AuditService;

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    obligation: {
      findUnique: jest.fn(),
    },
    contract: {
      findUnique: jest.fn(),
    },
  };

  const mockCls = {
    get: jest.fn().mockReturnValue('test-user'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  // --------------------------------------------------------------------------
  // diffStates
  // --------------------------------------------------------------------------

  describe('diffStates', () => {
    it('should return only changed fields for UPDATE', () => {
      const prev = { name: 'A', status: 'draft' };
      const next = { name: 'B', status: 'draft' };

      const result = service.diffStates(prev, next);

      expect(result).toEqual([{ field: 'name', from: 'A', to: 'B' }]);
    });

    it('should return all newState fields when previousState is null (CREATE)', () => {
      const result = service.diffStates(null, { name: 'A' });

      expect(result).toEqual([{ field: 'name', from: null, to: 'A' }]);
    });

    it('should return all previousState fields when newState is null (DELETE)', () => {
      const result = service.diffStates({ name: 'A' }, null);

      expect(result).toEqual([{ field: 'name', from: 'A', to: null }]);
    });

    it('should skip updatedAt and createdAt fields', () => {
      const prev = { name: 'A', updatedAt: '2026-01-01', createdAt: '2025-01-01' };
      const next = { name: 'B', updatedAt: '2026-02-01', createdAt: '2025-01-01' };

      const result = service.diffStates(prev, next);

      expect(result).toEqual([{ field: 'name', from: 'A', to: 'B' }]);
    });

    it('should detect changes in nested objects via JSON comparison', () => {
      const prev = { config: { a: 1 } };
      const next = { config: { a: 2 } };

      const result = service.diffStates(prev, next);

      expect(result).toEqual([{ field: 'config', from: { a: 1 }, to: { a: 2 } }]);
    });

    it('should return empty array when states are identical', () => {
      const prev = { name: 'A', status: 'draft' };
      const next = { name: 'A', status: 'draft' };

      const result = service.diffStates(prev, next);

      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getEntityTimeline
  // --------------------------------------------------------------------------

  describe('getEntityTimeline', () => {
    const obligationId = '11111111-1111-1111-1111-111111111111';
    const contractId = '22222222-2222-2222-2222-222222222222';
    const tenantId = '33333333-3333-3333-3333-333333333333';

    const makeAuditEntry = (overrides: Partial<Record<string, unknown>> = {}) => ({
      id: 'audit-1',
      entityType: 'Obligation',
      entityId: obligationId,
      action: 'UPDATE',
      actor: 'user-1',
      previousState: { status: 'scheduled' },
      newState: { status: 'pending_input' },
      createdAt: new Date('2026-03-01T10:00:00Z'),
      ...overrides,
    });

    it('should return timeline with calculationTrace for Obligation entity', async () => {
      const auditEntries = [
        makeAuditEntry({ createdAt: new Date('2026-03-02T10:00:00Z') }),
        makeAuditEntry({ createdAt: new Date('2026-03-01T10:00:00Z') }),
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(auditEntries);
      mockPrisma.obligation.findUnique.mockResolvedValue({
        calculationTrace: { formula: 'revenue * 0.15', inputs: { revenue: 1000 }, result: 150 },
        status: 'calculated',
        amount: 150,
        currency: 'TRY',
        chargeType: 'revenue_share',
      });

      const result = await service.getEntityTimeline('Obligation', obligationId);

      expect(result.entityType).toBe('Obligation');
      expect(result.entityId).toBe(obligationId);
      expect(result.enrichment).toEqual({
        calculationTrace: { formula: 'revenue * 0.15', inputs: { revenue: 1000 }, result: 150 },
        status: 'calculated',
        amount: 150,
        currency: 'TRY',
        chargeType: 'revenue_share',
      });
      expect(result.timeline).toHaveLength(2);
      expect(result.timeline[0].changes).toEqual([
        { field: 'status', from: 'scheduled', to: 'pending_input' },
      ]);
      expect(mockPrisma.obligation.findUnique).toHaveBeenCalledWith({
        where: { id: obligationId },
        select: {
          calculationTrace: true,
          status: true,
          amount: true,
          currency: true,
          chargeType: true,
        },
      });
    });

    it('should return timeline with obligationCount for Contract entity', async () => {
      const auditEntries = [
        makeAuditEntry({
          entityType: 'Contract',
          entityId: contractId,
          previousState: { status: 'draft' },
          newState: { status: 'active' },
        }),
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(auditEntries);
      mockPrisma.contract.findUnique.mockResolvedValue({
        contractNumber: 'CNT-001',
        version: 1,
        status: 'active',
        _count: { obligations: 5 },
      });

      const result = await service.getEntityTimeline('Contract', contractId);

      expect(result.entityType).toBe('Contract');
      expect(result.enrichment).toEqual({
        contractNumber: 'CNT-001',
        version: 1,
        status: 'active',
        obligationCount: 5,
      });
      expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith({
        where: { id: contractId },
        select: {
          contractNumber: true,
          version: true,
          status: true,
          _count: { select: { obligations: true } },
        },
      });
    });

    it('should return timeline without domain enrichment for generic entities (Tenant)', async () => {
      const auditEntries = [
        makeAuditEntry({
          entityType: 'Tenant',
          entityId: tenantId,
          previousState: { name: 'Old' },
          newState: { name: 'New' },
        }),
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(auditEntries);

      const result = await service.getEntityTimeline('Tenant', tenantId);

      expect(result.entityType).toBe('Tenant');
      expect(result.enrichment).toBeNull();
      expect(result.timeline).toHaveLength(1);
      expect(result.timeline[0].changes).toEqual([
        { field: 'name', from: 'Old', to: 'New' },
      ]);
      expect(mockPrisma.obligation.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.contract.findUnique).not.toHaveBeenCalled();
    });

    it('should order timeline entries newest first (desc by createdAt)', async () => {
      const auditEntries = [
        makeAuditEntry({
          id: 'audit-newer',
          createdAt: new Date('2026-03-05T10:00:00Z'),
          previousState: { status: 'pending_input' },
          newState: { status: 'calculated' },
        }),
        makeAuditEntry({
          id: 'audit-older',
          createdAt: new Date('2026-03-01T10:00:00Z'),
          previousState: { status: 'scheduled' },
          newState: { status: 'pending_input' },
        }),
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(auditEntries);
      mockPrisma.obligation.findUnique.mockResolvedValue(null);

      const result = await service.getEntityTimeline('Obligation', obligationId);

      expect(result.timeline[0].timestamp).toEqual(new Date('2026-03-05T10:00:00Z'));
      expect(result.timeline[1].timestamp).toEqual(new Date('2026-03-01T10:00:00Z'));
    });
  });
});
