import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions, Roles } from '../../decorators';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  CreatePlatformTenantDto,
  PlatformListQueryDto,
  UpdatePlatformOrganizationDto,
} from './dto/platform-administration.dto';
import { PlatformAdministrationService } from './platform-administration.service';

@ApiTags('Platform Administration')
@ApiBearerAuth()
@Controller('platform-admin')
@Roles('PLATFORM_ADMIN')
@Permissions('platform.admin')
export class PlatformAdministrationController {
  constructor(private readonly platform: PlatformAdministrationService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Return global platform administration totals' })
  overview() {
    return this.platform.overview();
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List organizations across all tenants' })
  organizations(@Query() query: PlatformListQueryDto) {
    return this.platform.organizations(query);
  }

  @Get('organizations/:id')
  organization(@Param('id', ParseUUIDv7Pipe) id: string) {
    return this.platform.organization(id);
  }

  @Patch('organizations/:id')
  @ApiOperation({ summary: 'Manage tenant status, subscription and plan' })
  updateOrganization(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdatePlatformOrganizationDto,
  ) {
    return this.platform.updateOrganization(id, request.identity!.id, input);
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Tenant, organization, primary unit and owner created',
  })
  @ApiOperation({
    summary: 'Provision a tenant and its first organization owner',
  })
  createTenant(
    @Req() request: IdentityRequest,
    @Body() input: CreatePlatformTenantDto,
  ) {
    return this.platform.createTenant(request.identity!.id, input);
  }

  @Get('users')
  @ApiOperation({ summary: 'List users across all tenants' })
  users(@Query() query: PlatformListQueryDto) {
    return this.platform.users(query);
  }

  @Get('resources')
  @ApiOperation({ summary: 'List plans and modules managed by the platform' })
  resources() {
    return this.platform.resources();
  }
}
