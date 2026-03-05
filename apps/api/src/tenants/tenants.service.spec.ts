import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../database/prisma.service';
import { TenantStatus, ContractStatus } from '@shared-types/enums';

// Mock Stripe module
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
  }));
});

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: {
    tenant: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    contract: {
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let configService: { get: jest.Mock };

  const mockTenant = {
    id: 'tenant-uuid-1',
    airportId: 'airport-uuid-1',
    code: 'TNT-001',
    name: 'Test Tenant',
    taxId: 'TX-12345',
    email: 'tenant@example.com',
    phone: '+1234567890',
    address: '123 Main St',
    stripeCustomerId: 'cus_test123',
    status: TenantStatus.active,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      contract: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    configService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateNextTenantCode', () => {
    it('should return TNT-001 when no existing tenants', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);

      const code = await service.generateNextTenantCode('airport-uuid-1');

      expect(code).toBe('TNT-001');
    });

    it('should return TNT-004 when last tenant has code TNT-003', async () => {
      prisma.tenant.findFirst.mockResolvedValue({
        ...mockTenant,
        code: 'TNT-003',
      });

      const code = await service.generateNextTenantCode('airport-uuid-1');

      expect(code).toBe('TNT-004');
    });

    it('should pad numbers to 3 digits', async () => {
      prisma.tenant.findFirst.mockResolvedValue({
        ...mockTenant,
        code: 'TNT-009',
      });

      const code = await service.generateNextTenantCode('airport-uuid-1');

      expect(code).toBe('TNT-010');
    });
  });

  describe('create', () => {
    it('should create tenant with generated code and Stripe customer', async () => {
      configService.get.mockReturnValue('sk_test_key');

      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(mockTenant);

      const dto = {
        airportId: 'airport-uuid-1',
        name: 'Test Tenant',
        taxId: 'TX-12345',
        email: 'tenant@example.com',
        phone: '+1234567890',
        address: '123 Main St',
      };

      const result = await service.create(dto);

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'TNT-001',
            name: dto.name,
            email: dto.email,
          }),
        }),
      );
      expect(result).toEqual(mockTenant);
    });

    it('should create tenant without Stripe customer when STRIPE_SECRET_KEY not configured', async () => {
      configService.get.mockReturnValue(undefined);

      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue({
        ...mockTenant,
        stripeCustomerId: null,
      });

      const dto = {
        airportId: 'airport-uuid-1',
        name: 'Test Tenant',
        taxId: 'TX-12345',
        email: 'tenant@example.com',
      };

      const result = await service.create(dto);

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeCustomerId: null,
          }),
        }),
      );
      expect(result.stripeCustomerId).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all tenants for airport without status filter', async () => {
      const tenants = [mockTenant];
      prisma.tenant.findMany.mockResolvedValue(tenants);
      prisma.tenant.count.mockResolvedValue(1);

      const result = await service.findAll('airport-uuid-1');

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { airportId: 'airport-uuid-1' },
        }),
      );
      expect(result.data).toEqual(tenants);
    });

    it('should filter tenants by status', async () => {
      const activeTenants = [mockTenant];
      prisma.tenant.findMany.mockResolvedValue(activeTenants);
      prisma.tenant.count.mockResolvedValue(1);

      const result = await service.findAll('airport-uuid-1', TenantStatus.active);

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { airportId: 'airport-uuid-1', status: TenantStatus.active },
        }),
      );
      expect(result.data).toEqual(activeTenants);
    });

    it('should return paginated results with meta', async () => {
      prisma.tenant.findMany.mockResolvedValue([mockTenant]);
      prisma.tenant.count.mockResolvedValue(5);

      const result = await service.findAll('airport-uuid-1', undefined, 2, 10);

      expect(result.meta).toEqual({
        total: 5,
        page: 2,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('should return tenant by ID', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findOne('tenant-uuid-1');

      expect(result).toEqual(mockTenant);
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update tenant allowed fields', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        name: 'Updated Name',
        email: 'updated@example.com',
      });

      const result = await service.update('tenant-uuid-1', {
        name: 'Updated Name',
        email: 'updated@example.com',
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          data: expect.objectContaining({
            name: 'Updated Name',
            email: 'updated@example.com',
          }),
        }),
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      // updateStatus now uses $transaction — delegate to callback so existing tests work
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    });

    it('should allow transition from active to suspended', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.suspended,
      });
      prisma.contract.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.updateStatus('tenant-uuid-1', TenantStatus.suspended);

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: TenantStatus.suspended }),
        }),
      );
      expect(result.status).toBe(TenantStatus.suspended);
    });

    it('should allow transition from active to deactivated', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.deactivated,
      });
      // deactivated: no contract cascade expected

      const result = await service.updateStatus('tenant-uuid-1', TenantStatus.deactivated);

      expect(result.status).toBe(TenantStatus.deactivated);
    });

    it('should allow transition from suspended back to active (reversible)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.suspended,
      });
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.active,
      });
      prisma.contract.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.updateStatus('tenant-uuid-1', TenantStatus.active);

      expect(result.status).toBe(TenantStatus.active);
    });

    it('should allow transition from deactivated back to active (reversible)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.deactivated,
      });
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.active,
      });
      prisma.contract.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.updateStatus('tenant-uuid-1', TenantStatus.active);

      expect(result.status).toBe(TenantStatus.active);
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent-id', TenantStatus.suspended),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus - contract cascade', () => {
    it('should cascade to active contracts when suspending tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      // $transaction executes the callback
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
      prisma.tenant.update.mockResolvedValue({ ...mockTenant, status: TenantStatus.suspended });
      prisma.contract.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.updateStatus('tenant-uuid-1', TenantStatus.suspended);

      expect(prisma.contract.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-uuid-1', status: ContractStatus.active },
        data: { status: ContractStatus.suspended },
      });
      expect(result.status).toBe(TenantStatus.suspended);
    });

    it('should cascade to suspended contracts when reactivating tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ ...mockTenant, status: TenantStatus.suspended });
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
      prisma.tenant.update.mockResolvedValue({ ...mockTenant, status: TenantStatus.active });
      prisma.contract.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.updateStatus('tenant-uuid-1', TenantStatus.active);

      expect(prisma.contract.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-uuid-1', status: ContractStatus.suspended },
        data: { status: ContractStatus.active },
      });
      expect(result.status).toBe(TenantStatus.active);
    });

    it('should NOT cascade to contracts when deactivating tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
      prisma.tenant.update.mockResolvedValue({ ...mockTenant, status: TenantStatus.deactivated });

      await service.updateStatus('tenant-uuid-1', TenantStatus.deactivated);

      expect(prisma.contract.updateMany).not.toHaveBeenCalled();
    });

    it('should use updateMany for efficient batch contract cascade (not N+1)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
      prisma.tenant.update.mockResolvedValue({ ...mockTenant, status: TenantStatus.suspended });
      prisma.contract.updateMany.mockResolvedValue({ count: 5 });

      await service.updateStatus('tenant-uuid-1', TenantStatus.suspended);

      // updateMany called exactly once — no N+1 loop
      expect(prisma.contract.updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
