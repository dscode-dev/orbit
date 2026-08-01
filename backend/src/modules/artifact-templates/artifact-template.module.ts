import { Module } from '@nestjs/common';
import { ArtifactTemplateController } from './artifact-template.controller';
import { ArtifactTemplateReadModelMapper } from './artifact-template.mapper';
import { ArtifactTemplatePolicy } from './artifact-template.policy';
import { ArtifactTemplateRepository } from './artifact-template.repository';
import { ArtifactTemplateService } from './artifact-template.service';
import { ArtifactTemplateValidator } from './artifact-template.validator';

@Module({
  controllers: [ArtifactTemplateController],
  providers: [
    ArtifactTemplateService,
    ArtifactTemplateRepository,
    ArtifactTemplateReadModelMapper,
    ArtifactTemplateValidator,
    ArtifactTemplatePolicy,
  ],
  exports: [ArtifactTemplateService],
})
export class ArtifactTemplateModule {}
