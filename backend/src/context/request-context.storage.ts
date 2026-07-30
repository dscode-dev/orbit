import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestContext } from './request-context';

@Injectable()
export class RequestContextStorage {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }
}
