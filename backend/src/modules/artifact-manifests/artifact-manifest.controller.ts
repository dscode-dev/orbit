/**
 * Superfície pública do documento emitido.
 *
 * **Nenhum endpoint administrativo.** Não há listagem global de manifests, não
 * há edição de revisão, não há remoção: revisão é imutável, e o que existe é o
 * ciclo que o domínio precisa —
 *
 * ```
 * abrir revisão → reservar arquivo → confirmar (emite) → baixar
 *                                                      → revogar
 * ```
 *
 * As revisões de uma execução vivem sob a execução, porque é lá que fazem
 * sentido. O manifest individual tem rota própria por ser a entidade que os
 * demais contextos referenciam.
 */
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
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
  ArtifactManifestService,
  type ManifestActor,
} from './artifact-manifest.service';
import {
  ArtifactManifestDownloadQueryDto,
  ConfirmArtifactManifestFileDto,
  OpenArtifactManifestRevisionDto,
  ReserveArtifactManifestFileDto,
  RevokeArtifactManifestDto,
} from './dto/artifact-manifest.dto';

@ApiTags('Artifact Manifests')
@ApiBearerAuth()
@Controller()
@RequiresActivePlan()
export class ArtifactManifestController {
  constructor(private readonly manifests: ArtifactManifestService) {}

  @Get('artifact-executions/:id/manifests')
  @Capabilities('artifact_manifests.read')
  @Permissions('artifact_manifests.read')
  @ApiOperation({ summary: 'List every revision issued for an execution' })
  list(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.manifests.listByExecution(
      id,
      this.actor(request).organizationId,
    );
  }

  @Post('artifact-executions/:id/manifests')
  @Capabilities('artifact_manifests.manage')
  @Permissions('artifact_manifests.issue')
  @ApiOperation({
    summary: 'Open the next revision; the renderer delivers the content later',
  })
  open(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: OpenArtifactManifestRevisionDto,
  ) {
    return this.manifests.openRevision(id, this.actor(request), input);
  }

  @Get('artifact-manifests/:id')
  @Capabilities('artifact_manifests.read')
  @Permissions('artifact_manifests.read')
  get(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.manifests.get(id, this.actor(request).organizationId);
  }

  @Post('artifact-manifests/:id/file')
  @Capabilities('artifact_manifests.manage')
  @Permissions('artifact_manifests.issue')
  @ApiOperation({
    summary: 'Reserve the file and return a signed upload URL',
  })
  reserve(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: ReserveArtifactManifestFileDto,
  ) {
    return this.manifests.reserveFile(id, this.actor(request), input);
  }

  @Post('artifact-manifests/:id/issue')
  @Capabilities('artifact_manifests.manage')
  @Permissions('artifact_manifests.issue')
  @ApiOperation({
    summary: 'Confirm the uploaded content, hash it and issue the document',
  })
  issue(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: ConfirmArtifactManifestFileDto,
  ) {
    return this.manifests.confirmFile(id, this.actor(request), input);
  }

  @Get('artifact-manifests/:id/download')
  @Capabilities('artifact_manifests.read')
  @Permissions('artifact_manifests.read')
  @ApiOperation({
    summary: 'Return a short-lived signed URL; never a storage path',
  })
  download(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Query() query: ArtifactManifestDownloadQueryDto,
  ) {
    return this.manifests.signDownload(
      id,
      this.actor(request),
      query.operation,
    );
  }

  @Post('artifact-manifests/:id/revoke')
  @Capabilities('artifact_manifests.manage')
  @Permissions('artifact_manifests.revoke')
  @ApiOperation({
    summary: 'Invalidate an issued revision; it stays on record',
  })
  revoke(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: RevokeArtifactManifestDto,
  ) {
    return this.manifests.revoke(id, this.actor(request), input);
  }

  private actor(request: IdentityRequest): ManifestActor {
    const organizationId = request.identity?.organizationId;
    const actorId = request.identity?.id;
    if (!organizationId || !actorId) {
      throw new ForbiddenException('Organization context is required');
    }
    return { organizationId, actorId };
  }
}
