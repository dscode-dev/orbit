"use client";

/**
 * Recusa do servidor, apresentada como veio.
 *
 * O backend é a autoridade sobre unicidade de chave, propriedade do template e
 * validade da estrutura. Quando ele recusa, a mensagem dele é o que interessa —
 * traduzir para um texto genérico esconderia justamente o motivo.
 *
 * 403 tem tratamento próprio porque não é falha: é ausência de acesso, e
 * "tentar novamente" não muda nada.
 */
import { Lock, TriangleAlert } from "lucide-react";

import { ApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

export function MutationError({
  error,
  className,
}: {
  error: unknown;
  className?: string;
}) {
  if (!error) return null;
  const apiError = error instanceof ApiError ? error : null;
  const forbidden = apiError?.isForbidden ?? false;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        forbidden
          ? "border-border bg-surface-strong text-muted-foreground"
          : "border-destructive/40 bg-destructive/10 text-destructive",
        className,
      )}
    >
      {forbidden ? (
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 space-y-1">
        <p className="break-words">
          {apiError?.message ?? "Não foi possível concluir a operação."}
        </p>
        {apiError?.requestId ? (
          <p className="text-xs opacity-70">Requisição {apiError.requestId}</p>
        ) : null}
      </div>
    </div>
  );
}
