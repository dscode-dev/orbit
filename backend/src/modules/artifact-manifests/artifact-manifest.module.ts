import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ArtifactExecutionModule } from '../artifact-executions/artifact-execution.module';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { ArtifactManifestController } from './artifact-manifest.controller';
import { ArtifactManifestMapper } from './artifact-manifest.mapper';
import { ArtifactManifestPolicy } from './artifact-manifest.policy';
import { ArtifactManifestRepository } from './artifact-manifest.repository';
import { ArtifactManifestService } from './artifact-manifest.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    SubscriptionPlansModule,
    ArtifactExecutionModule,
  ],
  controllers: [ArtifactManifestController],
  providers: [
    ArtifactManifestRepository,
    ArtifactManifestService,
    ArtifactManifestMapper,
    ArtifactManifestPolicy,
  ],
  exports: [ArtifactManifestService],
})
export class ArtifactManifestModule {}
