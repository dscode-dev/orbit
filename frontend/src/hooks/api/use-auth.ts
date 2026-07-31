"use client";

/**
 * Autenticação no browser.
 *
 * Encapsula as chamadas ao BFF, a sincronização do cache e a navegação —
 * as telas só disparam `login.mutate(...)`.
 */
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { queryKeys } from "@/api/query-keys";
import { useSession } from "@/providers/session-provider";
import { authService, type AuthResult } from "@/services/auth.service";
import type { LoginInput, RegisterInput } from "@/types/session";
import { useApiMutation } from "./use-api-mutation";

export interface AuthNavigationOptions {
  /** Destino após o sucesso. Padrão: `/dashboard`. */
  redirectTo?: string;
}

export function useLogin(options: AuthNavigationOptions = {}) {
  const router = useRouter();
  const session = useSession();
  const redirectTo = options.redirectTo ?? "/dashboard";

  return useApiMutation<AuthResult, LoginInput>(
    (input) => authService.login(input),
    {
      invalidate: [queryKeys.session()],
      onSuccess: async () => {
        await session.refresh();
        router.replace(redirectTo);
        router.refresh();
      },
    },
  );
}

export function useRegister(options: AuthNavigationOptions = {}) {
  const router = useRouter();
  const session = useSession();
  const redirectTo = options.redirectTo ?? "/dashboard";

  return useApiMutation<AuthResult, RegisterInput>(
    (input) => authService.register(input),
    {
      invalidate: [queryKeys.session()],
      onSuccess: async () => {
        await session.refresh();
        router.replace(redirectTo);
        router.refresh();
      },
    },
  );
}

export function useLogout(options: { redirectTo?: string } = {}) {
  const router = useRouter();
  const session = useSession();
  const redirectTo = options.redirectTo ?? "/login";

  const finish = useCallback(() => {
    session.clear();
    router.replace(redirectTo);
    router.refresh();
  }, [redirectTo, router, session]);

  return useApiMutation<AuthResult, void>(() => authService.logout(), {
    onSuccess: finish,
    /** Falha ao revogar no backend não deve prender o usuário na sessão. */
    onError: finish,
  });
}
