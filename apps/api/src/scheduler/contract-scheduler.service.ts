import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { ContractStatus } from '@shared-types/enums';

@Injectable()
export class ContractSchedulerService {
  private readonly logger = new Logger(ContractSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Daily cron at 02:00 Istanbul time.
   * Runs contract lifecycle transitions:
   * 1. Activates published contracts whose effective date has arrived and are signed
   * 2. Flips pending amendments: old active -> amended, pending_amendment -> active
   */
  @Cron('0 2 * * *', { name: 'contract-lifecycle', timeZone: 'Europe/Istanbul' })
  async handleContractLifecycle(): Promise<void> {
    this.logger.log('Running contract lifecycle cron...');
    const activated = await this.activatePublishedContracts();
    const flipped = await this.flipAmendments();
    this.logger.log(
      `Contract lifecycle cron completed: ${activated} activated, ${flipped} amendments flipped`,
    );
  }

  /**
   * Activate published contracts:
   * - status = published
   * - signedAt is not null (contract has been signed)
   * - effectiveFrom <= today (effective date has arrived)
   *
   * Returns count of activated contracts.
   */
  async activatePublishedContracts(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toActivate = await this.prisma.contract.findMany({
      where: {
        status: ContractStatus.published,
        signedAt: { not: null },
        effectiveFrom: { lte: today },
      },
    });

    for (const contract of toActivate) {
      await this.prisma.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.active },
      });
      this.logger.log(
        `Activated contract ${contract.contractNumber} v${contract.version}`,
      );
    }

    return toActivate.length;
  }

  /**
   * Flip amendment versions atomically:
   * - Find pending_amendment contracts whose effectiveFrom has arrived
   * - For each: atomically set old active version -> amended, pending_amendment -> active
   *
   * Returns count of amendment flips attempted.
   */
  async flipAmendments(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingAmendments = await this.prisma.contract.findMany({
      where: {
        status: ContractStatus.pending_amendment,
        effectiveFrom: { lte: today },
      },
    });

    for (const amendment of pendingAmendments) {
      if (!amendment.previousVersionId) {
        this.logger.warn(
          `Pending amendment ${amendment.id} has no previousVersionId — skipping`,
        );
        continue;
      }

      // Atomic swap: old active -> amended, pending_amendment -> active
      await this.prisma.$transaction([
        this.prisma.contract.update({
          where: { id: amendment.previousVersionId },
          data: { status: ContractStatus.amended },
        }),
        this.prisma.contract.update({
          where: { id: amendment.id },
          data: { status: ContractStatus.active },
        }),
      ]);

      this.logger.log(
        `Flipped amendment: ${amendment.contractNumber} v${amendment.version} is now active`,
      );
    }

    return pendingAmendments.length;
  }
}
