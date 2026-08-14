/**
 * API do Management Reports Engine — `/api/v1/management-reports`.
 *
 * ## Por que não `/reports`
 *
 * `/reports` já existe e é o **relatório operacional de visita** (PR-08/09):
 * pertence a uma operação, tem seções preenchidas por alguém em campo e coleta
 * assinatura. Ocupar a rota quebraria esse contrato, e reaproveitar a
 * capability `reports.read` faria quem lê o relatório de uma visita ler também
 * o relatório gerencial financeiro da organização — o contorno que a PR
 * precisa impedir.
 *
 * Daí `reports.management.read` / `reports.management.manage`: mesmo domínio
 * de nomes, autorização própria.
 *
 * ## Duas camadas de autorização
 *
 * Os guardas de rota conferem a capability do motor. O serviço confere as do
 * **domínio de cada relatório** — e é ele quem recusa o financeiro para quem
 * não tem `financial.read`. Um guarda de rota não teria como: o tipo do
 * relatório só se conhece depois de ler o corpo.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import {
  GenerateReportDto,
  ReportDownloadQueryDto,
  ReportQueryDto,
} from './report.dto';
import { ReportMapper } from './report.mapper';
import { ReportService, type ReportActor } from './report.service';

@ApiTags('Management Reports')
@Controller('management-reports')
@RequiresActivePlan()
export class ManagementReportController {
  constructor(
    private readonly reports: ReportService,
    private readonly mapper: ReportMapper,
  ) {}

  @Get('catalog')
  @Capabilities('reports.management.read')
  @Permissions('reports.management.read')
  @ApiOperation({
    summary:
      'Report types, their parameters and what this session may generate',
  })
  catalog(@Req() request: IdentityRequest) {
    return this.reports.catalog(this.actor(request));
  }

  @Get()
  @Capabilities('reports.management.read')
  @Permissions('reports.management.read')
  @ApiOperation({ summary: 'Generated reports, newest first' })
  async list(@Req() request: IdentityRequest, @Query() query: ReportQueryDto) {
    const result = await this.reports.list(this.actor(request), query);
    return {
      data: result.data.map((report) => this.mapper.summary(report)),
      meta: result.meta,
    };
  }

  /**
   * Pede a geração.
   *
   * **202**, não 201: o relatório ainda não existe como documento — existe
   * como solicitação. O corpo devolve o registro com `status: PENDING`, e
   * quem espera acompanha por `/status`.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Capabilities('reports.management.manage')
  @Permissions('reports.management.manage')
  @ApiOperation({ summary: 'Request a report; composition runs in background' })
  generate(@Req() request: IdentityRequest, @Body() input: GenerateReportDto) {
    return this.reports.generate(this.actor(request), input);
  }

  @Get(':id')
  @Capabilities('reports.management.read')
  @Permissions('reports.management.read')
  @ApiOperation({ summary: 'Report with the snapshot as it was recorded' })
  detail(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.reports.get(id, this.actor(request));
  }

  @Get(':id/status')
  @Capabilities('reports.management.read')
  @Permissions('reports.management.read')
  @ApiOperation({ summary: 'Generation state — for polling' })
  status(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.reports.status(id, this.actor(request));
  }

  /** O snapshot sozinho — os números do momento, sem o envelope. */
  @Get(':id/snapshot')
  @Capabilities('reports.management.read')
  @Permissions('reports.management.read')
  @ApiOperation({ summary: 'Immutable snapshot; never recomputed on read' })
  snapshot(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.reports.snapshot(id, this.actor(request));
  }

  @Get(':id/download')
  @Capabilities('reports.management.read')
  @Permissions('reports.management.read')
  @ApiOperation({ summary: 'Short-lived signed URL; never a storage path' })
  download(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Query() query: ReportDownloadQueryDto,
  ) {
    return this.reports.download(id, this.actor(request), query.operation);
  }

  private actor(request: IdentityRequest): ReportActor {
    const organizationId = request.identity?.organizationId;
    const actorId = request.identity?.id;
    if (!organizationId || !actorId) {
      throw new ForbiddenException('Organization context is required');
    }
    return {
      organizationId,
      actorId,
      permissions: request.identity?.permissions ?? [],
      businessUnitIds: request.identity?.businessUnitIds ?? [],
    };
  }
}
