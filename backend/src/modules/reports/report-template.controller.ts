import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import {
  CreateReportTemplateDto,
  CreateReportTemplateVersionDto,
  PreviewReportTemplateDto,
  ReportTemplateQueryDto,
  UpdateReportTemplateDto,
} from './dto/report-template.dto';
import { ReportTemplateService } from './report-template.service';

@ApiTags('Report Templates')
@Controller('report-templates')
@RequiresActivePlan()
export class ReportTemplateController {
  constructor(private readonly templates: ReportTemplateService) {}

  @Get()
  @Capabilities('document_engine.read')
  @Permissions('report_templates.read')
  list(
    @Req() request: IdentityRequest,
    @Query() query: ReportTemplateQueryDto,
  ) {
    return this.templates.list(this.organizationId(request), query);
  }

  @Get(':id')
  @Capabilities('document_engine.read')
  @Permissions('report_templates.read')
  get(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.templates.get(id, this.organizationId(request));
  }

  @Post()
  @Capabilities('document_engine.manage')
  @Permissions('report_templates.create')
  create(
    @Req() request: IdentityRequest,
    @Body() input: CreateReportTemplateDto,
  ) {
    return this.templates.create(this.organizationId(request), input);
  }

  @Post(':id/versions')
  @Capabilities('document_engine.manage')
  @Permissions('report_templates.create')
  createVersion(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: CreateReportTemplateVersionDto,
  ) {
    return this.templates.createVersion(
      id,
      this.organizationId(request),
      input,
    );
  }

  @Patch(':id')
  @Capabilities('document_engine.manage')
  @Permissions('report_templates.update')
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateReportTemplateDto,
  ) {
    return this.templates.update(id, this.organizationId(request), input);
  }

  @Post(':id/preview')
  @Capabilities('document_engine.read')
  @Permissions('report_templates.read')
  async preview(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: PreviewReportTemplateDto,
    @Res() response: Response,
  ) {
    const pdf = await this.templates.preview(
      id,
      this.organizationId(request),
      input,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Length', String(pdf.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    response.send(pdf);
  }

  @Delete(':id')
  @Capabilities('document_engine.manage')
  @Permissions('report_templates.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.templates.remove(id, this.organizationId(request));
  }

  private organizationId(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }
}
