import { Prisma } from '@prisma/client';

export type InternalErrorCategory =
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_TIMEOUT'
  | 'TRANSACTION_FAILURE'
  | 'CONNECTION_FAILURE'
  | 'INTERNAL_ERROR';

export interface ClassifiedInternalError {
  category: InternalErrorCategory;
  exceptionClass: string;
  code: string | null;
}

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  '57P01',
  '57P02',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
]);
const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'P1008', 'P2024']);
const TRANSACTION_CODES = new Set([
  'P2028',
  '25P01',
  '25P02',
  '40001',
  '40P01',
]);

const errorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
};

const messages = (error: unknown): string => {
  const visited = new Set<unknown>();
  const parts: string[] = [];
  let current = error;
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current instanceof Error) parts.push(current.message);
    if (typeof current === 'object' && 'cause' in current) {
      current = current.cause;
    } else {
      break;
    }
  }
  return parts.join(' ').toLowerCase();
};

export const classifyInternalError = (
  error: unknown,
): ClassifiedInternalError => {
  const code = errorCode(error);
  const message = messages(error);
  const exceptionClass =
    error instanceof Error ? error.constructor.name : typeof error;
  const declared =
    error &&
    typeof error === 'object' &&
    'internalCategory' in error &&
    typeof error.internalCategory === 'string'
      ? error.internalCategory
      : null;
  if (
    declared &&
    [
      'DATABASE_UNAVAILABLE',
      'DATABASE_TIMEOUT',
      'TRANSACTION_FAILURE',
      'CONNECTION_FAILURE',
      'INTERNAL_ERROR',
    ].includes(declared)
  ) {
    return {
      category: declared as InternalErrorCategory,
      exceptionClass,
      code,
    };
  }

  if (
    code === 'P1001' ||
    code === 'P1002' ||
    error instanceof Prisma.PrismaClientInitializationError ||
    message.includes("can't reach database server") ||
    message.includes('database system is starting up') ||
    message.includes('database unavailable')
  ) {
    return { category: 'DATABASE_UNAVAILABLE', exceptionClass, code };
  }
  if (
    (code && TIMEOUT_CODES.has(code)) ||
    message.includes('pool timeout') ||
    message.includes('timed out fetching a new connection') ||
    message.includes('timeout expired') ||
    message.includes('acquisition timeout')
  ) {
    return { category: 'DATABASE_TIMEOUT', exceptionClass, code };
  }
  if (
    (code && TRANSACTION_CODES.has(code)) ||
    message.includes('expired transaction') ||
    message.includes('transaction api error') ||
    message.includes('transaction is closed')
  ) {
    return { category: 'TRANSACTION_FAILURE', exceptionClass, code };
  }
  if (
    (code && CONNECTION_CODES.has(code)) ||
    message.includes('socket hang up') ||
    message.includes('connection terminated') ||
    message.includes('connection reset') ||
    message.includes('connection closed') ||
    message.includes('broken pipe')
  ) {
    return { category: 'CONNECTION_FAILURE', exceptionClass, code };
  }
  return { category: 'INTERNAL_ERROR', exceptionClass, code };
};

export const isInfrastructureError = (error: unknown): boolean =>
  classifyInternalError(error).category !== 'INTERNAL_ERROR' ||
  error instanceof Prisma.PrismaClientKnownRequestError ||
  error instanceof Prisma.PrismaClientUnknownRequestError ||
  error instanceof Prisma.PrismaClientRustPanicError;

export const isJwtValidationError = (error: unknown): boolean =>
  error instanceof Error &&
  ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(
    error.name,
  );

/** Stack interna completa, incluindo `cause`; nunca deve entrar na resposta. */
export const internalErrorStack = (error: unknown): string | undefined => {
  const stacks: string[] = [];
  const visited = new Set<unknown>();
  let current = error;
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current instanceof Error) stacks.push(current.stack ?? current.message);
    current =
      typeof current === 'object' && 'cause' in current
        ? current.cause
        : undefined;
  }
  return stacks.length > 0 ? stacks.join('\nCaused by:\n') : undefined;
};
