import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { ArtifactExecutionService } from './artifact-execution.service';
import {
  ArtifactExecutionQueryDto,
  ChangeArtifactExecutionStatusDto,
  CollectArtifactSignatureDto,
  CreateArtifactExecutionDto,
  RegisterArtifactAttachmentDto,
  SaveArtifactResponseDto,
  UpdateArtifactExecutionDto,
} from './dto/artifact-execution.dto';

@ApiTags('Artifact Executions')
@Controller('artifact-executions')
@RequiresActivePlan()
export class ArtifactExecutionController {
  constructor(private readonly executions: ArtifactExecutionService) {}

  @Get()
  @Capabilities('artifact_executions.read')
  @Permissions('artifact_executions.read')
  list(@Req() req: IdentityRequest, @Query() query: ArtifactExecutionQueryDto) {
    return this.executions.list(this.organizationId(req), query);
  }

  @Get(':id')
  @Capabilities('artifact_executions.read')
  @Permissions('artifact_executions.read')
  get(@Param('id', ParseUUIDv7Pipe) id: string, @Req() req: IdentityRequest) {
    return this.executions.get(id, this.organizationId(req));
  }

  @Post()
  @Capabilities('artifact_executions.manage')
  @Permissions('artifact_executions.create')
  @ApiOperation({
    summary: 'Create an execution and immutable template snapshot',
  })
  create(
    @Req() req: IdentityRequest,
    @Body() input: CreateArtifactExecutionDto,
  ) {
    return this.executions.create(
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Patch(':id')
  @Capabilities('artifact_executions.manage')
  @Permissions('artifact_executions.update')
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() input: UpdateArtifactExecutionDto,
  ) {
    return this.executions.update(
      id,
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Patch(':id/status')
  @Capabilities('artifact_executions.execute')
  @Permissions('artifact_executions.execute')
  status(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() input: ChangeArtifactExecutionStatusDto,
  ) {
    return this.executions.changeStatus(
      id,
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Put(':id/responses')
  @Capabilities('artifact_executions.execute')
  @Permissions('artifact_executions.execute')
  response(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() input: SaveArtifactResponseDto,
  ) {
    return this.executions.saveResponse(
      id,
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Post(':id/attachments')
  @Capabilities('artifact_executions.execute')
  @Permissions('artifact_executions.execute')
  attachment(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() input: RegisterArtifactAttachmentDto,
  ) {
    return this.executions.registerAttachment(
      id,
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Post(':id/signatures')
  @Capabilities('artifact_executions.execute')
  @Permissions('artifact_executions.execute')
  signature(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() input: CollectArtifactSignatureDto,
  ) {
    return this.executions.collectSignature(
      id,
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Get(':id/progress')
  @Capabilities('artifact_executions.read')
  @Permissions('artifact_executions.read')
  progress(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.executions.progressOf(id, this.organizationId(req));
  }

  private organizationId(req: IdentityRequest): string {
    const id = req.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }
  private actorId(req: IdentityRequest): string {
    const id = req.identity?.id;
    if (!id) throw new ForbiddenException('Authenticated actor is required');
    return id;
  }
}
