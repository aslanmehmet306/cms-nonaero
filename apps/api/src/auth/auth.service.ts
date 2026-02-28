import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { UserRole } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { AuthResponseDto } from './dto/auth-response.dto';

/** Admin roles that can login via /auth/admin/login */
const ADMIN_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.airport_admin,
  UserRole.commercial_manager,
  UserRole.finance,
  UserRole.auditor,
];

/** Tenant roles that can login via /auth/tenant/login */
const TENANT_ROLES: UserRole[] = [UserRole.tenant_admin, UserRole.tenant_user];

/** bcrypt work factor */
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Admin login: validates email/password and role is admin-tier.
   */
  async adminLogin(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!ADMIN_ROLES.includes(user.role as UserRole)) {
      throw new UnauthorizedException('Not authorized for admin login');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  /**
   * Tenant login: validates email/password, tenant code, and role is tenant-tier.
   */
  async tenantLogin(
    email: string,
    password: string,
    tenantCode: string,
  ): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!TENANT_ROLES.includes(user.role as UserRole)) {
      throw new UnauthorizedException('Not authorized for tenant login');
    }

    // Verify tenant code matches user's tenant
    if (!user.tenantId) {
      throw new UnauthorizedException('User is not associated with a tenant');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant || tenant.code !== tenantCode || tenant.status !== 'active') {
      throw new UnauthorizedException('Invalid tenant code or tenant is inactive');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  /**
   * Refresh tokens: validates existing refresh token, issues new pair (rotation).
   */
  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Verify refresh token exists in Redis
    const storedHash = await this.redis.get(`refresh:${userId}`);
    if (!storedHash) {
      throw new UnauthorizedException('Refresh token not found — please login again');
    }

    const tokenValid = await bcrypt.compare(refreshToken, storedHash);
    if (!tokenValid) {
      // Possible token reuse attack — invalidate all tokens for this user
      await this.redis.del(`refresh:${userId}`);
      this.logger.warn(`Possible refresh token reuse detected for user ${userId}`);
      throw new UnauthorizedException('Invalid refresh token — all sessions revoked');
    }

    return this.generateTokens(user);
  }

  /**
   * Logout: invalidate refresh token from Redis.
   */
  async logout(userId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}`);
    this.logger.log(`User ${userId} logged out`);
  }

  /**
   * Generate access and refresh JWT tokens, store refresh hash in Redis.
   */
  async generateTokens(user: {
    id: string;
    email: string;
    role: string;
    airportId?: string | null;
    tenantId?: string | null;
  }): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      airportId: user.airportId || undefined,
      tenantId: user.tenantId || undefined,
    };

    const isAdmin = ADMIN_ROLES.includes(user.role as UserRole);
    const accessExpiration = isAdmin ? '15m' : '30m';
    const refreshExpiration = isAdmin ? '7d' : '30d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessExpiration,
      }),
      this.jwtService.signAsync(
        { sub: user.id },
        {
          expiresIn: refreshExpiration,
        },
      ),
    ]);

    // Store hashed refresh token in Redis with matching TTL
    const refreshHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const ttlSeconds = isAdmin ? 7 * 24 * 60 * 60 : 30 * 24 * 60 * 60;
    await this.redis.set(`refresh:${user.id}`, refreshHash, 'EX', ttlSeconds);

    // Parse access expiration to seconds for response
    const expiresIn = isAdmin ? 900 : 1800; // 15min or 30min in seconds

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      user: {
        sub: user.id,
        email: user.email,
        role: user.role,
        airportId: user.airportId || undefined,
        tenantId: user.tenantId || undefined,
      },
    };
  }

  /**
   * Hash a password with bcrypt (used by UsersService for user creation).
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}
