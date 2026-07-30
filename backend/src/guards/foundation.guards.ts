import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IAuthenticatedUser, IRequestContext } from '../contracts';
import { PERMISSIONS_KEY, PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { ForbiddenException, UnauthorizedException } from '../exceptions';

interface GuardRequest {
  user?: IAuthenticatedUser;
  requestContext?: IRequestContext;
}

const getRequest = (context: ExecutionContext): GuardRequest =>
  context.switchToHttp().getRequest<GuardRequest>();

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (!getRequest(context).user) throw new UnauthorizedException();
    return true;
  }
}

abstract class MetadataGuard {
  constructor(protected readonly reflector: Reflector) {}

  protected required(
    context: ExecutionContext,
    key: string,
  ): readonly string[] {
    return (
      this.reflector.getAllAndOverride<readonly string[]>(key, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }
}

@Injectable()
export class PermissionGuard extends MetadataGuard implements CanActivate {
  constructor(reflector: Reflector) {
    super(reflector);
  }

  canActivate(context: ExecutionContext): boolean {
    const required = this.required(context, PERMISSIONS_KEY);
    const granted =
      getRequest(context).requestContext?.permissions ??
      getRequest(context).user?.permissions ??
      [];
    if (!required.every((permission) => granted.includes(permission))) {
      throw new ForbiddenException('Missing required permission');
    }
    return true;
  }
}

@Injectable()
export class RoleGuard extends MetadataGuard implements CanActivate {
  constructor(reflector: Reflector) {
    super(reflector);
  }

  canActivate(context: ExecutionContext): boolean {
    const required = this.required(context, ROLES_KEY);
    const granted =
      getRequest(context).requestContext?.roles ??
      getRequest(context).user?.roles ??
      [];
    if (
      required.length > 0 &&
      !required.some((role) => granted.includes(role))
    ) {
      throw new ForbiddenException('Missing required role');
    }
    return true;
  }
}

@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!getRequest(context).requestContext?.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return true;
  }
}

@Injectable()
export class BusinessUnitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!getRequest(context).requestContext?.businessUnitId) {
      throw new ForbiddenException('Business unit context is required');
    }
    return true;
  }
}
