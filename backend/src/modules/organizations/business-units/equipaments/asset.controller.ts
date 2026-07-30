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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../../decorators';
import { ForbiddenException } from '../../../../exceptions';
import { ParseUUIDv7Pipe } from '../../../../pipes';
import type { IdentityRequest } from '../../../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../../../subscription-plans/plan-access';
import { AssetQueryDto, CreateAssetDto, UpdateAssetDto } from './asset.dto';
import { AssetService } from './asset.service';

@ApiTags('Assets')
@Controller('assets')
@RequiresActivePlan()
export class AssetController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  @Capabilities('assets.read')
  @Permissions('assets.read')
  list(@Req() request: IdentityRequest, @Query() query: AssetQueryDto) {
    return this.assets.list(this.organizationId(request), query);
  }

  @Get('resolve/:identifier')
  @Capabilities('assets.read')
  @Permissions('assets.read')
  resolve(
    @Param('identifier') identifier: string,
    @Req() request: IdentityRequest,
  ) {
    return this.assets.resolve(identifier, this.organizationId(request));
  }

  @Get(':id')
  @Capabilities('assets.read')
  @Permissions('assets.read')
  get(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.assets.get(id, this.organizationId(request));
  }

  @Post()
  @Capabilities('assets.manage')
  @Permissions('assets.create')
  create(@Req() request: IdentityRequest, @Body() input: CreateAssetDto) {
    return this.assets.create(this.organizationId(request), input);
  }

  @Patch(':id')
  @Capabilities('assets.manage')
  @Permissions('assets.update')
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateAssetDto,
  ) {
    return this.assets.update(id, this.organizationId(request), input);
  }

  @Delete(':id')
  @Capabilities('assets.manage')
  @Permissions('assets.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.assets.remove(id, this.organizationId(request));
  }

  private organizationId(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }
}
