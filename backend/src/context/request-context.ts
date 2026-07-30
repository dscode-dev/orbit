import type { IRequestContext } from '../contracts';

export class RequestContext implements IRequestContext {
  readonly requestId: IRequestContext['requestId'];
  readonly userId: IRequestContext['userId'];
  readonly organizationId: IRequestContext['organizationId'];
  readonly businessUnitId: IRequestContext['businessUnitId'];
  readonly businessUnitIds: IRequestContext['businessUnitIds'];
  readonly roles: IRequestContext['roles'];
  readonly permissions: IRequestContext['permissions'];
  readonly ip: IRequestContext['ip'];
  readonly userAgent: IRequestContext['userAgent'];
  readonly locale: IRequestContext['locale'];

  constructor(values: IRequestContext) {
    this.requestId = values.requestId;
    this.userId = values.userId;
    this.organizationId = values.organizationId;
    this.businessUnitId = values.businessUnitId;
    this.businessUnitIds = Object.freeze([...values.businessUnitIds]);
    this.roles = Object.freeze([...values.roles]);
    this.permissions = Object.freeze([...values.permissions]);
    this.ip = values.ip;
    this.userAgent = values.userAgent;
    this.locale = values.locale;
  }
}
