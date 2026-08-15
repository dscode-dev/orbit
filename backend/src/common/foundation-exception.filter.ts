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

  /**
   * Lido a cada uso, não na construção.
   *
   * O filtro é instanciado uma vez por aplicação, e em processo de teste isso
   * acontece antes de a variável estar no lugar. Ler aqui custa um acesso a
   * `process.env` por recusa — e recusa não é caminho quente.
   */
  private get logsClientErrors(): boolean {
    return (process.env.LOG_CLIENT_ERRORS ?? '').trim() === 'true';
  }

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
    } else if (status >= 400 && this.logsClientErrors) {
      /**
       * Recusa de cliente, registrada sob demanda.
       *
       * Desligado por padrão: 4xx é conversa normal com o cliente e encheria o
       * log. Ligado, é o que permite explicar um 404 que não deveria existir —
       * a investigação da PR-26.6.1 dependeu exatamente disto, porque status
       * sem mensagem não distingue "não existe" de "não vejo".
       */
      this.logger.warn(
        JSON.stringify({
          stage: 'client-error',
          status,
          method: request.method,
          path: request.path,
          code: 'code' in payload ? payload.code : null,
          message: 'message' in payload ? payload.message : null,
          requestId: request.id ?? null,
        }),
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
