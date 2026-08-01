"use client";

/**
 * Guards de rota.
 *
 * Todos compartilham o `SessionGate`: resolvem a sessão uma única vez (cache
 * do TanStack Query) e decidem entre liberar, redirecionar ou bloquear.
 *
 * ```tsx
 * // app/(app)/operacoes/page.tsx
 * <RequireAuth>
 *   <RequireCapability capability="operations.read">
 *     <OperationsPage />
 *   </RequireCapability>
 * </RequireAuth>
 * ```
 *
 * A autorização efetiva continua no backend: os guards evitam expor telas
 * inúteis, não substituem os guards do NestJS.
 */
import type { ReactNode } from "react";

import { useLogout } from "@/hooks/api/use-auth";
import { useSession } from "@/providers/session-provider";
import { ROUTES, homeRouteFor, loginUrl, LoginReason } from "@/lib/routes";
import { PLATFORM_ADMIN_ROLE } from "@/types/session";
import { SessionGate, type GuardDecision } from "./session-gate";
import {
  CapabilityDenied,
  OrganizationRequired,
  PermissionDenied,
  SubscriptionBlocked,
} from "./session-states";

export { SessionGate, type GuardDecision } from "./session-gate";
export {
  CapabilityDenied,
  OrganizationRequired,
  PermissionDenied,
  SessionLoading,
  SubscriptionBlocked,
} from "./session-states";

const ALLOW: GuardDecision = { kind: "allow" };

export interface GuardProps {
  children: ReactNode;
  /** Substitui o estado padrão de bloqueio. */
  fallback?: ReactNode;
}

/**
 * Exige sessão ativa.
 *
 * Também encaminha o Platform Administrator para o painel da plataforma: ele
 * não tem organização e as rotas de tenant responderiam 403.
 */
export function RequireAuth({
  children,
  fallback,
  requireOrganization = true,
}: GuardProps & { requireOrganization?: boolean }) {
  return (
    <SessionGate
      fallback={fallback ?? <OrganizationRequired />}
      decide={(session) => {
        if (!session.isAuthenticated) {
          return { kind: "redirect", to: loginUrl(LoginReason.expired) };
        }
        if (session.requiresPasswordChange) {
          return {
            kind: "redirect",
            to: `${ROUTES.resetPassword}?motivo=obrigatorio`,
          };
        }
        if (
          requireOrganization &&
          session.isPlatformAdmin &&
          !session.organization
        ) {
          return { kind: "redirect", to: ROUTES.platform };
        }
        if (requireOrganization && !session.scope.organizationId) {
          return { kind: "block" };
        }
        return ALLOW;
      }}
    >
      {children}
    </SessionGate>
  );
}

/** Exige visitante — usuário autenticado vai para a home do seu tipo de conta. */
export function RequireGuest({ children }: { children: ReactNode }) {
  return (
    <SessionGate
      decide={(session) =>
        session.isAuthenticated
          ? {
              kind: "redirect",
              to: homeRouteFor({ isPlatformAdmin: session.isPlatformAdmin }),
            }
          : ALLOW
      }
    >
      {children}
    </SessionGate>
  );
}

/** Exige permissão (mesma chave usada em `@Permissions(...)` no backend). */
export function RequirePermission({
  children,
  permission,
  fallback,
}: GuardProps & { permission: string | readonly string[] }) {
  const required = typeof permission === "string" ? [permission] : permission;
  return (
    <SessionGate
      fallback={fallback ?? <PermissionDenied />}
      decide={(session) => {
        if (!session.isAuthenticated) {
          return { kind: "redirect", to: loginUrl(LoginReason.expired) };
        }
        return required.every(session.hasPermission)
          ? ALLOW
          : { kind: "block" };
      }}
    >
      {children}
    </SessionGate>
  );
}

/** Exige papel (mesma chave usada em `@Roles(...)` no backend). */
export function RequireRole({
  children,
  role,
  fallback,
}: GuardProps & { role: string | readonly string[] }) {
  const required = typeof role === "string" ? [role] : role;
  return (
    <SessionGate
      fallback={fallback ?? <PermissionDenied />}
      decide={(session) => {
        if (!session.isAuthenticated) {
          return { kind: "redirect", to: loginUrl(LoginReason.expired) };
        }
        return required.some(session.hasRole) ? ALLOW : { kind: "block" };
      }}
    >
      {children}
    </SessionGate>
  );
}

/**
 * Exige módulo habilitado pelo plano.
 *
 * `capability` é a mesma chave validada por `@Capabilities(...)` no backend
 * (ex.: `operations.read`), vinda de `plan.capabilities`.
 */
export function RequireCapability({
  children,
  capability,
  fallback,
}: GuardProps & { capability: string | readonly string[] }) {
  const required = typeof capability === "string" ? [capability] : capability;
  return (
    <SessionGate
      fallback={fallback ?? <CapabilityDenied />}
      decide={(session) => {
        if (!session.isAuthenticated) {
          return { kind: "redirect", to: loginUrl(LoginReason.expired) };
        }
        return required.every(session.hasCapability)
          ? ALLOW
          : { kind: "block" };
      }}
    >
      {children}
    </SessionGate>
  );
}

/**
 * Estado de assinatura bloqueada, com o status vindo da sessão.
 *
 * Fica em um componente próprio porque precisa de hooks — o `fallback` do
 * `SessionGate` é renderizado dentro dos providers.
 */
function SubscriptionFallback() {
  const session = useSession();
  const logout = useLogout();
  return (
    <SubscriptionBlocked
      status={session.entitlements?.subscriptionStatus}
      onSignOut={() => logout.mutate()}
    />
  );
}

/** Exige assinatura em estado que libera o produto. */
export function RequireActiveSubscription({ children, fallback }: GuardProps) {
  return (
    <SessionGate
      fallback={fallback ?? <SubscriptionFallback />}
      decide={(session) => {
        if (!session.isAuthenticated) {
          return { kind: "redirect", to: loginUrl(LoginReason.expired) };
        }
        return session.subscriptionActive ? ALLOW : { kind: "block" };
      }}
    >
      {children}
    </SessionGate>
  );
}

/** Exige o papel global do administrador da plataforma. */
export function RequirePlatformAdmin({ children, fallback }: GuardProps) {
  return (
    <SessionGate
      fallback={fallback ?? <PermissionDenied />}
      decide={(session) => {
        if (!session.isAuthenticated) {
          return { kind: "redirect", to: loginUrl(LoginReason.expired) };
        }
        return session.hasRole(PLATFORM_ADMIN_ROLE)
          ? ALLOW
          : { kind: "redirect", to: ROUTES.dashboard };
      }}
    >
      {children}
    </SessionGate>
  );
}
