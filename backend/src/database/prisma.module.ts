import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from '@nestjs/common';
import { PRISMA_CLIENT } from '../providers';
import { PrismaService } from './prisma.service';
import type { PrismaClientContract } from './prisma.types';
import { RlsContextProvider } from './rls/rls-context.provider';
import { RlsPrismaExtension, RlsTransaction } from './rls/rls-transaction';
import { TransactionManager } from './transaction-manager';

@Global()
@Module({})
export class PrismaModule {
  static forRoot(client: PrismaClientContract): DynamicModule {
    const clientProvider: Provider = {
      provide: PRISMA_CLIENT,
      useValue: client,
    };
    const foundationProviders: Provider[] = [
      PrismaService,
      RlsContextProvider,
      RlsTransaction,
      RlsPrismaExtension,
      TransactionManager,
    ];
    return {
      module: PrismaModule,
      providers: [clientProvider, ...foundationProviders],
      exports: foundationProviders,
    };
  }
}
