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
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
} from './dto/integration.dto';
import { IntegrationService } from './integration.service';

@ApiTags('Integrations')
@Controller('integrations')
@RequiresActivePlan()
export class IntegrationController {
  constructor(private readonly integrations: IntegrationService) {}

  @Get()
  @Capabilities('integrations.read')
  @Permissions('integrations.read')
  list(@Req() request: IdentityRequest) {
    return this.integrations.list(this.organizationId(request));
  }

  @Get(':id')
  @Capabilities('integrations.read')
  @Permissions('integrations.read')
  get(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.integrations.get(id, this.organizationId(request));
  }

  @Post()
  @Capabilities('integrations.manage')
  @Permissions('integrations.create')
  create(@Req() request: IdentityRequest, @Body() input: CreateIntegrationDto) {
    return this.integrations.create(this.organizationId(request), input);
  }

  @Patch(':id')
  @Capabilities('integrations.manage')
  @Permissions('integrations.update')
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateIntegrationDto,
  ) {
    return this.integrations.update(id, this.organizationId(request), input);
  }

  @Post(':id/validate')
  @Capabilities('integrations.manage')
  @Permissions('integrations.validate')
  validate(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.integrations.validate(id, this.organizationId(request));
  }

  @Delete(':id')
  @Capabilities('integrations.manage')
  @Permissions('integrations.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.integrations.remove(id, this.organizationId(request));
  }

  private organizationId(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }
}
