import { Inject, Injectable, Logger } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  /**
   * Ping Redis and return health status.
   * Returns healthy if PONG received, unhealthy otherwise.
   */
  async pingCheck(key = 'redis'): Promise<HealthIndicatorResult> {
    try {
      const result = await this.redis.ping();
      if (result === 'PONG') {
        return this.getStatus(key, true);
      }
      throw new HealthCheckError('Redis ping did not return PONG', this.getStatus(key, false));
    } catch (error) {
      if (error instanceof HealthCheckError) throw error;
      this.logger.warn(
        `Redis health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HealthCheckError(
        'Redis is not available',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
