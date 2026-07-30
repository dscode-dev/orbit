import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { BaseException } from '../exceptions';

interface RequestWithId extends Request {
  id?: string;
}

@Catch()
export class FoundationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(FoundationExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithId>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof BaseException
        ? {
            code: exception.code,
            message: exception.message,
            details: exception.details,
          }
        : exception instanceof HttpException
          ? this.httpPayload(exception)
          : {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'An unexpected error occurred',
            };
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    response.status(status).json({
      success: false,
      error: payload,
      requestId: request.id ?? 'unknown',
      timestamp: new Date().toISOString(),
    });
  }

  private httpPayload(exception: HttpException): {
    code: string;
    message: string | string[];
  } {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { code: 'HTTP_ERROR', message: response };
    }
    const message = 'message' in response ? response.message : undefined;
    return {
      code: 'HTTP_ERROR',
      message:
        typeof message === 'string' ||
        (Array.isArray(message) &&
          message.every((item) => typeof item === 'string'))
          ? message
          : exception.message,
    };
  }
}
