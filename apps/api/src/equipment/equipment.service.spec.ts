import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EquipmentStatus,
  EquipmentType,
  EquipmentCategory,
  EquipmentOwnership,
  MeterReadingType,
  MeterReadingSource,
  MaintenanceType,
} from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { EquipmentService } from './equipment.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeEquipment(overrides: Partial<any> = {}): any {
  return {
    id: 'equip-1',
    airportId: 'airport-1',
    areaId: null,
    code: 'EQP-001',
    name: 'POS Terminal Main Hall',
    equipmentType: EquipmentType.pos_terminal,
    category: EquipmentCategory.it_infrastructure,
    manufacturer: null,
    modelName: null,
    serialNumber: null,
    status: EquipmentStatus.registered,
    ownership: EquipmentOwnership.airport,
    acquisitionDate: null,
    acquisitionCost: null,
    depreciationMethod: null,
    usefulLifeMonths: null,
    residualValue: null,
    currentBookValue: null,
    monthlyRentalRate: null,
    rentalCurrency: 'TRY',
    warrantyExpiry: null,
    insurancePolicy: null,
    insuranceExpiry: null,
    isMetered: false,
    meterUnit: null,
    lastMeterReading: null,
    lastMeterReadAt: null,
    nextMaintenanceAt: null,
    maintenanceIntervalDays: null,
    energyRating: null,
    annualEnergyKwh: null,
    commissionedAt: null,
    decommissionedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    area: null,
    meterReadings: [],
    maintenanceLogs: [],
    contractEquipments: [],
    ...overrides,
  };
}

function makeMeterReading(overrides: Partial<any> = {}): any {
  return {
    id: 'reading-1',
    equipmentId: 'equip-1',
    readingDate: new Date('2025-01-31'),
    readingValue: '1500.5000',
    previousValue: null,
    consumption: null,
    unit: 'kWh',
    readingType: MeterReadingType.periodic,
    source: MeterReadingSource.manual,
    isValidated: false,
    validatedBy: null,
    validatedAt: null,
    photoUrl: null,
    notes: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeMaintenanceLog(overrides: Partial<any> = {}): any {
  return {
    id: 'log-1',
    equipmentId: 'equip-1',
    maintenanceType: MaintenanceType.preventive,
    description: 'Routine inspection',
    performedBy: 'Technician A',
    performedAt: new Date('2025-01-15'),
    cost: null,
    currency: 'TRY',
    nextScheduledAt: null,
    notes: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

let prisma: {
  equipment: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  equipmentMeterReading: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  equipmentMaintenanceLog: {
    findMany: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
};

function createMockPrisma(): typeof prisma {
  return {
    equipment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    equipmentMeterReading: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    equipmentMaintenanceLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('EquipmentService', () => {
  let service: EquipmentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EquipmentService>(EquipmentService);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // EQUIPMENT CODE GENERATION
  // ───────────────────────────────────────────────────────────────────────────

  describe('generateNextEquipmentCode', () => {
    it('returns EQP-001 when no equipment exists', async () => {
      prisma.equipment.findFirst.mockResolvedValue(null);
      const result = await service.generateNextEquipmentCode('airport-1');
      expect(result).toBe('EQP-001');
    });

    it('increments to EQP-002 when EQP-001 exists', async () => {
      prisma.equipment.findFirst.mockResolvedValue({ code: 'EQP-001' });
      const result = await service.generateNextEquipmentCode('airport-1');
      expect(result).toBe('EQP-002');
    });

    it('increments to EQP-004 after EQP-003', async () => {
      prisma.equipment.findFirst.mockResolvedValue({ code: 'EQP-003' });
      const result = await service.generateNextEquipmentCode('airport-1');
      expect(result).toBe('EQP-004');
    });

    it('pads correctly: EQP-010 after EQP-009', async () => {
      prisma.equipment.findFirst.mockResolvedValue({ code: 'EQP-009' });
      const result = await service.generateNextEquipmentCode('airport-1');
      expect(result).toBe('EQP-010');
    });

    it('handles large numbers: EQP-1000 after EQP-999', async () => {
      prisma.equipment.findFirst.mockResolvedValue({ code: 'EQP-999' });
      const result = await service.generateNextEquipmentCode('airport-1');
      expect(result).toBe('EQP-1000');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CREATE
  // ───────────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates equipment in registered status with auto-generated EQP-001 code', async () => {
      prisma.equipment.findFirst.mockResolvedValue(null);
      const equipment = makeEquipment();
      prisma.equipment.create.mockResolvedValue(equipment);

      const dto = {
        airportId: 'airport-1',
        name: 'POS Terminal Main Hall',
        equipmentType: EquipmentType.pos_terminal,
        category: EquipmentCategory.it_infrastructure,
      };

      const result = await service.create(dto as any);

      expect(prisma.equipment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'EQP-001',
            status: EquipmentStatus.registered,
          }),
        }),
      );
      expect(result.status).toBe(EquipmentStatus.registered);
      expect(result.code).toBe('EQP-001');
    });

    it('throws BadRequestException when isMetered=true but meterUnit is missing', async () => {
      const dto = {
        airportId: 'airport-1',
        name: 'Utility Meter',
        equipmentType: EquipmentType.utility_meter,
        category: EquipmentCategory.utility_infrastructure,
        isMetered: true,
        // meterUnit intentionally omitted
      };

      await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('creates metered equipment when isMetered=true and meterUnit is provided', async () => {
      prisma.equipment.findFirst.mockResolvedValue(null);
      const equipment = makeEquipment({ isMetered: true, meterUnit: 'kWh' });
      prisma.equipment.create.mockResolvedValue(equipment);

      const dto = {
        airportId: 'airport-1',
        name: 'Utility Meter',
        equipmentType: EquipmentType.utility_meter,
        category: EquipmentCategory.utility_infrastructure,
        isMetered: true,
        meterUnit: 'kWh',
      };

      const result = await service.create(dto as any);
      expect(result.isMetered).toBe(true);
      expect(result.meterUnit).toBe('kWh');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FIND ALL
  // ───────────────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated results with { data, meta } shape', async () => {
      const equipmentList = [makeEquipment()];
      prisma.equipment.findMany.mockResolvedValue(equipmentList);
      prisma.equipment.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toEqual(
        expect.objectContaining({
          data: equipmentList,
          meta: expect.objectContaining({
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        }),
      );
    });

    it('supports ?status=commissioned filter', async () => {
      prisma.equipment.findMany.mockResolvedValue([makeEquipment()]);
      prisma.equipment.count.mockResolvedValue(1);

      await service.findAll({ status: EquipmentStatus.commissioned });

      expect(prisma.equipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: EquipmentStatus.commissioned }),
        }),
      );
    });

    it('supports ?equipmentType filter', async () => {
      prisma.equipment.findMany.mockResolvedValue([]);
      prisma.equipment.count.mockResolvedValue(0);

      await service.findAll({ equipmentType: EquipmentType.pos_terminal });

      expect(prisma.equipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ equipmentType: EquipmentType.pos_terminal }),
        }),
      );
    });

    it('supports page and limit parameters', async () => {
      prisma.equipment.findMany.mockResolvedValue([]);
      prisma.equipment.count.mockResolvedValue(50);

      const result = await service.findAll({ page: 3, limit: 10 });

      expect(prisma.equipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FIND ONE
  // ───────────────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns equipment with relations', async () => {
      const equipment = makeEquipment({
        area: { id: 'area-1', name: 'Terminal 1' },
        meterReadings: [makeMeterReading()],
        maintenanceLogs: [makeMaintenanceLog()],
        contractEquipments: [],
      });
      prisma.equipment.findUnique.mockResolvedValue(equipment);

      const result = await service.findOne('equip-1');

      expect(result.id).toBe('equip-1');
      expect(result.area).toBeDefined();
      expect(result.meterReadings).toHaveLength(1);
      expect(result.maintenanceLogs).toHaveLength(1);
    });

    it('throws NotFoundException when equipment does not exist', async () => {
      prisma.equipment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ───────────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates equipment fields successfully', async () => {
      const equipment = makeEquipment();
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      const updated = { ...equipment, name: 'Updated POS Terminal' };
      prisma.equipment.update.mockResolvedValue(updated);

      const result = await service.update('equip-1', { name: 'Updated POS Terminal' });
      expect(result.name).toBe('Updated POS Terminal');
    });

    it('throws NotFoundException when equipment does not exist', async () => {
      prisma.equipment.findUnique.mockResolvedValue(null);
      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TRANSITION (STATE MACHINE)
  // ───────────────────────────────────────────────────────────────────────────

  describe('transition', () => {
    // ── Valid transitions ──────────────────────────────────────────────────

    it('registered -> commissioned succeeds', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.registered });
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      prisma.equipment.update.mockResolvedValue({
        ...equipment,
        status: EquipmentStatus.commissioned,
        commissionedAt: new Date(),
      });

      const result = await service.transition('equip-1', EquipmentStatus.commissioned);
      expect(result.status).toBe(EquipmentStatus.commissioned);
      expect(result.commissionedAt).toBeDefined();
    });

    it('registered -> in_storage succeeds', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.registered });
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      prisma.equipment.update.mockResolvedValue({
        ...equipment,
        status: EquipmentStatus.in_storage,
      });

      const result = await service.transition('equip-1', EquipmentStatus.in_storage);
      expect(result.status).toBe(EquipmentStatus.in_storage);
    });

    it('commissioned -> under_maintenance succeeds', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.commissioned });
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      prisma.equipment.update.mockResolvedValue({
        ...equipment,
        status: EquipmentStatus.under_maintenance,
      });

      const result = await service.transition('equip-1', EquipmentStatus.under_maintenance);
      expect(result.status).toBe(EquipmentStatus.under_maintenance);
    });

    it('under_maintenance -> commissioned succeeds', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.under_maintenance });
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      prisma.equipment.update.mockResolvedValue({
        ...equipment,
        status: EquipmentStatus.commissioned,
        commissionedAt: new Date(),
      });

      const result = await service.transition('equip-1', EquipmentStatus.commissioned);
      expect(result.status).toBe(EquipmentStatus.commissioned);
    });

    it('commissioned -> decommissioned succeeds (sets decommissionedAt)', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.commissioned });
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      prisma.equipment.update.mockResolvedValue({
        ...equipment,
        status: EquipmentStatus.decommissioned,
        decommissionedAt: new Date(),
      });

      const result = await service.transition('equip-1', EquipmentStatus.decommissioned);
      expect(result.status).toBe(EquipmentStatus.decommissioned);
      expect(result.decommissionedAt).toBeDefined();
    });

    it('decommissioned -> disposed succeeds', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.decommissioned });
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      prisma.equipment.update.mockResolvedValue({
        ...equipment,
        status: EquipmentStatus.disposed,
      });

      const result = await service.transition('equip-1', EquipmentStatus.disposed);
      expect(result.status).toBe(EquipmentStatus.disposed);
    });

    // ── Invalid transitions ───────────────────────────────────────────────

    it('registered -> under_maintenance throws BadRequestException (invalid)', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.registered });
      prisma.equipment.findUnique.mockResolvedValue(equipment);

      await expect(
        service.transition('equip-1', EquipmentStatus.under_maintenance),
      ).rejects.toThrow(BadRequestException);
    });

    it('in_storage -> under_maintenance throws BadRequestException (invalid)', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.in_storage });
      prisma.equipment.findUnique.mockResolvedValue(equipment);

      await expect(
        service.transition('equip-1', EquipmentStatus.under_maintenance),
      ).rejects.toThrow(BadRequestException);
    });

    it('commissioned -> registered throws BadRequestException (invalid)', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.commissioned });
      prisma.equipment.findUnique.mockResolvedValue(equipment);

      await expect(
        service.transition('equip-1', EquipmentStatus.registered),
      ).rejects.toThrow(BadRequestException);
    });

    // ── Terminal state ────────────────────────────────────────────────────

    it('disposed -> any transition throws BadRequestException (terminal state)', async () => {
      const equipment = makeEquipment({ status: EquipmentStatus.disposed });
      prisma.equipment.findUnique.mockResolvedValue(equipment);

      await expect(
        service.transition('equip-1', EquipmentStatus.commissioned),
      ).rejects.toThrow(BadRequestException);
    });

    // ── Not found ─────────────────────────────────────────────────────────

    it('transition on non-existent equipment throws NotFoundException', async () => {
      prisma.equipment.findUnique.mockResolvedValue(null);

      await expect(
        service.transition('nonexistent', EquipmentStatus.commissioned),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // METER READINGS
  // ───────────────────────────────────────────────────────────────────────────

  describe('createMeterReading', () => {
    it('creates meter reading with consumption calculated from previous reading', async () => {
      const equipment = makeEquipment({ isMetered: true, meterUnit: 'kWh' });
      prisma.equipment.findUnique.mockResolvedValue(equipment);

      // Previous reading exists
      prisma.equipmentMeterReading.findFirst.mockResolvedValue({
        readingValue: '1000.0000',
      });

      const reading = makeMeterReading({
        readingValue: '1500.5000',
        previousValue: '1000.0000',
        consumption: '500.5000',
      });
      prisma.equipmentMeterReading.create.mockResolvedValue(reading);
      prisma.equipment.update.mockResolvedValue(equipment);

      const dto = {
        readingDate: '2025-01-31',
        readingValue: '1500.5000',
        unit: 'kWh',
        readingType: MeterReadingType.periodic,
      };

      const result = await service.createMeterReading('equip-1', dto as any);

      expect(prisma.equipmentMeterReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            readingValue: '1500.5000',
            previousValue: '1000',
            consumption: '500.5',
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('creates first meter reading without consumption (no previous reading)', async () => {
      const equipment = makeEquipment({ isMetered: true, meterUnit: 'kWh' });
      prisma.equipment.findUnique.mockResolvedValue(equipment);

      // No previous reading
      prisma.equipmentMeterReading.findFirst.mockResolvedValue(null);

      const reading = makeMeterReading({ readingValue: '100.0000' });
      prisma.equipmentMeterReading.create.mockResolvedValue(reading);
      prisma.equipment.update.mockResolvedValue(equipment);

      const dto = {
        readingDate: '2025-01-31',
        readingValue: '100.0000',
        unit: 'kWh',
        readingType: MeterReadingType.opening,
      };

      const result = await service.createMeterReading('equip-1', dto as any);

      // Should not include previousValue or consumption
      expect(prisma.equipmentMeterReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            previousValue: expect.anything(),
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('rejects meter reading on non-metered equipment', async () => {
      const equipment = makeEquipment({ isMetered: false });
      prisma.equipment.findUnique.mockResolvedValue(equipment);

      const dto = {
        readingDate: '2025-01-31',
        readingValue: '100.0000',
        unit: 'kWh',
        readingType: MeterReadingType.periodic,
      };

      await expect(
        service.createMeterReading('equip-1', dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when equipment does not exist', async () => {
      prisma.equipment.findUnique.mockResolvedValue(null);

      const dto = {
        readingDate: '2025-01-31',
        readingValue: '100.0000',
        unit: 'kWh',
        readingType: MeterReadingType.periodic,
      };

      await expect(
        service.createMeterReading('nonexistent', dto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates equipment lastMeterReading and lastMeterReadAt after creating reading', async () => {
      const equipment = makeEquipment({ isMetered: true, meterUnit: 'kWh' });
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      prisma.equipmentMeterReading.findFirst.mockResolvedValue(null);
      prisma.equipmentMeterReading.create.mockResolvedValue(makeMeterReading());
      prisma.equipment.update.mockResolvedValue(equipment);

      const dto = {
        readingDate: '2025-01-31',
        readingValue: '500.0000',
        unit: 'kWh',
        readingType: MeterReadingType.periodic,
      };

      await service.createMeterReading('equip-1', dto as any);

      expect(prisma.equipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'equip-1' },
          data: expect.objectContaining({
            lastMeterReading: '500.0000',
            lastMeterReadAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('listMeterReadings', () => {
    it('returns paginated meter readings ordered by readingDate desc', async () => {
      const readings = [makeMeterReading()];
      prisma.equipmentMeterReading.findMany.mockResolvedValue(readings);
      prisma.equipmentMeterReading.count.mockResolvedValue(1);

      const result = await service.listMeterReadings('equip-1', 1, 20);

      expect(result).toEqual(
        expect.objectContaining({
          data: readings,
          meta: expect.objectContaining({
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        }),
      );
      expect(prisma.equipmentMeterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { readingDate: 'desc' },
        }),
      );
    });
  });

  describe('validateMeterReading', () => {
    it('validates a meter reading (sets isValidated, validatedBy, validatedAt)', async () => {
      const reading = makeMeterReading();
      prisma.equipmentMeterReading.findFirst.mockResolvedValue(reading);
      const validatedReading = {
        ...reading,
        isValidated: true,
        validatedBy: 'user-1',
        validatedAt: new Date(),
      };
      prisma.equipmentMeterReading.update.mockResolvedValue(validatedReading);

      const result = await service.validateMeterReading('equip-1', 'reading-1', {
        validatedBy: 'user-1',
      });

      expect(result.isValidated).toBe(true);
      expect(result.validatedBy).toBe('user-1');
      expect(result.validatedAt).toBeDefined();
    });

    it('throws NotFoundException when reading does not exist', async () => {
      prisma.equipmentMeterReading.findFirst.mockResolvedValue(null);

      await expect(
        service.validateMeterReading('equip-1', 'nonexistent', { validatedBy: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MAINTENANCE LOGS
  // ───────────────────────────────────────────────────────────────────────────

  describe('createMaintenanceLog', () => {
    it('creates a maintenance log entry', async () => {
      const equipment = makeEquipment();
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      const log = makeMaintenanceLog();
      prisma.equipmentMaintenanceLog.create.mockResolvedValue(log);

      const dto = {
        maintenanceType: MaintenanceType.preventive,
        description: 'Routine inspection',
        performedBy: 'Technician A',
        performedAt: '2025-01-15',
      };

      const result = await service.createMaintenanceLog('equip-1', dto as any);

      expect(prisma.equipmentMaintenanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            equipmentId: 'equip-1',
            maintenanceType: MaintenanceType.preventive,
            description: 'Routine inspection',
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('updates equipment.nextMaintenanceAt when nextScheduledAt is provided', async () => {
      const equipment = makeEquipment();
      prisma.equipment.findUnique.mockResolvedValue(equipment);
      const log = makeMaintenanceLog({ nextScheduledAt: new Date('2025-04-15') });
      prisma.equipmentMaintenanceLog.create.mockResolvedValue(log);
      prisma.equipment.update.mockResolvedValue(equipment);

      const dto = {
        maintenanceType: MaintenanceType.preventive,
        description: 'Routine inspection',
        performedBy: 'Technician A',
        performedAt: '2025-01-15',
        nextScheduledAt: '2025-04-15',
      };

      await service.createMaintenanceLog('equip-1', dto as any);

      expect(prisma.equipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'equip-1' },
          data: expect.objectContaining({
            nextMaintenanceAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws NotFoundException when equipment does not exist', async () => {
      prisma.equipment.findUnique.mockResolvedValue(null);

      const dto = {
        maintenanceType: MaintenanceType.corrective,
        description: 'Fix broken display',
        performedBy: 'Technician B',
        performedAt: '2025-02-01',
      };

      await expect(
        service.createMaintenanceLog('nonexistent', dto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMaintenanceLogs', () => {
    it('returns paginated maintenance logs ordered by performedAt desc', async () => {
      const logs = [makeMaintenanceLog()];
      prisma.equipmentMaintenanceLog.findMany.mockResolvedValue(logs);
      prisma.equipmentMaintenanceLog.count.mockResolvedValue(1);

      const result = await service.listMaintenanceLogs('equip-1', 1, 20);

      expect(result).toEqual(
        expect.objectContaining({
          data: logs,
          meta: expect.objectContaining({
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        }),
      );
      expect(prisma.equipmentMaintenanceLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { performedAt: 'desc' },
        }),
      );
    });
  });
});
