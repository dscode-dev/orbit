import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RequestContextModule } from '../context';
import { AuthenticationGuard, PermissionGuard, RoleGuard } from '../guards';
import {
  LoggingInterceptor,
  RequestContextInterceptor,
  RequestIdInterceptor,
  ResponseInterceptor,
} from '../interceptors';
import { CommonProvidersModule } from '../providers';
import { IsJsonObjectConstraint } from '../validators';
import { FoundationExceptionFilter } from './foundation-exception.filter';

@Global()
@Module({
  imports: [RequestContextModule, CommonProvidersModule],
  providers: [
    IsJsonObjectConstraint,
    { provide: APP_FILTER, useClass: FoundationExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
  exports: [RequestContextModule, CommonProvidersModule],
})
export class FoundationModule {}
