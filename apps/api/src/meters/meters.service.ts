import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';

@Injectable()
export class MetersService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all meters for an area. */
  async findByArea(areaId: string) {
    return this.prisma.meter.findMany({
      where: { areaId },
      orderBy: { serialNumber: 'asc' },
    });
  }

  /** Get a single meter by ID. */
  async findOne(id: string) {
    const meter = await this.prisma.meter.findUnique({
      where: { id },
      include: { area: true },
    });

    if (!meter) {
      throw new NotFoundException(`Meter ${id} not found`);
    }

    return meter;
  }

  /** Create a new meter linked to an area. */
  async create(dto: CreateMeterDto) {
    // Verify area exists
    const area = await this.prisma.area.findUnique({ where: { id: dto.areaId } });
    if (!area) {
      throw new NotFoundException(`Area ${dto.areaId} not found`);
    }

    return this.prisma.meter.create({ data: dto });
  }

  /** Update an existing meter. */
  async update(id: string, dto: UpdateMeterDto) {
    await this.findOne(id);
    return this.prisma.meter.update({ where: { id }, data: dto });
  }

  /** Delete a meter. */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.meter.delete({ where: { id } });
  }
}
