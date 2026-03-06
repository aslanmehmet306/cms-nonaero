import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EquipmentStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { ValidateMeterReadingDto } from './dto/validate-meter-reading.dto';
import { CreateMaintenanceLogDto } from './dto/create-maintenance-log.dto';

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ALLOWED_TRANSITIONS defines valid state machine transitions.
 * Keys are the FROM state; values are valid TO states.
 *
 * Terminal state: disposed has an empty array.
 */
const ALLOWED_TRANSITIONS: Record<EquipmentStatus, EquipmentStatus[]> = {
  [EquipmentStatus.registered]: [EquipmentStatus.in_storage, EquipmentStatus.commissioned],
  [EquipmentStatus.in_storage]: [EquipmentStatus.commissioned, EquipmentStatus.disposed],
  [EquipmentStatus.commissioned]: [EquipmentStatus.under_maintenance, EquipmentStatus.decommissioned],
  [EquipmentStatus.under_maintenance]: [EquipmentStatus.commissioned, EquipmentStatus.decommissioned],
  [EquipmentStatus.decommissioned]: [EquipmentStatus.disposed, EquipmentStatus.commissioned],
  [EquipmentStatus.disposed]: [], // terminal
};

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Equipment Code Generation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate the next sequential equipment code for a given airport.
   * Format: EQP-001, EQP-002, ..., EQP-999, EQP-1000, ...
   */
  async generateNextEquipmentCode(airportId: string): Promise<string> {
    const lastEquipment = await this.prisma.equipment.findFirst({
      where: { airportId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    if (!lastEquipment) {
      return 'EQP-001';
    }

    const match = lastEquipment.code.match(/^EQP-(\d+)$/);
    if (!match) {
      return 'EQP-001';
    }

    const nextNumber = parseInt(match[1], 10) + 1;
    return `EQP-${String(nextNumber).padStart(3, '0')}`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CRUD
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new equipment item in registered state with an auto-generated code.
   * Validates that isMetered=true requires meterUnit to be provided.
   */
  async create(dto: CreateEquipmentDto) {
    // Validate metered equipment requires meterUnit
    if (dto.isMetered && !dto.meterUnit) {
      throw new BadRequestException(
        'meterUnit is required when isMetered is true',
      );
    }

    const code = await this.generateNextEquipmentCode(dto.airportId);

    return this.prisma.equipment.create({
      data: {
        airportId: dto.airportId,
        code,
        name: dto.name,
        equipmentType: dto.equipmentType,
        category: dto.category,
        status: EquipmentStatus.registered,
        ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
        ...(dto.manufacturer !== undefined ? { manufacturer: dto.manufacturer } : {}),
        ...(dto.modelName !== undefined ? { modelName: dto.modelName } : {}),
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber } : {}),
        ...(dto.ownership !== undefined ? { ownership: dto.ownership } : {}),
        ...(dto.acquisitionDate !== undefined
          ? { acquisitionDate: new Date(dto.acquisitionDate) }
          : {}),
        ...(dto.acquisitionCost !== undefined ? { acquisitionCost: dto.acquisitionCost } : {}),
        ...(dto.depreciationMethod !== undefined
          ? { depreciationMethod: dto.depreciationMethod }
          : {}),
        ...(dto.usefulLifeMonths !== undefined ? { usefulLifeMonths: dto.usefulLifeMonths } : {}),
        ...(dto.residualValue !== undefined ? { residualValue: dto.residualValue } : {}),
        ...(dto.monthlyRentalRate !== undefined
          ? { monthlyRentalRate: dto.monthlyRentalRate }
          : {}),
        ...(dto.rentalCurrency !== undefined ? { rentalCurrency: dto.rentalCurrency } : {}),
        ...(dto.warrantyExpiry !== undefined
          ? { warrantyExpiry: new Date(dto.warrantyExpiry) }
          : {}),
        ...(dto.insurancePolicy !== undefined ? { insurancePolicy: dto.insurancePolicy } : {}),
        ...(dto.insuranceExpiry !== undefined
          ? { insuranceExpiry: new Date(dto.insuranceExpiry) }
          : {}),
        ...(dto.isMetered !== undefined ? { isMetered: dto.isMetered } : {}),
        ...(dto.meterUnit !== undefined ? { meterUnit: dto.meterUnit } : {}),
        ...(dto.maintenanceIntervalDays !== undefined
          ? { maintenanceIntervalDays: dto.maintenanceIntervalDays }
          : {}),
        ...(dto.energyRating !== undefined ? { energyRating: dto.energyRating } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  /**
   * List equipment with optional filters and pagination.
   * Returns { data, meta } pagination envelope.
   */
  async findAll(query: QueryEquipmentDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.airportId) where.airportId = query.airportId;
    if (query.areaId) where.areaId = query.areaId;
    if (query.equipmentType) where.equipmentType = query.equipmentType;
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.isMetered !== undefined) where.isMetered = query.isMetered === 'true';

    const [data, total] = await Promise.all([
      this.prisma.equipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          area: true,
          airport: true,
        },
      }),
      this.prisma.equipment.count({ where }),
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
   * Get a single equipment item by ID with full relations.
   * Includes area, last 5 meter readings, last 5 maintenance logs, and contract equipment.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      include: {
        area: true,
        meterReadings: {
          orderBy: { readingDate: 'desc' },
          take: 5,
        },
        maintenanceLogs: {
          orderBy: { performedAt: 'desc' },
          take: 5,
        },
        contractEquipments: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }

    return equipment;
  }

  /**
   * Update an equipment item's mutable fields.
   * Throws NotFoundException if not found.
   */
  async update(id: string, dto: UpdateEquipmentDto) {
    const equipment = await this.prisma.equipment.findUnique({ where: { id } });

    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }

    return this.prisma.equipment.update({
      where: { id },
      data: {
        ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.manufacturer !== undefined ? { manufacturer: dto.manufacturer } : {}),
        ...(dto.modelName !== undefined ? { modelName: dto.modelName } : {}),
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber } : {}),
        ...(dto.ownership !== undefined ? { ownership: dto.ownership } : {}),
        ...(dto.acquisitionDate !== undefined
          ? { acquisitionDate: new Date(dto.acquisitionDate) }
          : {}),
        ...(dto.acquisitionCost !== undefined ? { acquisitionCost: dto.acquisitionCost } : {}),
        ...(dto.depreciationMethod !== undefined
          ? { depreciationMethod: dto.depreciationMethod }
          : {}),
        ...(dto.usefulLifeMonths !== undefined ? { usefulLifeMonths: dto.usefulLifeMonths } : {}),
        ...(dto.residualValue !== undefined ? { residualValue: dto.residualValue } : {}),
        ...(dto.monthlyRentalRate !== undefined
          ? { monthlyRentalRate: dto.monthlyRentalRate }
          : {}),
        ...(dto.rentalCurrency !== undefined ? { rentalCurrency: dto.rentalCurrency } : {}),
        ...(dto.warrantyExpiry !== undefined
          ? { warrantyExpiry: new Date(dto.warrantyExpiry) }
          : {}),
        ...(dto.insurancePolicy !== undefined ? { insurancePolicy: dto.insurancePolicy } : {}),
        ...(dto.insuranceExpiry !== undefined
          ? { insuranceExpiry: new Date(dto.insuranceExpiry) }
          : {}),
        ...(dto.isMetered !== undefined ? { isMetered: dto.isMetered } : {}),
        ...(dto.meterUnit !== undefined ? { meterUnit: dto.meterUnit } : {}),
        ...(dto.maintenanceIntervalDays !== undefined
          ? { maintenanceIntervalDays: dto.maintenanceIntervalDays }
          : {}),
        ...(dto.energyRating !== undefined ? { energyRating: dto.energyRating } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Machine Transition
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Transition equipment to a new status, validating against ALLOWED_TRANSITIONS.
   *
   * Side effects:
   * - commissioned: sets commissionedAt
   * - decommissioned: sets decommissionedAt
   */
  async transition(id: string, toStatus: EquipmentStatus) {
    const equipment = await this.prisma.equipment.findUnique({ where: { id } });

    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }

    const fromStatus = equipment.status as EquipmentStatus;

    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid state transition: ${fromStatus} -> ${toStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const updateData: Record<string, unknown> = { status: toStatus };

    if (toStatus === EquipmentStatus.commissioned) {
      updateData.commissionedAt = new Date();
    }

    if (toStatus === EquipmentStatus.decommissioned) {
      updateData.decommissionedAt = new Date();
    }

    const updated = await this.prisma.equipment.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Equipment ${equipment.code} transitioned: ${fromStatus} -> ${toStatus}`);

    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Meter Readings
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a meter reading for a metered equipment item.
   * Validates that the equipment has isMetered=true.
   * Calculates consumption from the previous reading and updates
   * equipment.lastMeterReading and equipment.lastMeterReadAt.
   */
  async createMeterReading(equipmentId: string, dto: CreateMeterReadingDto) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }

    if (!equipment.isMetered) {
      throw new BadRequestException(
        `Equipment ${equipmentId} is not metered. Cannot create meter reading.`,
      );
    }

    // Get the previous reading to calculate consumption
    const previousReading = await this.prisma.equipmentMeterReading.findFirst({
      where: { equipmentId },
      orderBy: { readingDate: 'desc' },
      select: { readingValue: true },
    });

    const readingValue = parseFloat(dto.readingValue);
    const previousValue: number | null = previousReading
      ? parseFloat(String(previousReading.readingValue))
      : null;
    const consumption: number | null =
      previousValue !== null ? readingValue - previousValue : null;

    const meterReading = await this.prisma.equipmentMeterReading.create({
      data: {
        equipmentId,
        readingDate: new Date(dto.readingDate),
        readingValue: dto.readingValue,
        ...(previousValue !== null ? { previousValue: String(previousValue) } : {}),
        ...(consumption !== null ? { consumption: String(consumption) } : {}),
        unit: dto.unit,
        readingType: dto.readingType,
        source: dto.source ?? 'manual',
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    // Update the equipment's lastMeterReading and lastMeterReadAt
    await this.prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        lastMeterReading: dto.readingValue,
        lastMeterReadAt: new Date(dto.readingDate),
      },
    });

    return meterReading;
  }

  /**
   * List meter readings for an equipment item with pagination.
   * Ordered by readingDate desc.
   */
  async listMeterReadings(equipmentId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where = { equipmentId };

    const [data, total] = await Promise.all([
      this.prisma.equipmentMeterReading.findMany({
        where,
        skip,
        take: limit,
        orderBy: { readingDate: 'desc' },
      }),
      this.prisma.equipmentMeterReading.count({ where }),
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
   * Validate a meter reading: set isValidated, validatedBy, and validatedAt.
   */
  async validateMeterReading(
    equipmentId: string,
    readingId: string,
    dto: ValidateMeterReadingDto,
  ) {
    const reading = await this.prisma.equipmentMeterReading.findFirst({
      where: { id: readingId, equipmentId },
    });

    if (!reading) {
      throw new NotFoundException(
        `Meter reading ${readingId} not found for equipment ${equipmentId}`,
      );
    }

    return this.prisma.equipmentMeterReading.update({
      where: { id: readingId },
      data: {
        isValidated: true,
        validatedBy: dto.validatedBy,
        validatedAt: new Date(),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Maintenance Logs
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a maintenance log entry for an equipment item.
   * If nextScheduledAt is provided, also updates equipment.nextMaintenanceAt.
   */
  async createMaintenanceLog(equipmentId: string, dto: CreateMaintenanceLogDto) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }

    const log = await this.prisma.equipmentMaintenanceLog.create({
      data: {
        equipmentId,
        maintenanceType: dto.maintenanceType,
        description: dto.description,
        performedBy: dto.performedBy,
        performedAt: new Date(dto.performedAt),
        ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.nextScheduledAt !== undefined
          ? { nextScheduledAt: new Date(dto.nextScheduledAt) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    // If nextScheduledAt provided, update equipment's nextMaintenanceAt
    if (dto.nextScheduledAt) {
      await this.prisma.equipment.update({
        where: { id: equipmentId },
        data: { nextMaintenanceAt: new Date(dto.nextScheduledAt) },
      });
    }

    return log;
  }

  /**
   * List maintenance logs for an equipment item with pagination.
   * Ordered by performedAt desc.
   */
  async listMaintenanceLogs(equipmentId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where = { equipmentId };

    const [data, total] = await Promise.all([
      this.prisma.equipmentMaintenanceLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { performedAt: 'desc' },
      }),
      this.prisma.equipmentMaintenanceLog.count({ where }),
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
}
