import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { TenantStatus } from '@shared-types/enums';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not configured — Stripe customer creation will be skipped. ' +
          'Set STRIPE_SECRET_KEY to enable automatic Stripe customer creation for new tenants.',
      );
      this.stripe = null;
    }
  }

  /**
   * Generate the next sequential tenant code for a given airport.
   * Format: TNT-001, TNT-002, ..., TNT-999, TNT-1000, ...
   * Finds the highest existing code for the airport and increments by 1.
   */
  async generateNextTenantCode(airportId: string): Promise<string> {
    const lastTenant = await this.prisma.tenant.findFirst({
      where: { airportId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    if (!lastTenant) {
      return 'TNT-001';
    }

    // Extract number from code like "TNT-003" → 3
    const match = lastTenant.code.match(/^TNT-(\d+)$/);
    if (!match) {
      // Fallback if code format is unexpected
      return 'TNT-001';
    }

    const nextNumber = parseInt(match[1], 10) + 1;
    return `TNT-${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Create a new tenant with auto-generated code and Stripe customer.
   * If Stripe is not configured, stripeCustomerId is stored as null.
   */
  async create(dto: CreateTenantDto) {
    const code = await this.generateNextTenantCode(dto.airportId);

    let stripeCustomerId: string | null = null;

    if (this.stripe) {
      try {
        const customer = await this.stripe.customers.create(
          {
            email: dto.email,
            name: dto.name,
            metadata: {
              tenantCode: code,
              airportId: dto.airportId,
            },
          },
          {
            idempotencyKey: uuidv4(),
          },
        );
        stripeCustomerId = customer.id;
      } catch (err) {
        this.logger.error(
          `Failed to create Stripe customer for tenant ${code}: ${(err as Error).message}`,
        );
        // Roll back: do not create tenant without a Stripe customer
        // Per R2.3 — each tenant must map to a Stripe customer
        throw err;
      }
    }

    return this.prisma.tenant.create({
      data: {
        airportId: dto.airportId,
        code,
        name: dto.name,
        taxId: dto.taxId,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        stripeCustomerId,
      },
    });
  }

  /**
   * List tenants for an airport with optional status filter and pagination.
   */
  async findAll(airportId: string, status?: TenantStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where = {
      airportId,
      ...(status ? { status } : {}),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single tenant by ID.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    return tenant;
  }

  /**
   * Update mutable tenant fields (name, email, phone, address).
   * Immutable: airportId, code, taxId, stripeCustomerId.
   */
  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
      },
    });
  }

  /**
   * Update tenant status. All transitions are fully reversible:
   * active <-> suspended <-> deactivated (any direction).
   *
   * TODO (Phase 3+): Cascade status to contracts/obligations.
   * Suspending a tenant should suspend all active contracts and put pending obligations on_hold.
   * Reactivating should reverse the cascade.
   */
  async updateStatus(id: string, status: TenantStatus) {
    await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status },
    });

    this.logger.log(
      `Tenant ${id} (${updated.code}) status changed to ${status}`,
    );

    return updated;
  }
}
