import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PolicyStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateBillingPolicyDto } from './dto/create-billing-policy.dto';
import { UpdateBillingPolicyDto } from './dto/update-billing-policy.dto';

@Injectable()
export class BillingPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a billing policy with status=draft.
   */
  async create(dto: CreateBillingPolicyDto) {
    return this.prisma.billingPolicy.create({
      data: {
        airportId: dto.airportId,
        cutOffDay: dto.cutOffDay,
        issueDay: dto.issueDay,
        dueDateDays: dto.dueDateDays ?? 30,
        leadDays: dto.leadDays ?? 5,
        gracePeriodDays: dto.gracePeriodDays ?? 0,
        declarationReminderDays: dto.declarationReminderDays ?? 3,
        fiscalYearStartMonth: dto.fiscalYearStartMonth ?? 1,
        effectiveFrom: new Date(dto.effectiveFrom),
        status: PolicyStatus.draft,
      },
    });
  }

  /**
   * List all billing policies for an airport, ordered by version desc.
   */
  async findAll(airportId: string) {
    return this.prisma.billingPolicy.findMany({
      where: { airportId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Get the currently active billing policy for an airport.
   */
  async findActive(airportId: string) {
    return this.prisma.billingPolicy.findFirst({
      where: { airportId, status: PolicyStatus.active },
    });
  }

  /**
   * Get a single billing policy by ID.
   */
  async findOne(id: string) {
    const policy = await this.prisma.billingPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException(`Billing policy ${id} not found`);
    }

    return policy;
  }

  /**
   * Update a draft or approved billing policy.
   * Active and archived policies cannot be updated.
   */
  async update(id: string, dto: UpdateBillingPolicyDto) {
    const policy = await this.findOne(id);

    if (
      policy.status === PolicyStatus.active ||
      policy.status === PolicyStatus.archived
    ) {
      throw new BadRequestException(
        `Cannot update a policy with status '${policy.status}'. Only draft or approved policies can be updated.`,
      );
    }

    return this.prisma.billingPolicy.update({
      where: { id },
      data: {
        ...(dto.cutOffDay !== undefined ? { cutOffDay: dto.cutOffDay } : {}),
        ...(dto.issueDay !== undefined ? { issueDay: dto.issueDay } : {}),
        ...(dto.dueDateDays !== undefined ? { dueDateDays: dto.dueDateDays } : {}),
        ...(dto.leadDays !== undefined ? { leadDays: dto.leadDays } : {}),
        ...(dto.gracePeriodDays !== undefined ? { gracePeriodDays: dto.gracePeriodDays } : {}),
        ...(dto.declarationReminderDays !== undefined
          ? { declarationReminderDays: dto.declarationReminderDays }
          : {}),
        ...(dto.fiscalYearStartMonth !== undefined
          ? { fiscalYearStartMonth: dto.fiscalYearStartMonth }
          : {}),
        ...(dto.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(dto.effectiveFrom) }
          : {}),
      },
    });
  }

  /**
   * Approve a billing policy.
   */
  async approve(id: string, approvedBy: string) {
    await this.findOne(id);

    return this.prisma.billingPolicy.update({
      where: { id },
      data: {
        status: PolicyStatus.approved,
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Activate a billing policy.
   * Archives any previously active policy for the same airport atomically.
   */
  async activate(id: string) {
    const policy = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // Archive any existing active policy for this airport
      await tx.billingPolicy.updateMany({
        where: {
          airportId: policy.airportId,
          status: PolicyStatus.active,
          id: { not: id },
        },
        data: { status: PolicyStatus.archived },
      });

      // Activate this policy
      return tx.billingPolicy.update({
        where: { id },
        data: { status: PolicyStatus.active },
      });
    });
  }
}
