import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /**
   * Lightweight liveness check.
   * Returns 200 if the process is alive and memory is under 300 MB heap threshold.
   */
  @Get('liveness')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe (memory check)' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  liveness() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024)]);
  }

  /**
   * Full readiness check with database and Redis dependency verification.
   * Returns 200 when all dependencies reachable, 503 when any fails.
   */
  @Get('readiness')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (database + Redis)' })
  @ApiResponse({ status: 200, description: 'All dependencies are reachable' })
  @ApiResponse({ status: 503, description: 'One or more dependencies are unreachable' })
  readiness() {
    return this.health.check([
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' as const } };
        } catch (error) {
          return {
            database: {
              status: 'down' as const,
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
