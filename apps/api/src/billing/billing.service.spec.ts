import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillingService } from './billing.service';
import { PrismaService } from '../database/prisma.service';
import {
  BillingRunMode,
  BillingRunStatus,
  BillingRunType,
  ObligationStatus,
} from '@shared-types/enums';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: {
    billingRun: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
    obligation: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    contract: {
      findMany: jest.Mock;
    };
  };
  let queue: { add: jest.Mock };
  let invoiceQueue: { add: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  const airportId = 'airport-uuid-1';
  const tenantId1 = 'tenant-uuid-1';
  const tenantId2 = 'tenant-uuid-2';

  beforeEach(async () => {
    prisma = {
      billingRun: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      obligation: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      contract: {
        findMany: jest.fn(),
      },
    };

    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    invoiceQueue = { add: jest.fn().mockResolvedValue({ id: 'invoice-job-1' }) };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('billing-run'), useValue: queue },
        { provide: getQueueToken('invoice-generation'), useValue: invoiceQueue },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  describe('createBillingRun', () => {
    const baseDto = {
      airportId,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      runType: BillingRunType.manual,
      runMode: BillingRunMode.full,
    };

    it('should create BillingRun with status=initiated, enqueue job, and return run', async () => {
      prisma.billingRun.findFirst.mockResolvedValue(null); // no active run
      const createdRun = {
        id: 'run-uuid-1',
        airportId,
        status: BillingRunStatus.initiated,
        filters: { tenantIds: [] },
      };
      prisma.billingRun.create.mockResolvedValue(createdRun);

      const result = await service.createBillingRun(baseDto);

      expect(result).toEqual(createdRun);
      expect(prisma.billingRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            airportId,
            status: BillingRunStatus.initiated,
            filters: { tenantIds: [] },
          }),
        }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'process-billing-run',
        { billingRunId: 'run-uuid-1' },
        expect.objectContaining({
          jobId: 'run-uuid-1',
          attempts: 3,
        }),
      );
    });

    it('should store single tenantId in filters.tenantIds array', async () => {
      prisma.billingRun.findFirst.mockResolvedValue(null);
      prisma.billingRun.create.mockResolvedValue({ id: 'run-uuid-2' });

      await service.createBillingRun({ ...baseDto, tenantIds: [tenantId1] });

      expect(prisma.billingRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filters: { tenantIds: [tenantId1] },
          }),
        }),
      );
    });

    it('should store multiple tenantIds in filters', async () => {
      prisma.billingRun.findFirst.mockResolvedValue(null);
      prisma.billingRun.create.mockResolvedValue({ id: 'run-uuid-3' });

      await service.createBillingRun({
        ...baseDto,
        tenantIds: [tenantId1, tenantId2],
      });

      expect(prisma.billingRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filters: { tenantIds: [tenantId1, tenantId2] },
          }),
        }),
      );
    });

    it('should reject if active run exists for same airport+period (R8.7)', async () => {
      prisma.billingRun.findFirst.mockResolvedValue({
        id: 'existing-run',
        status: BillingRunStatus.scoping,
      });

      await expect(service.createBillingRun(baseDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.billingRun.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('transitionRun', () => {
    it('should allow valid transition: initiated -> scoping', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.initiated,
      });
      prisma.billingRun.update.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.scoping,
      });

      const result = await service.transitionRun('run-1', BillingRunStatus.scoping);

      expect(result.status).toBe(BillingRunStatus.scoping);
      expect(prisma.billingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-1' },
          data: expect.objectContaining({ status: BillingRunStatus.scoping }),
        }),
      );
    });

    it('should reject invalid transition: initiated -> completed', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.initiated,
      });

      await expect(
        service.transitionRun('run-1', BillingRunStatus.completed),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow cancellation from any non-terminal state', async () => {
      const nonTerminalStates = [
        BillingRunStatus.initiated,
        BillingRunStatus.scoping,
        BillingRunStatus.calculating,
        BillingRunStatus.draft_ready,
        BillingRunStatus.approved,
        BillingRunStatus.invoicing,
      ];

      for (const status of nonTerminalStates) {
        prisma.billingRun.findUnique.mockResolvedValue({ id: 'run-1', status });
        prisma.billingRun.update.mockResolvedValue({
          id: 'run-1',
          status: BillingRunStatus.cancelled,
        });

        const result = await service.transitionRun('run-1', BillingRunStatus.cancelled);
        expect(result.status).toBe(BillingRunStatus.cancelled);
      }
    });

    it('should reject transitions from terminal states', async () => {
      const terminalStates = [
        BillingRunStatus.completed,
        BillingRunStatus.rejected,
        BillingRunStatus.cancelled,
        BillingRunStatus.partial,
      ];

      for (const status of terminalStates) {
        prisma.billingRun.findUnique.mockResolvedValue({ id: 'run-1', status });

        await expect(
          service.transitionRun('run-1', BillingRunStatus.scoping),
        ).rejects.toThrow(BadRequestException);
      }
    });
  });

  describe('scopeObligations', () => {
    it('should return obligations with status=ready for specified tenants+period', async () => {
      const billingRun = {
        id: 'run-1',
        airportId,
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        filters: { tenantIds: [tenantId1] },
        runMode: BillingRunMode.full,
      };
      prisma.billingRun.findUnique.mockResolvedValue(billingRun);

      const obligations = [
        { id: 'obl-1', tenantId: tenantId1, status: ObligationStatus.ready },
        { id: 'obl-2', tenantId: tenantId1, status: ObligationStatus.ready },
      ];
      prisma.obligation.findMany.mockResolvedValue(obligations);
      prisma.obligation.updateMany.mockResolvedValue({ count: 2 });
      prisma.billingRun.update.mockResolvedValue({});

      const result = await service.scopeObligations('run-1');

      expect(result).toHaveLength(2);
      expect(prisma.obligation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            airportId,
            status: ObligationStatus.ready,
            tenantId: { in: [tenantId1] },
          }),
        }),
      );
    });

    it('should exclude already-invoiced obligations in delta mode', async () => {
      const billingRun = {
        id: 'run-1',
        airportId,
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        filters: { tenantIds: [] },
        runMode: BillingRunMode.delta,
      };
      prisma.billingRun.findUnique.mockResolvedValue(billingRun);
      prisma.obligation.findMany.mockResolvedValue([]);
      prisma.obligation.updateMany.mockResolvedValue({ count: 0 });
      prisma.billingRun.update.mockResolvedValue({});

      await service.scopeObligations('run-1');

      expect(prisma.obligation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceLogId: null,
          }),
        }),
      );
    });
  });

  describe('createContractSnapshot', () => {
    it('should store JSONB snapshot of active contracts for billing run', async () => {
      const billingRun = {
        id: 'run-1',
        airportId,
        obligations: [
          { contractId: 'contract-1' },
          { contractId: 'contract-1' },
          { contractId: 'contract-2' },
        ],
      };
      prisma.billingRun.findUnique.mockResolvedValue(billingRun);

      const contracts = [
        {
          id: 'contract-1',
          contractNumber: 'CNT-001',
          version: 1,
          tenantId: tenantId1,
          contractServices: [],
          contractAreas: [],
        },
        {
          id: 'contract-2',
          contractNumber: 'CNT-002',
          version: 1,
          tenantId: tenantId2,
          contractServices: [],
          contractAreas: [],
        },
      ];
      prisma.contract.findMany.mockResolvedValue(contracts);
      prisma.billingRun.update.mockResolvedValue({});

      await service.createContractSnapshot('run-1');

      expect(prisma.billingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-1' },
          data: expect.objectContaining({
            contractSnapshot: expect.arrayContaining([
              expect.objectContaining({ id: 'contract-1', contractNumber: 'CNT-001' }),
              expect.objectContaining({ id: 'contract-2', contractNumber: 'CNT-002' }),
            ]),
          }),
        }),
      );
    });
  });

  describe('approveBillingRun', () => {
    it('should transition from draft_ready to approved and set approvedBy/approvedAt', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.draft_ready,
      });
      prisma.billingRun.update.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.approved,
        approvedBy: 'user-1',
        approvedAt: expect.any(Date),
      });

      await service.approveBillingRun('run-1', { approvedBy: 'user-1' });

      expect(prisma.billingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-1' },
          data: expect.objectContaining({
            status: BillingRunStatus.approved,
            approvedBy: 'user-1',
            approvedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('rejectBillingRun', () => {
    it('should transition from draft_ready to rejected', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.draft_ready,
      });
      prisma.billingRun.update.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.rejected,
      });

      await service.rejectBillingRun('run-1');

      expect(prisma.billingRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-1' },
          data: expect.objectContaining({
            status: BillingRunStatus.rejected,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // cancelTenants (05-02)
  // ─────────────────────────────────────────────────────────────────────

  describe('cancelTenants', () => {
    const tenantId3 = 'tenant-uuid-3';

    it('should remove specified tenantIds from billing run by unlinking their obligations', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.calculating,
        filters: { tenantIds: [tenantId1, tenantId2, tenantId3], cancelledTenants: [] },
      });
      prisma.obligation.updateMany.mockResolvedValue({ count: 2 });
      prisma.billingRun.update.mockResolvedValue({
        id: 'run-1',
        filters: { tenantIds: [tenantId1, tenantId2, tenantId3], cancelledTenants: [tenantId1] },
      });

      await service.cancelTenants('run-1', { tenantIds: [tenantId1] });

      // Should unlink obligations for the cancelled tenant
      expect(prisma.obligation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            billingRunId: 'run-1',
            tenantId: { in: [tenantId1] },
          }),
          data: { billingRunId: null },
        }),
      );
    });

    it('should NOT affect other tenants obligations in the same run', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.calculating,
        filters: { tenantIds: [tenantId1, tenantId2], cancelledTenants: [] },
      });
      prisma.obligation.updateMany.mockResolvedValue({ count: 1 });
      prisma.billingRun.update.mockResolvedValue({
        id: 'run-1',
        filters: { tenantIds: [tenantId1, tenantId2], cancelledTenants: [tenantId1] },
      });

      await service.cancelTenants('run-1', { tenantIds: [tenantId1] });

      // The updateMany where should ONLY include the cancelled tenantId
      expect(prisma.obligation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: { in: [tenantId1] },
          }),
        }),
      );
      // Ensure tenantId2 was NOT in the cancellation query
      const updateCall = prisma.obligation.updateMany.mock.calls[0][0];
      expect(updateCall.where.tenantId.in).not.toContain(tenantId2);
    });

    it('should transition run to cancelled if ALL tenants are cancelled', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.calculating,
        filters: { tenantIds: [tenantId1], cancelledTenants: [] },
      });
      prisma.obligation.updateMany.mockResolvedValue({ count: 1 });
      // First update call: update filters
      // Second findUnique + update: transition to cancelled (via transitionRun)
      prisma.billingRun.update
        .mockResolvedValueOnce({
          id: 'run-1',
          status: BillingRunStatus.calculating,
          filters: { tenantIds: [tenantId1], cancelledTenants: [tenantId1] },
        })
        .mockResolvedValueOnce({
          id: 'run-1',
          status: BillingRunStatus.cancelled,
        });
      // transitionRun re-fetches the run
      prisma.billingRun.findUnique
        .mockResolvedValueOnce({
          id: 'run-1',
          status: BillingRunStatus.calculating,
          filters: { tenantIds: [tenantId1], cancelledTenants: [] },
        })
        .mockResolvedValueOnce({
          id: 'run-1',
          status: BillingRunStatus.calculating,
        });

      const result = await service.cancelTenants('run-1', { tenantIds: [tenantId1] });

      // Should have called update to set status to cancelled
      const updateCalls = prisma.billingRun.update.mock.calls;
      const cancellationCall = updateCalls.find(
        (call: unknown[]) => (call[0] as Record<string, unknown>).data &&
          ((call[0] as Record<string, Record<string, unknown>>).data.status === BillingRunStatus.cancelled),
      );
      expect(cancellationCall).toBeDefined();
    });

    it('should keep run in current state if some tenants remain', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.calculating,
        filters: { tenantIds: [tenantId1, tenantId2], cancelledTenants: [] },
      });
      prisma.obligation.updateMany.mockResolvedValue({ count: 1 });
      prisma.billingRun.update.mockResolvedValue({
        id: 'run-1',
        status: BillingRunStatus.calculating,
        filters: { tenantIds: [tenantId1, tenantId2], cancelledTenants: [tenantId1] },
      });

      await service.cancelTenants('run-1', { tenantIds: [tenantId1] });

      // Status should NOT be changed to cancelled (tenantId2 still remains)
      const updateCalls = prisma.billingRun.update.mock.calls;
      // Only one update call (filter update), no transition to cancelled
      expect(updateCalls).toHaveLength(1);
      // The single update should NOT set status to cancelled
      expect(updateCalls[0][0].data.status).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // rerunBillingRun (05-02)
  // ─────────────────────────────────────────────────────────────────────

  describe('rerunBillingRun', () => {
    it('should create new run with runMode=full from cancelled run', async () => {
      const previousRun = {
        id: 'old-run-1',
        airportId,
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        status: BillingRunStatus.cancelled,
        filters: { tenantIds: [tenantId1, tenantId2] },
      };
      prisma.billingRun.findUnique.mockResolvedValue(previousRun);
      prisma.billingRun.findFirst.mockResolvedValue(null); // no active run
      const newRun = {
        id: 'new-run-1',
        airportId,
        status: BillingRunStatus.initiated,
        runMode: BillingRunMode.full,
        previousRunId: 'old-run-1',
      };
      prisma.billingRun.create.mockResolvedValue(newRun);

      const result = await service.rerunBillingRun({ previousRunId: 'old-run-1' });

      expect(result.runMode).toBe(BillingRunMode.full);
      expect(prisma.billingRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            airportId,
            runMode: BillingRunMode.full,
            previousRunId: 'old-run-1',
          }),
        }),
      );
    });

    it('should create new run with runMode=delta from completed run', async () => {
      const previousRun = {
        id: 'old-run-2',
        airportId,
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        status: BillingRunStatus.completed,
        filters: { tenantIds: [] },
      };
      prisma.billingRun.findUnique.mockResolvedValue(previousRun);
      prisma.billingRun.findFirst.mockResolvedValue(null);
      const newRun = {
        id: 'new-run-2',
        airportId,
        status: BillingRunStatus.initiated,
        runMode: BillingRunMode.delta,
        previousRunId: 'old-run-2',
      };
      prisma.billingRun.create.mockResolvedValue(newRun);

      const result = await service.rerunBillingRun({ previousRunId: 'old-run-2' });

      expect(result.runMode).toBe(BillingRunMode.delta);
      expect(prisma.billingRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            runMode: BillingRunMode.delta,
            previousRunId: 'old-run-2',
          }),
        }),
      );
    });

    it('should reject re-run from non-terminal state (still in progress)', async () => {
      prisma.billingRun.findUnique.mockResolvedValue({
        id: 'old-run-3',
        status: BillingRunStatus.calculating,
      });

      await expect(
        service.rerunBillingRun({ previousRunId: 'old-run-3' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.billingRun.create).not.toHaveBeenCalled();
    });

    it('should create delta mode run from partial status (re-run failed tenants)', async () => {
      const previousRun = {
        id: 'old-run-4',
        airportId,
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        status: BillingRunStatus.partial,
        filters: { tenantIds: [tenantId1] },
      };
      prisma.billingRun.findUnique.mockResolvedValue(previousRun);
      prisma.billingRun.findFirst.mockResolvedValue(null);
      prisma.billingRun.create.mockResolvedValue({
        id: 'new-run-4',
        runMode: BillingRunMode.delta,
        previousRunId: 'old-run-4',
      });

      const result = await service.rerunBillingRun({ previousRunId: 'old-run-4' });

      expect(result.runMode).toBe(BillingRunMode.delta);
    });
  });
});
