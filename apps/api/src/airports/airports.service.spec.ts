import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AirportsService } from './airports.service';
import { PrismaService } from '../database/prisma.service';

describe('AirportsService', () => {
  let service: AirportsService;
  let prisma: {
    airport: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockAirport = {
    id: 'airport-uuid-1',
    code: 'ADB',
    name: 'Izmir Adnan Menderes International Airport',
    countryCode: 'TR',
    defaultCurrency: 'TRY',
    timezone: 'Europe/Istanbul',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { areas: 21 },
  };

  beforeEach(async () => {
    prisma = {
      airport: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AirportsService>(AirportsService);
  });

  describe('findAll', () => {
    it('should return array of airports with areas count', async () => {
      prisma.airport.findMany.mockResolvedValue([mockAirport]);

      const result = await service.findAll();

      expect(result).toEqual([mockAirport]);
      expect(prisma.airport.findMany).toHaveBeenCalledWith({
        include: { _count: { select: { areas: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no airports exist', async () => {
      prisma.airport.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return airport with areas count', async () => {
      prisma.airport.findUnique.mockResolvedValue(mockAirport);

      const result = await service.findOne('airport-uuid-1');

      expect(result).toEqual(mockAirport);
      expect(prisma.airport.findUnique).toHaveBeenCalledWith({
        where: { id: 'airport-uuid-1' },
        include: { _count: { select: { areas: true } } },
      });
    });

    it('should throw NotFoundException when airport not found', async () => {
      prisma.airport.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and return a new airport', async () => {
      const dto = {
        code: 'IST',
        name: 'Istanbul Airport',
        countryCode: 'TR',
        defaultCurrency: 'TRY',
        timezone: 'Europe/Istanbul',
      };

      const createdAirport = { id: 'new-uuid', ...dto, isActive: true, createdAt: new Date(), updatedAt: new Date() };
      prisma.airport.create.mockResolvedValue(createdAirport);

      const result = await service.create(dto);

      expect(result).toEqual(createdAirport);
      expect(prisma.airport.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('update', () => {
    it('should update and return the airport', async () => {
      const dto = { name: 'Updated Airport Name' };
      const updatedAirport = { ...mockAirport, name: 'Updated Airport Name' };

      prisma.airport.findUnique.mockResolvedValue(mockAirport);
      prisma.airport.update.mockResolvedValue(updatedAirport);

      const result = await service.update('airport-uuid-1', dto);

      expect(result).toEqual(updatedAirport);
      expect(prisma.airport.update).toHaveBeenCalledWith({
        where: { id: 'airport-uuid-1' },
        data: dto,
      });
    });

    it('should throw NotFoundException when updating non-existent airport', async () => {
      prisma.airport.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
