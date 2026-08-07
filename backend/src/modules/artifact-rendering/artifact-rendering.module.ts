/**
 * Composição do Rendering Engine.
 *
 * Os renderers entram por `ARTIFACT_RENDERER` como um array de providers — é o
 * único lugar que os conhece. Acrescentar um motor (`pdf.chromium`, `docx`) é
 * escrever a classe e somá-la aqui; registry, pipeline, manifest e API não
 * mudam.
 *
 * O worker é registrado neste módulo, com o processador de renderização. Se
 * outra fila surgir, ela traz o seu processador e o worker os percorre.
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { RequestContextModule } from '../../context';
import { ArtifactManifestModule } from '../artifact-manifests/artifact-manifest.module';
import { ArtifactManifestPolicy } from '../artifact-manifests/artifact-manifest.policy';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { BackgroundJobWorker } from '../jobs/background-job.worker';
import { JOB_PROCESSOR } from '../jobs/background-job.types';
import { ArtifactRenderAssembler } from './artifact-render.assembler';
import { ArtifactRenderController } from './artifact-render.controller';
import { ArtifactRenderMetrics } from './artifact-render.metrics';
import { ArtifactRenderProcessor } from './artifact-render.processor';
import { ArtifactRenderRepository } from './artifact-render.repository';
import { ArtifactRenderService } from './artifact-render.service';
import { ARTIFACT_RENDERER } from './renderers/artifact-renderer';
import { ArtifactRendererRegistry } from './renderers/renderer.registry';
import { ArtifactHtmlRenderer } from './renderers/html/artifact-html.renderer';
import { ArtifactPdfRenderer } from './renderers/pdf/artifact-pdf.renderer';

@Module({
  imports: [
    PrismaModule,
    RequestContextModule,
    SubscriptionPlansModule,
    ArtifactManifestModule,
  ],
  controllers: [ArtifactRenderController],
  providers: [
    ArtifactHtmlRenderer,
    ArtifactPdfRenderer,
    {
      provide: ARTIFACT_RENDERER,
      inject: [ArtifactHtmlRenderer, ArtifactPdfRenderer],
      useFactory: (html: ArtifactHtmlRenderer, pdf: ArtifactPdfRenderer) => [
        html,
        pdf,
      ],
    },
    ArtifactRendererRegistry,
    ArtifactRenderAssembler,
    ArtifactRenderRepository,
    ArtifactRenderMetrics,
    ArtifactRenderService,
    ArtifactRenderProcessor,
    ArtifactManifestPolicy,
    {
      provide: JOB_PROCESSOR,
      inject: [ArtifactRenderProcessor],
      useFactory: (render: ArtifactRenderProcessor) => [render],
    },
    BackgroundJobWorker,
  ],
  exports: [
    ArtifactRenderService,
    ArtifactRendererRegistry,
    BackgroundJobWorker,
  ],
})
export class ArtifactRenderingModule {}
