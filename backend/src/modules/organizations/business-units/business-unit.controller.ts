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
import { Permissions } from '../../../decorators';
import { ForbiddenException } from '../../../exceptions';
import { ParseUUIDv7Pipe } from '../../../pipes';
import type { IdentityRequest } from '../../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../../subscription-plans/plan-access';
import {
  CreateBusinessUnitDto,
  UpdateBusinessUnitDto,
} from '../dto/organization.dto';
import { BusinessUnitService } from './business-unit.service';

@ApiTags('Business Units')
@Controller('organizations/current/business-units')
@RequiresActivePlan()
export class BusinessUnitController {
  constructor(private readonly businessUnits: BusinessUnitService) {}

  @Get()
  @Capabilities('business_units.read')
  list(@Req() request: IdentityRequest) {
    return this.businessUnits.list(this.organizationId(request));
  }

  @Post()
  @Permissions('business_units.create')
  @Capabilities('business_units.manage')
  create(
    @Req() request: IdentityRequest,
    @Body() input: CreateBusinessUnitDto,
  ) {
    const identity = request.identity!;
    return this.businessUnits.create(
      this.organizationId(request),
      identity.id,
      identity.businessUnitIds,
      input,
    );
  }

  @Patch(':id')
  @Permissions('business_units.update')
  @Capabilities('business_units.manage')
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateBusinessUnitDto,
  ) {
    return this.businessUnits.update(id, this.organizationId(request), input);
  }

  @Delete(':id')
  @Permissions('business_units.delete')
  @Capabilities('business_units.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.businessUnits.remove(id, this.organizationId(request));
  }

  private organizationId(request: IdentityRequest): string {
    const organizationId = request.identity?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return organizationId;
  }
}
