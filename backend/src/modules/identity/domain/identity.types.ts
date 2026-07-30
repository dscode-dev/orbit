import type { UUID } from '../../../contracts';

export interface AccessTokenClaims {
  sub: UUID;
  sid: UUID;
  organizationId: UUID | null;
  businessUnitId: UUID | null;
  businessUnitIds: readonly UUID[];
  roles: readonly string[];
  permissions: readonly string[];
  type: 'access';
}

export interface AuthenticatedIdentity {
  id: UUID;
  sessionId: UUID;
  organizationId: UUID | null;
  businessUnitId: UUID | null;
  businessUnitIds: readonly UUID[];
  roles: readonly string[];
  permissions: readonly string[];
}

export interface SessionMetadata {
  client: string;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export const IdentityTokenPurpose = {
  INVITATION: 'INVITATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;
export type IdentityTokenPurpose =
  (typeof IdentityTokenPurpose)[keyof typeof IdentityTokenPurpose];

export interface IIdentityTokenDelivery {
  deliver(
    purpose: IdentityTokenPurpose,
    recipient: string,
    token: string,
  ): Promise<void>;
}

export const IDENTITY_TOKEN_DELIVERY = Symbol('IDENTITY_TOKEN_DELIVERY');
