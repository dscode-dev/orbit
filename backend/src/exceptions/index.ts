import { HttpException, HttpStatus } from '@nestjs/common';
import type { JSONObject } from '../contracts';

export interface ExceptionPayload {
  code: string;
  message: string;
  details?: JSONObject;
}

export class BaseException extends HttpException {
  readonly code: string;
  readonly details?: JSONObject;

  constructor(payload: ExceptionPayload, status: HttpStatus) {
    super(payload, status);
    this.code = payload.code;
    this.details = payload.details;
  }
}

export class BusinessException extends BaseException {
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION') {
    super({ code, message }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class EntityNotFoundException extends BaseException {
  constructor(entity: string, identifier?: string) {
    super(
      {
        code: 'ENTITY_NOT_FOUND',
        message: identifier
          ? `${entity} with identifier ${identifier} was not found`
          : `${entity} was not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ConflictException extends BaseException {
  constructor(message: string, code = 'CONFLICT') {
    super({ code, message }, HttpStatus.CONFLICT);
  }
}

export class ValidationException extends BaseException {
  constructor(message: string, details?: JSONObject) {
    super(
      { code: 'VALIDATION_ERROR', message, details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ForbiddenException extends BaseException {
  constructor(message = 'Access denied') {
    super({ code: 'FORBIDDEN', message }, HttpStatus.FORBIDDEN);
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message = 'Authentication is required') {
    super({ code: 'UNAUTHORIZED', message }, HttpStatus.UNAUTHORIZED);
  }
}

export class InfrastructureException extends BaseException {
  constructor(message = 'Infrastructure operation failed') {
    super(
      { code: 'INFRASTRUCTURE_ERROR', message },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
