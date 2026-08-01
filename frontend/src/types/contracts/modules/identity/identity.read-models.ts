/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

import type { UserStatus } from '../..';

export interface IdentitySessionReadModel {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface IdentityProfileReadModel {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  locale: string | null;
  timezone: string | null;
  status: UserStatus;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityDeviceSessionReadModel {
  id: string;
  client: string;
  deviceId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  organizationId: string | null;
  businessUnitId: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}
