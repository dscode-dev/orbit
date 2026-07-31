import './configure-environment';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FoundationModule } from './common';
import { PrismaModule } from './database';
import { IdentityModule } from './modules/identity/identity.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { TechnicalCatalogsModule } from './modules/technical-catalogs/technical-catalogs.module';
import { OperationsModule } from './modules/operations/operations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SignaturesModule } from './modules/signatures/signatures.module';

@Module({
  imports: [
    FoundationModule,
    PrismaModule,
    IdentityModule,
    OrganizationsModule,
    TechnicalCatalogsModule,
    IntegrationsModule,
    OperationsModule,
    ReportsModule,
    SignaturesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
