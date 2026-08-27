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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import {
  AssignOperationUserDto,
  AddAuxiliaryTechnicianDto,
  ChangeOperationStatusDto,
  CreateOperationDto,
  OperationQueryDto,
  ReplaceResponsibleFieldTechnicianDto,
  UpdateOperationDto,
} from './dto/operation.dto';
import { OperationService } from './operation.service';
import { OperationReadModelMapper } from './operation.mapper';

@ApiTags('Operations')
@Controller('operations')
@RequiresActivePlan()
export class OperationController {
  constructor(
    private readonly operations: OperationService,
    private readonly readModels: OperationReadModelMapper,
  ) {}

  @Get()
  @Capabilities('operations.read')
  @Permissions('operations.read')
  async list(
    @Req() request: IdentityRequest,
    @Query() query: OperationQueryDto,
  ) {
    return this.readModels.list(
      await this.operations.list(this.organizationId(request), query),
      this.actor(request),
    );
  }

  @Patch(':id/responsible-field-technician')
  @Capabilities('operations.manage')
  @Permissions('operations.assign')
  async replaceResponsibleFieldTechnician(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: ReplaceResponsibleFieldTechnicianDto,
  ) {
    return this.readModels.details(
      await this.operations.replaceResponsibleFieldTechnician(
        id,
        this.organizationId(request),
        request.identity!.id,
        input.userId,
      ),
      this.actor(request),
    );
  }

  @Post(':id/auxiliary-technicians')
  @Capabilities('operations.manage')
  @Permissions('operations.assign')
  async addAuxiliaryTechnician(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: AddAuxiliaryTechnicianDto,
  ) {
    return this.readModels.details(
      await this.operations.addAuxiliaryTechnician(
        id,
        this.organizationId(request),
        request.identity!.id,
        input.userId,
      ),
      this.actor(request),
    );
  }

  @Delete(':id/auxiliary-technicians/:userId')
  @Capabilities('operations.manage')
  @Permissions('operations.assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAuxiliaryTechnician(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('userId', ParseUUIDv7Pipe) userId: string,
    @Req() request: IdentityRequest,
  ) {
    return this.operations.removeAuxiliaryTechnician(
      id,
      this.organizationId(request),
      request.identity!.id,
      userId,
    );
  }

  @Get(':id')
  @Capabilities('operations.read')
  @Permissions('operations.read')
  async get(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.readModels.details(
      await this.operations.get(id, this.organizationId(request)),
      this.actor(request),
    );
  }

  @Post()
  @Capabilities('operations.manage')
  @Permissions('operations.create')
  async create(
    @Req() request: IdentityRequest,
    @Body() input: CreateOperationDto,
  ) {
    return this.readModels.details(
      await this.operations.create(
        this.organizationId(request),
        request.identity!.id,
        input,
      ),
      this.actor(request),
    );
  }

  @Patch(':id')
  @Capabilities('operations.manage')
  @Permissions('operations.update')
  async update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateOperationDto,
  ) {
    return this.readModels.details(
      await this.operations.update(
        id,
        this.organizationId(request),
        request.identity!.id,
        input,
      ),
      this.actor(request),
    );
  }

  @Patch(':id/status')
  @Capabilities('operations.manage')
  @Permissions('operations.status.update')
  async changeStatus(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: ChangeOperationStatusDto,
  ) {
    return this.readModels.details(
      await this.operations.changeStatus(
        id,
        this.organizationId(request),
        request.identity!.id,
        input,
        request.identity!.permissions,
      ),
      this.actor(request),
    );
  }

  @Post(':id/assignments')
  @Capabilities('operations.manage')
  @Permissions('operations.assign')
  async assign(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: AssignOperationUserDto,
  ) {
    return this.readModels.details(
      await this.operations.assign(
        id,
        this.organizationId(request),
        request.identity!.id,
        input,
      ),
      this.actor(request),
    );
  }

  @Delete(':id/assignments/:userId')
  @Capabilities('operations.manage')
  @Permissions('operations.assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  unassign(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('userId', ParseUUIDv7Pipe) userId: string,
    @Req() request: IdentityRequest,
  ) {
    return this.operations.unassign(
      id,
      userId,
      this.organizationId(request),
      request.identity!.id,
    );
  }

  @Get(':id/history')
  @Capabilities('operations.read')
  @Permissions('operations.history.read')
  async history(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return (
      await this.operations.history(id, this.organizationId(request))
    ).map((event) => this.readModels.history(event));
  }

  @Get(':id/timeline')
  @Capabilities('operations.read')
  @Permissions('operations.history.read')
  async timeline(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.readModels.timeline(
      await this.operations.timeline(id, this.organizationId(request)),
    );
  }

  @Post(':id/attachments')
  @Capabilities('operations.manage')
  @Permissions('operations.attachments.create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  async attach(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.readModels.attachment(
      await this.operations.attach(
        id,
        this.organizationId(request),
        request.identity!.id,
        file,
      ),
    );
  }

  @Get(':id/attachments/:attachmentId')
  @Capabilities('operations.read')
  @Permissions('operations.attachments.read')
  async download(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('attachmentId', ParseUUIDv7Pipe) attachmentId: string,
    @Req() request: IdentityRequest,
    @Res() response: Response,
  ) {
    const result = await this.operations.download(
      id,
      attachmentId,
      this.organizationId(request),
    );
    response.setHeader('Content-Type', result.attachment.mimeType);
    response.setHeader('Content-Length', String(result.buffer.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.fileName)}`,
    );
    response.send(result.buffer);
  }

  @Delete(':id/attachments/:attachmentId')
  @Capabilities('operations.manage')
  @Permissions('operations.attachments.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAttachment(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('attachmentId', ParseUUIDv7Pipe) attachmentId: string,
    @Req() request: IdentityRequest,
  ) {
    return this.operations.removeAttachment(
      id,
      attachmentId,
      this.organizationId(request),
      request.identity!.id,
    );
  }

  @Delete(':id')
  @Capabilities('operations.manage')
  @Permissions('operations.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.operations.remove(
      id,
      this.organizationId(request),
      request.identity!.id,
    );
  }

  private organizationId(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }

  private actor(request: IdentityRequest) {
    return {
      id: request.identity!.id,
      permissions: request.identity!.permissions,
    };
  }
}
