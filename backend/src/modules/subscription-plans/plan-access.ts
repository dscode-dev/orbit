import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UUID } from '../../contracts';
import { PUBLIC_KEY } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import type { AuthenticatedIdentity } from '../identity/domain/identity.types';
import { SubscriptionPlanService } from './subscription-plan.service';

export const REQUIRED_PLAN_KEY = 'subscription:required-plan';
export const REQUIRED_CAPABILITIES_KEY = 'subscription:required-capabilities';
export const ACTIVE_PLAN_KEY = 'subscription:active';

export const RequiresPlan = (...plans: string[]) =>
  SetMetadata(REQUIRED_PLAN_KEY, plans);

export const Capabilities = (...capabilities: string[]) =>
  SetMetadata(REQUIRED_CAPABILITIES_KEY, capabilities);

export const RequiresActivePlan = () => SetMetadata(ACTIVE_PLAN_KEY, true);

abstract class PlanMetadataGuard {
  constructor(
    protected readonly reflector: Reflector,
    protected readonly plans: SubscriptionPlanService,
  ) {}

  protected isPublic(context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }

  protected identity(
    context: ExecutionContext,
  ): AuthenticatedIdentity & { organizationId: UUID } {
    const identity = context
      .switchToHttp()
      .getRequest<IdentityRequest>().identity;
    if (!identity?.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return identity as AuthenticatedIdentity & { organizationId: UUID };
  }
}

@Injectable()
export class ActivePlanGuard extends PlanMetadataGuard implements CanActivate {
  constructor(reflector: Reflector, plans: SubscriptionPlanService) {
    super(reflector, plans);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;
    const required = this.reflector.getAllAndOverride<boolean>(
      ACTIVE_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;
    const identity = this.identity(context);
    await this.plans.assertActive(identity.organizationId, {
      userId: identity.id,
      businessUnitIds: identity.businessUnitIds,
    });
    return true;
  }
}

@Injectable()
export class RequiredPlanGuard
  extends PlanMetadataGuard
  implements CanActivate
{
  constructor(reflector: Reflector, plans: SubscriptionPlanService) {
    super(reflector, plans);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;
    const required =
      this.reflector.getAllAndOverride<readonly string[]>(REQUIRED_PLAN_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;
    const identity = this.identity(context);
    await this.plans.assertPlan(identity.organizationId, required, {
      userId: identity.id,
      businessUnitIds: identity.businessUnitIds,
    });
    return true;
  }
}

@Injectable()
export class CapabilityGuard extends PlanMetadataGuard implements CanActivate {
  constructor(reflector: Reflector, plans: SubscriptionPlanService) {
    super(reflector, plans);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;
    const required =
      this.reflector.getAllAndOverride<readonly string[]>(
        REQUIRED_CAPABILITIES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];
    if (required.length === 0) return true;
    const identity = this.identity(context);
    await this.plans.assertCapabilities(identity.organizationId, required, {
      userId: identity.id,
      businessUnitIds: identity.businessUnitIds,
    });
    return true;
  }
}
