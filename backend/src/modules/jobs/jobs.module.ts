/**
 * Infraestrutura de jobs.
 *
 * Global porque a fila é transversal: qualquer módulo que precise de trabalho
 * assíncrono injeta `BackgroundJobQueue`. Os processadores são registrados por
 * quem os implementa, via `JOB_PROCESSOR`.
 */
import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { RequestContextModule } from '../../context';
import { BackgroundJobQueue } from './background-job.queue';

@Global()
@Module({
  imports: [PrismaModule, RequestContextModule],
  providers: [BackgroundJobQueue],
  exports: [BackgroundJobQueue],
})
export class JobsModule {}
