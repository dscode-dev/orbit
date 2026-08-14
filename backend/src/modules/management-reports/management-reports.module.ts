/**
 * Composição do Management Reports Engine.
 *
 * ## O que este módulo importa, e por quê
 *
 * `FinancialModule`, `InventoryModule` e `PmocModule` porque os providers
 * **chamam os serviços deles** — é a forma de não recalcular o que já tem dono. A
 * dependência é explícita e de leitura: Reports conhece Financeiro; Financeiro
 * não sabe que Reports existe.
 *
 * `ArtifactRenderingModule` pelo registry de renderizadores — o mesmo
 * `pdf.default` que desenha os documentos de campo desenha os relatórios.
 * Nenhum motor de PDF novo entra aqui.
 *
 * `StorageModule` pelo arquivo emitido: mesmo bucket, mesmo SHA-256, mesmas
 * URLs assinadas e expiráveis.
 *
 * ## O que ele não importa
 *
 * O módulo `reports` legado. São coisas diferentes com nomes parecidos — o
 * relatório de visita pertence a uma operação e é assinado; o gerencial é um
 * retrato agregado e não é declaração de ninguém.
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ArtifactRenderingModule } from '../artifact-rendering/artifact-rendering.module';
import { FinancialModule } from '../financial/financial.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PmocModule } from '../pmoc/pmoc.module';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { CommercialReportProvider } from './providers/commercial.provider';
import { DocumentsReportProvider } from './providers/documents.provider';
import { FinancialReportProvider } from './providers/financial.provider';
import { InventoryReportProvider } from './providers/inventory.provider';
import { OperationsReportProvider } from './providers/operations.provider';
import { SchedulingReportProvider } from './providers/scheduling.provider';
import { WorkforceReportProvider } from './providers/workforce.provider';
import { ReportComposer } from './report.composer';
import { ManagementReportController } from './report.controller';
import { ReportGenerationProcessor } from './report-generation.processor';
import { ReportMapper } from './report.mapper';
import { ReportRenderAdapter } from './report.render-adapter';
import { ReportRepository } from './report.repository';
import { ReportService } from './report.service';

@Module({
  imports: [
    PrismaModule,
    SubscriptionPlansModule,
    StorageModule,
    ArtifactRenderingModule,
    FinancialModule,
    InventoryModule,
    PmocModule,
  ],
  controllers: [ManagementReportController],
  providers: [
    ReportRepository,
    ReportMapper,
    ReportComposer,
    ReportRenderAdapter,
    ReportService,
    ReportGenerationProcessor,
    OperationsReportProvider,
    SchedulingReportProvider,
    FinancialReportProvider,
    CommercialReportProvider,
    InventoryReportProvider,
    DocumentsReportProvider,
    WorkforceReportProvider,
  ],
  exports: [ReportService],
})
export class ManagementReportsModule {}
