/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

export interface CustomerPortalOrganizationReadModel {
  id: string;
  slug: string;
  displayName: string;
}

export interface CustomerPortalCustomerReadModel {
  id: string;
  displayName: string;
}

export interface CustomerPortalIdentityReadModel {
  id: string;
  displayName: string;
  email: string;
  status: 'invited' | 'active' | 'disabled';
  contactId: string | null;
}

export interface CustomerPortalMeReadModel {
  actorType: 'CUSTOMER_PORTAL';
  identity: CustomerPortalIdentityReadModel;
  organization: CustomerPortalOrganizationReadModel;
  customer: CustomerPortalCustomerReadModel;
  sessionId: string;
}

export interface CustomerPortalSessionReadModel {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  me: CustomerPortalMeReadModel;
}

export interface CustomerPortalInvitationReadModel {
  id: string;
  identityId: string;
  customerId: string;
  displayName: string;
  email: string;
  expiresAt: string;
  status: 'invited';
}

export interface PortalMessageReadModel {
  message: string;
}
