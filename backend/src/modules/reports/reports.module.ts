import { Module } from '@nestjs/common';
import { DocumentEngineModule } from '../document-engine/document-engine.module';
import { ReportTemplateController } from './report-template.controller';
import { ReportTemplateRepository } from './report-template.repository';
import { ReportTemplateService } from './report-template.service';
import { ReportController } from './report.controller';
import { ReportRepository } from './report.repository';
import { ReportService } from './report.service';

@Module({
  imports: [DocumentEngineModule],
  controllers: [ReportTemplateController, ReportController],
  providers: [
    ReportTemplateRepository,
    ReportTemplateService,
    ReportRepository,
    ReportService,
  ],
  exports: [ReportTemplateService, ReportService],
})
export class ReportsModule {}
