import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationRepository } from './integration.repository';
import { IntegrationService } from './integration.service';
import {
  INTEGRATION_ADAPTERS,
  IntegrationProviderRegistry,
} from './provider/integration-provider';

@Module({
  controllers: [IntegrationController],
  providers: [
    IntegrationRepository,
    IntegrationService,
    IntegrationProviderRegistry,
    { provide: INTEGRATION_ADAPTERS, useValue: [] },
  ],
  exports: [IntegrationService, INTEGRATION_ADAPTERS],
})
export class IntegrationsModule {}
