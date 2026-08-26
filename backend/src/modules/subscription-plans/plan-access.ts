import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UUID } from '../../contracts';
import { PUBLIC_KEY } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { classifyInternalError, internalErrorStack } from '../../errors';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import type { AuthenticatedIdentity } from '../identity/domain/identity.types';
import type { OrganizationEntitlements } from './subscription-plan.service';
import { SubscriptionPlanService } from './subscription-plan.service';

export const REQUIRED_PLAN_KEY = 'subscription:required-plan';
export const REQUIRED_CAPABILITIES_KEY = 'subscription:required-capabilities';
export const ACTIVE_PLAN_KEY = 'subscription:active';

export const RequiresPlan = (...plans: string[]) =>
  SetMetadata(REQUIRED_PLAN_KEY, plans);

export const Capabilities = (...capabilities: string[]) =>
  SetMetadata(REQUIRED_CAPABILITIES_KEY, capabilities);

export const RequiresActivePlan = () => SetMetadata(ACTIVE_PLAN_KEY, true);

/**
 * Onde a resposta do plano fica guardada durante a requisição.
 *
 * Três guardas perguntam a **mesma** coisa sobre a **mesma** organização na
 * mesma requisição: se a assinatura está ativa, se o plano é aceito, se a
 * capacidade existe. Cada pergunta abria uma transação interativa própria —
 * três conexões do pool e três janelas de tempo limite para atravessar antes de
 * o handler começar.
 *
 * Guardar a promessa (não o valor) no objeto da requisição resolve as três com
 * uma transação. É memoização de escopo de requisição: nasce e morre com ela,
 * então não há como servir o plano de um inquilino a outro.
 */
const ENTITLEMENTS = Symbol('orbit:entitlements');

interface RequestWithEntitlements extends IdentityRequest {
  [ENTITLEMENTS]?: Promise<OrganizationEntitlements>;
}

abstract class PlanMetadataGuard {
  private readonly logger = new Logger(PlanMetadataGuard.name);
  constructor(
    protected readonly reflector: Reflector,
    protected readonly plans: SubscriptionPlanService,
  ) {}

  /**
   * As permissões de plano desta requisição, resolvidas uma vez só.
   *
   * A promessa é guardada antes de ser aguardada, então dois guardas que
   * corram juntos compartilham a mesma resolução em vez de disputarem duas
   * transações.
   */
  protected entitlements(
    context: ExecutionContext,
  ): Promise<OrganizationEntitlements> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithEntitlements>();
    const identity = this.identity(context);

    request[ENTITLEMENTS] ??= this.plans.getEntitlements(
      identity.organizationId,
      {
        userId: identity.id,
        businessUnitIds: identity.businessUnitIds ?? [],
      },
    );

    return request[ENTITLEMENTS];
  }

  protected async guardedEntitlements(
    context: ExecutionContext,
    guard: string,
  ): Promise<OrganizationEntitlements> {
    try {
      return await this.entitlements(context);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const request = context
        .switchToHttp()
        .getRequest<RequestWithEntitlements>();
      const classified = classifyInternalError(error);
      const requestId = (request as { id?: unknown }).id;
      this.logger.error(
        JSON.stringify({
          stage: 'guard-internal-error',
          guard,
          method: request.method,
          path: request.path,
          requestId: typeof requestId === 'string' ? requestId : null,
          actorId: request.identity?.id ?? null,
          organizationId: request.identity?.organizationId ?? null,
          errorCategory: classified.category,
          exceptionClass: classified.exceptionClass,
          errorCode: classified.code,
        }),
        internalErrorStack(error),
      );
      throw error;
    }
  }

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
    this.plans.assertActiveOn(
      await this.guardedEntitlements(context, ActivePlanGuard.name),
    );
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
    this.plans.assertPlanOn(
      await this.guardedEntitlements(context, RequiredPlanGuard.name),
      required,
    );
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
    this.plans.assertCapabilitiesOn(
      await this.guardedEntitlements(context, CapabilityGuard.name),
      required,
    );
    return true;
  }
}
