import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import { RequiresActivePlan } from '../subscription-plans/plan-access';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { OrganizationService } from './organization.service';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizations: OrganizationService) {}

  @Post()
  create(
    @Req() request: IdentityRequest,
    @Body() input: CreateOrganizationDto,
  ) {
    return this.organizations.create(request.identity!.id, input);
  }

  @Get('current')
  @RequiresActivePlan()
  getCurrent(@Req() request: IdentityRequest) {
    return this.organizations.getCurrent(this.organizationId(request));
  }

  @Patch('current')
  @RequiresActivePlan()
  @Permissions('organization.update')
  updateCurrent(
    @Req() request: IdentityRequest,
    @Body() input: UpdateOrganizationDto,
  ) {
    return this.organizations.update(this.organizationId(request), input);
  }

  private organizationId(request: IdentityRequest): string {
    const organizationId = request.identity?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return organizationId;
  }
}
