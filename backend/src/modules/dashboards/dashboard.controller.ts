import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard.dto';

@ApiTags('Dashboard & Intelligence')
@ApiBearerAuth()
@Controller('dashboard')
@RequiresActivePlan()
@Capabilities('dashboard.read')
@Permissions('dashboard.read')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Resolve the dashboard and return all available widget Read Models',
  })
  @ApiOkResponse({
    description: 'Dynamic dashboard resolved for the tenant context',
  })
  get(@Req() request: IdentityRequest, @Query() query: DashboardQueryDto) {
    return this.dashboard.get(request.identity!, query);
  }

  @Get('widgets/:id')
  @ApiOperation({ summary: 'Resolve and return one available widget' })
  @ApiOkResponse({ description: 'Widget metadata and its current Read Model' })
  getWidget(
    @Param('id') id: string,
    @Req() request: IdentityRequest,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboard.getWidget(id, request.identity!, query);
  }
}
