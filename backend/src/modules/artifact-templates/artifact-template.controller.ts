import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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
import { ArtifactTemplateService } from './artifact-template.service';
import {
  ArtifactTemplateQueryDto,
  CreateArtifactTemplateDto,
  CreateArtifactTemplateVersionDto,
  DuplicateArtifactTemplateDto,
  UpdateArtifactTemplateDto,
} from './dto/artifact-template.dto';

@ApiTags('Artifact Templates')
@Controller('artifact-templates')
@RequiresActivePlan()
export class ArtifactTemplateController {
  constructor(private readonly templates: ArtifactTemplateService) {}

  @Get()
  @Capabilities('artifact_templates.read')
  @Permissions('artifact_templates.read')
  @ApiOperation({ summary: 'List organization and available global templates' })
  list(@Req() req: IdentityRequest, @Query() query: ArtifactTemplateQueryDto) {
    return this.templates.list(this.organizationId(req), query);
  }

  @Get(':id')
  @Capabilities('artifact_templates.read')
  @Permissions('artifact_templates.read')
  get(@Param('id', ParseUUIDv7Pipe) id: string, @Req() req: IdentityRequest) {
    return this.templates.get(id, this.organizationId(req));
  }

  @Post()
  @Capabilities('artifact_templates.manage')
  @Permissions('artifact_templates.create')
  create(
    @Req() req: IdentityRequest,
    @Body() input: CreateArtifactTemplateDto,
  ) {
    return this.templates.create(
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Patch(':id')
  @Capabilities('artifact_templates.manage')
  @Permissions('artifact_templates.update')
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() input: UpdateArtifactTemplateDto,
  ) {
    return this.templates.update(
      id,
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Get(':id/versions')
  @Capabilities('artifact_templates.read')
  @Permissions('artifact_templates.read')
  versions(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.templates.versions(id, this.organizationId(req));
  }

  @Get(':id/versions/:version')
  @Capabilities('artifact_templates.read')
  @Permissions('artifact_templates.read')
  version(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: IdentityRequest,
  ) {
    return this.templates.version(id, version, this.organizationId(req));
  }

  @Post(':id/versions')
  @Capabilities('artifact_templates.manage')
  @Permissions('artifact_templates.update')
  createVersion(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() input: CreateArtifactTemplateVersionDto,
  ) {
    return this.templates.createVersion(
      id,
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Post(':id/activate')
  @Capabilities('artifact_templates.manage')
  @Permissions('artifact_templates.update')
  activate(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.templates.activate(
      id,
      this.organizationId(req),
      this.actorId(req),
    );
  }

  @Post(':id/deactivate')
  @Capabilities('artifact_templates.manage')
  @Permissions('artifact_templates.update')
  deactivate(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.templates.deactivate(
      id,
      this.organizationId(req),
      this.actorId(req),
    );
  }

  @Post(':id/duplicate')
  @Capabilities('artifact_templates.manage')
  @Permissions('artifact_templates.create')
  duplicate(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() input: DuplicateArtifactTemplateDto,
  ) {
    return this.templates.duplicate(
      id,
      this.organizationId(req),
      this.actorId(req),
      input,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Capabilities('artifact_templates.manage')
  @Permissions('artifact_templates.delete')
  remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.templates.remove(
      id,
      this.organizationId(req),
      this.actorId(req),
    );
  }

  private organizationId(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }

  private actorId(request: IdentityRequest): string {
    const id = request.identity?.id;
    if (!id) throw new ForbiddenException('Authenticated actor is required');
    return id;
  }
}
