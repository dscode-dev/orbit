"use client";

/**
 * Provider do TanStack Query.
 *
 * O cliente é criado via `useState` para que cada árvore React tenha o seu —
 * evitando compartilhar cache entre requisições no SSR.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { getQueryClient } from "@/api/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
