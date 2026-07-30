import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { RequestContextStorage } from './request-context.storage';

@Global()
@Module({
  providers: [RequestContextStorage, RequestContextService],
  exports: [RequestContextStorage, RequestContextService],
})
export class RequestContextModule {}
