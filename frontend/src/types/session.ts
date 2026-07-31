/**
 * Contratos de sessão trafegados entre o BFF e o browser.
 *
 * Os tokens JWT nunca chegam ao browser: ficam em cookies `HttpOnly`.
 * O que o cliente recebe é apenas o estado derivado da sessão.
 */
import type { BusinessUnitType, UserStatus } from "./contracts";

/** Clientes aceitos por `LoginDto`/`RegisterOrganizationDto`. */
export type IdentityClient = "WEB" | "MOBILE" | "API";

/** Par de tokens retornado por `/identity/login`, `/register` e `/refresh`. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

/** Claims do access token (`backend/src/modules/identity/domain/identity.types.ts`). */
export interface AccessTokenClaims {
  sub: string;
  sid: string;
  organizationId: string | null;
  businessUnitId: string | null;
  businessUnitIds: readonly string[];
  roles: readonly string[];
  permissions: readonly string[];
  type: "access";
  exp?: number;
  iat?: number;
}

/** Perfil retornado por `GET /identity/me`. */
export interface SessionUser {
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

/** Escopo multi-tenant ativo, derivado das claims do access token. */
export interface SessionScope {
  organizationId: string | null;
  businessUnitId: string | null;
  businessUnitIds: readonly string[];
}

export interface AuthenticatedSession {
  authenticated: true;
  user: SessionUser;
  scope: SessionScope;
  roles: readonly string[];
  permissions: readonly string[];
  sessionId: string;
  expiresAt: string | null;
}

export interface AnonymousSession {
  authenticated: false;
}

export type SessionState = AuthenticatedSession | AnonymousSession;

export const ANONYMOUS_SESSION: AnonymousSession = { authenticated: false };

/** Espelha `LoginDto`. */
export interface LoginInput {
  email: string;
  password: string;
  mfaCode?: string;
  client?: IdentityClient;
  deviceId?: string;
}

/** Espelha `RegisterOrganizationDto`. */
export interface RegisterInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  organizationName: string;
  legalName: string;
  documentType: "CPF" | "CNPJ";
  documentNumber: string;
  city: string;
  street: string;
  stateCode: string;
  primarySegment?: string;
  planKey?: string;
  businessUnitType?: BusinessUnitType;
  client?: IdentityClient;
  deviceId?: string;
}
