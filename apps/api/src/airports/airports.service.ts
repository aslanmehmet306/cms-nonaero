import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAirportDto } from './dto/create-airport.dto';
import { UpdateAirportDto } from './dto/update-airport.dto';

@Injectable()
export class AirportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return all airports, each with a count of associated areas.
   */
  async findAll() {
    return this.prisma.airport.findMany({
      include: { _count: { select: { areas: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Return a single airport by ID, including areas count.
   * Throws NotFoundException when the airport does not exist.
   */
  async findOne(id: string) {
    const airport = await this.prisma.airport.findUnique({
      where: { id },
      include: { _count: { select: { areas: true } } },
    });

    if (!airport) {
      throw new NotFoundException(`Airport ${id} not found`);
    }

    return airport;
  }

  /**
   * Create a new airport.
   */
  async create(dto: CreateAirportDto) {
    return this.prisma.airport.create({ data: dto });
  }

  /**
   * Update an existing airport.
   * Throws NotFoundException when the airport does not exist.
   */
  async update(id: string, dto: UpdateAirportDto) {
    await this.findOne(id);

    return this.prisma.airport.update({
      where: { id },
      data: dto,
    });
  }
}
