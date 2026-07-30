import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions, Public, Roles } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import { ParseUUIDv7Pipe } from '../../pipes';
import {
  ChangeSubscriptionDto,
  CreatePlanDto,
  RecordUsageDto,
  UpdatePlanDto,
} from './subscription-plan.dto';
import { SubscriptionPlanService } from './subscription-plan.service';
import { UsageService } from './usage.service';
import { RequiresActivePlan } from './plan-access';

@ApiTags('Plans')
@Controller()
export class SubscriptionPlanController {
  constructor(
    private readonly plans: SubscriptionPlanService,
    private readonly usage: UsageService,
  ) {}

  @Public()
  @Get('plans')
  listPlans() {
    return this.plans.listPlans();
  }

  @Post('plans')
  @Roles('PLATFORM_ADMIN')
  createPlan(@Body() input: CreatePlanDto) {
    return this.plans.createPlan(input);
  }

  @Patch('plans/:id')
  @Roles('PLATFORM_ADMIN')
  updatePlan(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Body() input: UpdatePlanDto,
  ) {
    return this.plans.updatePlan(id, input);
  }

  @Get('organizations/current/subscription')
  getSubscription(@Req() request: IdentityRequest) {
    return this.plans.getEntitlements(this.organizationId(request));
  }

  @Patch('organizations/current/subscription')
  @Permissions('subscription.manage')
  changeSubscription(
    @Req() request: IdentityRequest,
    @Body() input: ChangeSubscriptionDto,
  ) {
    return this.plans.changeSubscription(this.organizationId(request), input);
  }

  @Get('organizations/current/usage')
  @RequiresActivePlan()
  @Permissions('usage.read')
  listUsage(@Req() request: IdentityRequest) {
    return this.usage.listCurrent(this.organizationId(request));
  }

  @Post('organizations/current/usage')
  @RequiresActivePlan()
  @Permissions('usage.manage')
  recordUsage(@Req() request: IdentityRequest, @Body() input: RecordUsageDto) {
    return this.usage.record(this.organizationId(request), input);
  }

  private organizationId(request: IdentityRequest): string {
    const organizationId = request.identity?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return organizationId;
  }
}
