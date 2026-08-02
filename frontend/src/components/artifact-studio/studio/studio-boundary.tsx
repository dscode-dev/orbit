"use client";

/**
 * Error Boundary de uma aba do Studio.
 *
 * O editor é a área da aplicação com mais estado local — árvore, seleção,
 * JSON digitado à mão. Uma aba que quebre ao renderizar não pode derrubar as
 * outras, e principalmente não pode derrubar a aba de versões, que é por onde
 * o trabalho é publicado.
 */
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

import { PanelErrorBoundary } from "@/components/panels";

export function StudioBoundary({
  panelId,
  children,
}: {
  panelId: string;
  children: ReactNode;
}) {
  return (
    <PanelErrorBoundary
      panelId={panelId}
      fallback={(error) => (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <TriangleAlert className="size-5 text-destructive" aria-hidden />
          <p className="text-sm font-medium">Esta aba não pôde ser exibida</p>
          <p className="max-w-md text-xs text-muted-foreground">
            {process.env.NODE_ENV === "production"
              ? "As demais abas continuam funcionando, e nada foi publicado."
              : error.message}
          </p>
        </div>
      )}
    >
      {children}
    </PanelErrorBoundary>
  );
}
