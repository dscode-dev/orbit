import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { generateUuidV7 } from '../utils';

interface RequestWithId extends Request {
  id?: string;
}

/** Establishes correlation before guards execute. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incoming = request.header('x-request-id')?.trim();
    request.id ??=
      incoming && incoming.length <= 128 ? incoming : generateUuidV7();
    response.setHeader('x-request-id', request.id);
    next();
  }
}
