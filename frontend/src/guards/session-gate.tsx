"use client";

/**
 * Base dos guards de rota.
 *
 * Um guard resolve a sessão, decide entre liberar, redirecionar ou bloquear, e
 * nunca pisca conteúdo protegido: enquanto a sessão carrega, renderiza o
 * estado de carregamento.
 *
 * Toda a proteção real está no backend — os guards existem para navegação e
 * para não expor telas que o usuário não conseguiria usar.
 */
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/providers/session-provider";
import { SessionLoading } from "./session-states";

export type GuardDecision =
  { kind: "allow" } | { kind: "redirect"; to: string } | { kind: "block" };

export interface SessionGateProps {
  children: ReactNode;
  /** Avaliada apenas depois que a sessão terminou de carregar. */
  decide: (session: ReturnType<typeof useSession>) => GuardDecision;
  /** Exibido quando a decisão é `block`. */
  fallback?: ReactNode;
  /** Exibido enquanto a sessão carrega. */
  loading?: ReactNode;
}

export function SessionGate({
  children,
  decide,
  fallback = null,
  loading,
}: SessionGateProps) {
  const session = useSession();
  const router = useRouter();
  const decision: GuardDecision = session.isLoading
    ? { kind: "block" }
    : decide(session);
  const redirectTo = decision.kind === "redirect" ? decision.to : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (session.isLoading) return <>{loading ?? <SessionLoading />}</>;
  /** Durante o redirecionamento nada do conteúdo protegido é montado. */
  if (redirectTo) return <>{loading ?? <SessionLoading />}</>;
  if (decision.kind === "block") return <>{fallback}</>;
  return <>{children}</>;
}
