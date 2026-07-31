"use client";

/**
 * Composição dos providers do Frontend Core.
 *
 * Ordem obrigatória: Query → Session → RequestContext. A sessão depende do
 * cache do Query; o contexto multi-tenant depende do escopo da sessão.
 *
 * Providers de UI (Tooltip, Toaster) continuam em `app/providers.tsx` e não
 * são tocados por esta camada.
 */
import type { ReactNode } from "react";

import type { SessionState } from "@/types/session";
import { QueryProvider } from "./query-provider";
import { RequestContextProvider } from "./request-context-provider";
import { SessionProvider } from "./session-provider";

export interface AppProvidersProps {
  children: ReactNode;
  /** Sessão resolvida no servidor, quando a rota já a conhece. */
  initialSession?: SessionState;
}

export function AppProviders({ children, initialSession }: AppProvidersProps) {
  return (
    <QueryProvider>
      <SessionProvider initialSession={initialSession}>
        <RequestContextProvider>{children}</RequestContextProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
