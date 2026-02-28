import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Security: HTTP headers
  app.use(helmet());

  // CORS
  app.enableCors();

  // Global validation pipe: whitelist strips unknown props, transform enables auto-conversion
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global guards: JWT auth (skips @Public) + Roles (checks @Roles)
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector),
  );

  // Global exception filter for Prisma errors
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Airport Revenue API running on http://localhost:${port}/api/v1`);
}

bootstrap();
