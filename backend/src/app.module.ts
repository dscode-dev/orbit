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
import { WorkforceModule } from './modules/workforce/workforce.module';
import { FinancialModule } from './modules/financial/financial.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { ManagementReportsModule } from './modules/management-reports/management-reports.module';
import { PmocModule } from './modules/pmoc/pmoc.module';
import { OperationsModule } from './modules/operations/operations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SignaturesModule } from './modules/signatures/signatures.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiPanelModule } from './modules/ai-panel/ai-panel.module';
import { DashboardModule } from './modules/dashboards/dashboard.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PlatformAdministrationModule } from './modules/platform-administration/platform-administration.module';
import { ArtifactTemplateModule } from './modules/artifact-templates/artifact-template.module';
import { ArtifactRenderingModule } from './modules/artifact-rendering/artifact-rendering.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ArtifactManifestModule } from './modules/artifact-manifests/artifact-manifest.module';
import { StorageModule } from './modules/storage/storage.module';
import { ArtifactExecutionModule } from './modules/artifact-executions/artifact-execution.module';
import { RvtModule } from './modules/rvt/rvt.module';

@Module({
  imports: [
    FoundationModule,
    PrismaModule,
    IdentityModule,
    OrganizationsModule,
    TechnicalCatalogsModule,
    WorkforceModule,
    FinancialModule,
    QuotesModule,
    InventoryModule,
    AutomationsModule,
    ManagementReportsModule,
    PmocModule,
    IntegrationsModule,
    OperationsModule,
    ReportsModule,
    SignaturesModule,
    NotificationsModule,
    AiPanelModule,
    DashboardModule,
    SchedulingModule,
    AnalyticsModule,
    PlatformAdministrationModule,
    ArtifactTemplateModule,
    ArtifactExecutionModule,
    StorageModule,
    ArtifactManifestModule,
    JobsModule,
    ArtifactRenderingModule,
    RvtModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
