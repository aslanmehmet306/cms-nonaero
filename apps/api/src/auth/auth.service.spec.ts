import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock }; tenant: { findUnique: jest.Mock } };
  let jwtService: { signAsync: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  const mockAdminUser = {
    id: 'user-1',
    email: 'admin@airport.com',
    passwordHash: '$2b$10$hashedpassword',
    name: 'Admin User',
    role: 'super_admin',
    airportId: 'airport-1',
    tenantId: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn(),
    };

    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('adminLogin', () => {
    it('should return tokens for valid admin credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockAdminUser);
      prisma.user.update.mockResolvedValue(mockAdminUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      jwtService.signAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456');

      const result = await service.adminLogin('admin@airport.com', 'password123');

      expect(result).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 900,
        user: {
          sub: 'user-1',
          email: 'admin@airport.com',
          role: 'super_admin',
          airportId: 'airport-1',
          tenantId: undefined,
        },
      });
      expect(redis.set).toHaveBeenCalledWith(
        'refresh:user-1',
        'hashed-refresh-token',
        'EX',
        604800,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockAdminUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.adminLogin('admin@airport.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.adminLogin('nonexistent@airport.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should generate new token pair (rotation)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockAdminUser);
      redis.get.mockResolvedValue('stored-hash');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-refresh');
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens('user-1', 'old-refresh-token');

      expect(result.access_token).toBe('new-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');
      // Verify old token was replaced with new hash in Redis
      expect(redis.set).toHaveBeenCalledWith(
        'refresh:user-1',
        'new-hashed-refresh',
        'EX',
        604800,
      );
    });
  });

  describe('logout', () => {
    it('should invalidate refresh token in Redis', async () => {
      redis.del.mockResolvedValue(1);

      await service.logout('user-1');

      expect(redis.del).toHaveBeenCalledWith('refresh:user-1');
    });
  });
});
