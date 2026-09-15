"use client";

/**
 * O que o servidor já sabe sobre o aviso de assinatura.
 *
 * Um contexto minúsculo só para levar um booleano do layout raiz até o shell
 * sem atravessar `WorkspacePage` — que é usado por dezenas de páginas e não
 * deveria ganhar um parâmetro sobre cobrança para repassá-lo adiante.
 *
 * Mora no layout raiz, e não no shell, pela mesma lição do menu: o shell é
 * montado por página e remonta a cada navegação.
 */
import { createContext, useContext, type ReactNode } from "react";

const Contexto = createContext(false);

export function SubscriptionNoticeProvider({
  dispensado,
  children,
}: {
  dispensado: boolean;
  children: ReactNode;
}) {
  return <Contexto.Provider value={dispensado}>{children}</Contexto.Provider>;
}

/** `false` fora do provider: na dúvida, avisa. */
export function useAvisoDispensado(): boolean {
  return useContext(Contexto);
}
