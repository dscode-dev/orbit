import {
  BadRequestException,
  ForbiddenException as NestForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ConflictException,
  EntityNotFoundException,
  RateLimitException,
} from '../../exceptions';
import { PublicErrorMapper } from './public-error.mapper';

describe('PublicErrorMapper', () => {
  const mapper = new PublicErrorMapper();

  it('maps ValidationPipe messages to safe field issues', () => {
    const result = mapper.map(
      new BadRequestException([
        'email must be an email',
        'property passwordHash should not exist',
      ]),
    );
    expect(result).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Revise os campos informados.',
      status: 400,
      details: [
        {
          field: 'email',
          code: 'INVALID_FORMAT',
          message: 'Informe um e-mail válido.',
        },
        {
          field: 'passwordHash',
          code: 'UNKNOWN_FIELD',
          message: 'Este campo não é aceito.',
        },
      ],
    });
  });

  it('does not expose identifiers from hidden absence errors', () => {
    const result = mapper.map(
      new EntityNotFoundException('Customer', '019-secret-id'),
    );
    expect(result).toMatchObject({
      code: 'ENTITY_NOT_FOUND',
      message: 'O recurso solicitado não foi encontrado.',
      status: 404,
    });
    expect(JSON.stringify(result)).not.toContain('019-secret-id');
  });

  it('maps registered domain codes without exposing their internal messages', () => {
    const result = mapper.map(
      new ConflictException(
        'Customer document is already registered; Prisma P2002',
        'CUSTOMER_DOCUMENT_ALREADY_EXISTS',
      ),
    );
    expect(result).toMatchObject({
      code: 'CUSTOMER_DOCUMENT_ALREADY_EXISTS',
      message: 'Já existe um cliente cadastrado com este CPF ou CNPJ.',
      status: 409,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Prisma|P2002|Customer document/,
    );
  });

  it('falls back by HTTP semantics for an unregistered application code', () => {
    expect(
      mapper.map(new ConflictException('internal detail', 'UNREGISTERED')),
    ).toMatchObject({ code: 'CONFLICT', status: 409 });
  });

  it('preserves bounded retry metadata and no implementation detail', () => {
    expect(mapper.map(new RateLimitException(45))).toEqual({
      code: 'RATE_LIMITED',
      message: 'Muitas tentativas. Aguarde e tente novamente.',
      status: 429,
      details: { retryAfterSeconds: 45 },
    });
  });

  it('maps built-in authorization and infrastructure errors safely', () => {
    expect(
      mapper.map(
        new NestForbiddenException('Missing capability operations.manage'),
      ),
    ).toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(
      mapper.map(
        new ServiceUnavailableException('PostgreSQL connection refused'),
      ),
    ).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'O serviço está temporariamente indisponível. Tente novamente.',
      status: 503,
    });
  });

  it('maps unexpected errors to a safe fallback', () => {
    const result = mapper.map(
      new Error('Prisma P2002 SQL constraint stack node_modules/postgres'),
    );
    expect(result).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Não foi possível concluir a solicitação.',
      status: 500,
    });
  });
});
