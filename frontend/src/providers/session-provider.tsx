"use client";

/**
 * Sessão no browser.
 *
 * Busca `/api/auth/session` (que lê os cookies `HttpOnly` no servidor) e
 * expõe perfil, escopo, papéis e permissões. Tokens nunca chegam até aqui.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { authClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type {
  AuthenticatedSession,
  SessionScope,
  SessionState,
  SessionUser,
} from "@/types/session";
import { ANONYMOUS_SESSION } from "@/types/session";

/** `*` concede todas as permissões (mesma regra do `PermissionGuard`). */
const WILDCARD_PERMISSION = "*";

export interface SessionContextValue {
  session: SessionState;
  user: SessionUser | null;
  scope: SessionScope;
  roles: readonly string[];
  permissions: readonly string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  /** Rebusca a sessão (após trocar unidade, aceitar convite etc.). */
  refresh: () => Promise<void>;
  /** Limpa o estado local — o logout de fato ocorre em `/api/auth/logout`. */
  clear: () => void;
}

const EMPTY_SCOPE: SessionScope = {
  organizationId: null,
  businessUnitId: null,
  businessUnitIds: [],
};

const SessionContext = createContext<SessionContextValue | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
  /** Estado inicial vindo do servidor, quando disponível. */
  initialSession?: SessionState;
}

export function SessionProvider({
  children,
  initialSession,
}: SessionProviderProps) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.session(),
    queryFn: () => authClient.get<SessionState>("/session"),
    initialData: initialSession,
    staleTime: 60_000,
    retry: false,
  });

  const session = query.data ?? ANONYMOUS_SESSION;
  const authenticated = session.authenticated
    ? (session as AuthenticatedSession)
    : null;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.session() });
  }, [queryClient]);

  const clear = useCallback(() => {
    queryClient.setQueryData(queryKeys.session(), ANONYMOUS_SESSION);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(() => {
    const permissions = authenticated?.permissions ?? [];
    const roles = authenticated?.roles ?? [];
    return {
      session,
      user: authenticated?.user ?? null,
      scope: authenticated?.scope ?? EMPTY_SCOPE,
      roles,
      permissions,
      isAuthenticated: Boolean(authenticated),
      isLoading: query.isPending,
      hasPermission: (permission: string) =>
        permissions.includes(WILDCARD_PERMISSION) ||
        permissions.includes(permission),
      hasRole: (role: string) => roles.includes(role),
      refresh,
      clear,
    };
  }, [authenticated, clear, query.isPending, refresh, session]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession precisa estar dentro de <SessionProvider>.");
  }
  return context;
}

/** Versão tolerante — devolve `null` fora do provider (ex.: páginas públicas). */
export function useOptionalSession(): SessionContextValue | null {
  return useContext(SessionContext);
}
