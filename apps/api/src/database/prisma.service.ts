import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

/** Tenant-scoped models that receive automatic tenantId filtering. */
const TENANT_SCOPED_MODELS = ['Contract', 'Obligation', 'Declaration', 'InvoiceLog'];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly cls: ClsService) {
    super();

    // Middleware: auto-filter tenant-scoped models when tenantId is in CLS context
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      const tenantId = this.cls.get('tenantId') as string | undefined;

      if (tenantId && params.model && TENANT_SCOPED_MODELS.includes(params.model)) {
        // Inject tenantId filter for read operations
        if (params.action === 'findMany' || params.action === 'findFirst') {
          params.args = params.args || {};
          params.args.where = { ...params.args.where, tenantId };
        }

        // Inject tenantId for create operations
        if (params.action === 'create') {
          params.args = params.args || {};
          params.args.data = { ...params.args.data, tenantId };
        }
      }

      return next(params);
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
  }
}
