import { Injectable } from '@nestjs/common';
import { InfrastructureException } from '../exceptions';
import { RequestContext } from './request-context';
import { RequestContextStorage } from './request-context.storage';

@Injectable()
export class RequestContextService {
  constructor(private readonly storage: RequestContextStorage) {}

  get(): RequestContext {
    const context = this.storage.get();
    if (!context) {
      throw new InfrastructureException('Request context is not available');
    }
    return context;
  }

  getOptional(): RequestContext | undefined {
    return this.storage.get();
  }
}
