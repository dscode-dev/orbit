import {
  Inject,
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { PRISMA_CLIENT } from '../providers';
import type {
  PrismaClientContract,
  PrismaTransactionClient,
} from './prisma.types';

@Injectable()
export class PrismaService implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly client: PrismaClientContract,
  ) {}

  onModuleInit(): Promise<void> {
    return this.client.$connect();
  }

  onApplicationShutdown(): Promise<void> {
    return this.client.$disconnect();
  }

  transaction<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(work);
  }
}
