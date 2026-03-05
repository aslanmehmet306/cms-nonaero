import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  development = 'development',
  production = 'production',
  test = 'test',
}

const PLACEHOLDER_SECRETS = ['your_secret_here_change_me', 'changeme', 'secret', 'placeholder'];

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRATION: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '7d';

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty({ message: 'REDIS_URL is required' })
  REDIS_URL!: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.development;

  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  // Reject placeholder JWT secrets
  if (validatedConfig.JWT_SECRET) {
    const lowerSecret = validatedConfig.JWT_SECRET.toLowerCase();
    for (const placeholder of PLACEHOLDER_SECRETS) {
      if (lowerSecret.includes(placeholder)) {
        throw new Error(
          `JWT_SECRET contains a placeholder value ("${placeholder}"). Set a real secret.`,
        );
      }
    }
  }

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => Object.values(err.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}
