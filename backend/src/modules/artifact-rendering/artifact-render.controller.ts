/**
 * API da renderização (Stage 6).
 *
 * ```
 * POST /artifact-executions/:id/render     solicita  → 202 com o estado
 * GET  /artifact-executions/:id/render     consulta  → estado
 * GET  /artifact-rendering/metrics         observa   → contadores do processo
 * ```
 *
 * **Só isto.** Listar revisões e obter URL de download já existem na PR-19
 * (`GET /artifact-executions/:id/manifests` e
 * `GET /artifact-manifests/:id/download`); repeti-los aqui criaria dois
 * caminhos para a mesma coisa.
 *
 * Nenhuma rota devolve arquivo: quando uma URL assinada resolve o caso, é ela
 * que é devolvida — e ela é da PR-19.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import {
  ArtifactRenderService,
  type RenderActor,
} from './artifact-render.service';
import { RequestArtifactRenderDto } from './dto/artifact-render.dto';

@ApiTags('Artifact Rendering')
@ApiBearerAuth()
@Controller()
@RequiresActivePlan()
export class ArtifactRenderController {
  constructor(private readonly rendering: ArtifactRenderService) {}

  /**
   * 202, não 201.
   *
   * Nada foi criado ainda: o trabalho foi aceito. O documento aparece quando o
   * worker termina, e o cliente descobre consultando o estado.
   */
  @Post('artifact-executions/:id/render')
  @HttpCode(HttpStatus.ACCEPTED)
  @Capabilities('artifact_rendering.render')
  @Permissions('artifact_rendering.render')
  @ApiOperation({ summary: 'Queue a rendering; returns immediately' })
  request(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: RequestArtifactRenderDto,
  ) {
    return this.rendering.request(id, this.actor(request), input);
  }

  @Get('artifact-executions/:id/render')
  @Capabilities('artifact_executions.read')
  @Permissions('artifact_executions.read')
  @ApiOperation({ summary: 'Read the rendering state of an execution' })
  status(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.rendering.status(id, this.actor(request));
  }

  /**
   * Contadores do processo.
   *
   * Exige sessão e plano ativo como qualquer outra rota — número de operação é
   * informação de negócio, não dado público.
   */
  @Get('artifact-rendering/metrics')
  @Capabilities('artifact_executions.read')
  @Permissions('artifact_executions.read')
  @ApiOperation({ summary: 'In-process rendering counters and renderers' })
  metrics(@Req() request: IdentityRequest) {
    this.actor(request);
    return this.rendering.metricsSnapshot();
  }

  private actor(request: IdentityRequest): RenderActor {
    const organizationId = request.identity?.organizationId;
    const actorId = request.identity?.id;
    if (!organizationId || !actorId) {
      throw new ForbiddenException('Organization context is required');
    }
    return { organizationId, actorId };
  }
}
