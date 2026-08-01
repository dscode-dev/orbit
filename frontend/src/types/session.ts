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

/** Unidade de negócio devolvida em `GET /organizations/current`. */
export interface SessionBusinessUnit {
  id: string;
  organizationId: string;
  parentId: string | null;
  slug: string;
  code: string | null;
  type: BusinessUnitType;
  isPrimary: boolean;
  legalName: string;
  tradeName: string | null;
  city: string;
  stateCode: string | null;
  timezone: string;
  locale: string;
  currency: string;
  status: string;
}

/** Plano contratado, aninhado em `GET /organizations/current`. */
export interface SessionPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** `Decimal` do Prisma chega ao JSON como string. */
  monthlyPrice: string | number | null;
  annualPrice: string | number | null;
  currency: string;
  capabilities: readonly string[];
  limits: Readonly<Record<string, number | null>>;
  isActive: boolean;
}

/** Organização ativa (`GET /organizations/current`). */
export interface SessionOrganization {
  id: string;
  ownerUserId: string;
  planId: string;
  slug: string;
  displayName: string;
  primarySegment: string;
  status: string;
  subscriptionStatus: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  plan: SessionPlan;
  businessUnits: readonly SessionBusinessUnit[];
}

/**
 * Direitos do plano (`GET /organizations/current/subscription`).
 *
 * `capabilities` é o que o backend valida em `@Capabilities(...)` — no
 * frontend é a fonte de "módulos habilitados".
 */
export interface SessionEntitlements {
  planKey: string;
  subscriptionStatus: string;
  capabilities: readonly string[];
  limits: Readonly<Record<string, number | null>>;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

/** Organização acessível pela sessão. */
export interface SessionOrganizationRef {
  id: string;
  displayName: string;
  slug: string;
  isActive: boolean;
}

export interface AuthenticatedSession {
  authenticated: true;
  user: SessionUser;
  scope: SessionScope;
  roles: readonly string[];
  permissions: readonly string[];
  sessionId: string;
  expiresAt: string | null;
  /** `null` para o Platform Administrator, que não pertence a um tenant. */
  organization: SessionOrganization | null;
  businessUnits: readonly SessionBusinessUnit[];
  /** `null` quando não há contexto de organização ou o plano não respondeu. */
  entitlements: SessionEntitlements | null;
  /**
   * Organizações acessíveis. Hoje o backend deriva uma única organização das
   * claims do token; a lista existe para a troca de organização multi-tenant.
   */
  organizations: readonly SessionOrganizationRef[];
  isPlatformAdmin: boolean;
  /** Assinatura em estado que libera o produto (`TRIALING`/`ACTIVE`/`PAST_DUE`). */
  subscriptionActive: boolean;
  /** Exige definir nova senha antes de usar a plataforma. */
  requiresPasswordChange: boolean;
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

/** Espelha `ForgotPasswordDto`. */
export interface ForgotPasswordInput {
  email: string;
}

/** Espelha `ResetPasswordDto`. */
export interface ResetPasswordInput {
  token: string;
  password: string;
}

/** Espelha `AcceptInvitationDto`. */
export interface AcceptInvitationInput {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

/** Plano publicado em `GET /plans` (rota pública). */
export interface PublicPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPrice: string | number | null;
  annualPrice: string | number | null;
  currency: string;
  capabilities: readonly string[];
  limits: Readonly<Record<string, number | null>>;
  isActive: boolean;
}

/** Papel global do administrador da plataforma. */
export const PLATFORM_ADMIN_ROLE = "PLATFORM_ADMIN";

/** Permissão exigida pelos endpoints `/platform-admin/*`. */
export const PLATFORM_ADMIN_PERMISSION = "platform.admin";

/** Estados de assinatura que liberam o produto (`SubscriptionPlanService`). */
export const ACTIVE_SUBSCRIPTION_STATUSES: readonly string[] = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
];
