import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Global exception filter that converts Prisma client errors to proper HTTP responses.
 *
 * Mappings:
 * - P2002 (unique constraint violation) -> 409 Conflict
 * - P2025 (record not found)           -> 404 Not Found
 * - P2003 (foreign key constraint)     -> 400 Bad Request
 * - Default                            -> 500 Internal Server Error
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[]) || [];
        message = `Unique constraint violation on field(s): ${target.join(', ')}`;
        break;
      }
      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      }
      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        const field = (exception.meta?.field_name as string) || 'unknown';
        message = `Foreign key constraint failed on field: ${field}`;
        break;
      }
      default: {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Internal server error';
        this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status] || 'Error',
    });
  }
}
