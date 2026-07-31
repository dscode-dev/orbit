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
  ChangeReportStatusDto,
  CreateReportDto,
  ReportQueryDto,
  UpdateReportDto,
} from './dto/report.dto';
import { ReportService } from './report.service';

@ApiTags('Reports')
@Controller('reports')
@RequiresActivePlan()
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @Get()
  @Capabilities('reports.read')
  @Permissions('reports.read')
  list(@Req() request: IdentityRequest, @Query() query: ReportQueryDto) {
    return this.reports.list(this.organizationId(request), query);
  }

  @Get(':id')
  @Capabilities('reports.read')
  @Permissions('reports.read')
  get(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.reports.get(id, this.organizationId(request));
  }

  @Post()
  @Capabilities('reports.manage')
  @Permissions('reports.create')
  create(@Req() request: IdentityRequest, @Body() input: CreateReportDto) {
    return this.reports.create(
      this.organizationId(request),
      request.identity!.id,
      input,
    );
  }

  @Patch(':id')
  @Capabilities('reports.manage')
  @Permissions('reports.update')
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateReportDto,
  ) {
    return this.reports.update(id, this.organizationId(request), input);
  }

  @Patch(':id/status')
  @Capabilities('reports.manage')
  @Permissions('reports.status.update')
  changeStatus(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: ChangeReportStatusDto,
  ) {
    return this.reports.changeStatus(id, this.organizationId(request), input);
  }

  @Post(':id/render')
  @Capabilities('reports.render')
  @Permissions('reports.render')
  render(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.reports.render(id, this.organizationId(request));
  }

  @Post(':id/finalize')
  @Capabilities('reports.render')
  @Permissions('reports.finalize')
  finalize(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.reports.finalize(id, this.organizationId(request));
  }

  @Get(':id/documents')
  @Capabilities('reports.read')
  @Permissions('reports.documents.read')
  documents(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.reports.documents(id, this.organizationId(request));
  }

  @Get(':id/documents/:documentId')
  @Capabilities('reports.read')
  @Permissions('reports.documents.read')
  async download(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('documentId', ParseUUIDv7Pipe) documentId: string,
    @Req() request: IdentityRequest,
    @Res() response: Response,
  ) {
    const result = await this.reports.download(
      id,
      documentId,
      this.organizationId(request),
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Length', String(result.buffer.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Document-SHA256', result.document.sha256);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${id}-v${result.document.version}.pdf"`,
    );
    response.send(result.buffer);
  }

  @Delete(':id')
  @Capabilities('reports.manage')
  @Permissions('reports.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.reports.remove(id, this.organizationId(request));
  }

  private organizationId(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }
}
