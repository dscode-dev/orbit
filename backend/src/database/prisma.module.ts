import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RlsContextProvider } from './rls/rls-context.provider';
import { RlsPrismaExtension, RlsTransaction } from './rls/rls-transaction';
import { TransactionManager } from './transaction-manager';

@Global()
@Module({
  providers: [
    PrismaService,
    RlsContextProvider,
    RlsTransaction,
    RlsPrismaExtension,
    TransactionManager,
  ],
  exports: [
    PrismaService,
    RlsContextProvider,
    RlsTransaction,
    RlsPrismaExtension,
    TransactionManager,
  ],
})
export class PrismaModule {}
