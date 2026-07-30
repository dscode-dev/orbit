import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../../context';

export interface RlsContext {
  userId: string;
  organizationId: string;
  businessUnitId: string;
  businessUnitIds: string;
  roles: string;
  permissions: string;
  isPlatformAdmin: string;
}

@Injectable()
export class RlsContextProvider {
  constructor(private readonly contexts: RequestContextService) {}

  get(): RlsContext {
    const context = this.contexts.get();
    return {
      userId: context.userId ?? '',
      organizationId: context.organizationId ?? '',
      businessUnitId: context.businessUnitId ?? '',
      businessUnitIds: context.businessUnitIds.join(','),
      roles: context.roles.join(','),
      permissions: context.permissions.join(','),
      isPlatformAdmin: String(context.roles.includes('PLATFORM_ADMIN')),
    };
  }
}
