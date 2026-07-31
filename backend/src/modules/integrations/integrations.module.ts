import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationRepository } from './integration.repository';
import { IntegrationService } from './integration.service';
import {
  INTEGRATION_ADAPTERS,
  IntegrationProviderRegistry,
} from './provider/integration-provider';
import { OpenAiCompatibleIntegrationAdapter } from './provider/openai-compatible-integration.adapter';

@Module({
  controllers: [IntegrationController],
  providers: [
    IntegrationRepository,
    IntegrationService,
    IntegrationProviderRegistry,
    OpenAiCompatibleIntegrationAdapter,
    {
      provide: INTEGRATION_ADAPTERS,
      inject: [OpenAiCompatibleIntegrationAdapter],
      useFactory: (openAi: OpenAiCompatibleIntegrationAdapter) => [openAi],
    },
  ],
  exports: [IntegrationService, INTEGRATION_ADAPTERS],
})
export class IntegrationsModule {}
