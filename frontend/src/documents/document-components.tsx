"use client";

/**
 * Apresentação de documentos.
 *
 * A porta que os componentes usam. Nenhum deles escolhe ícone, cor ou rótulo
 * de formato, renderizador ou estado por conta própria.
 */
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  resolveFormat,
  resolveRenderStatus,
  resolveRenderer,
} from "./document-registry";

export function DocumentFormatBadge({
  format,
  className,
}: {
  format: string;
  className?: string;
}) {
  const definition = resolveFormat(format);
  return (
    <Badge variant="secondary" className={cn("gap-1.5", className)}>
      <definition.icon
        className={cn("size-3", definition.color)}
        aria-hidden
      />
      {definition.label}
    </Badge>
  );
}

/**
 * Crachá do estado de renderização.
 *
 * O ícone gira enquanto o servidor trabalha — é a única animação, e ela
 * significa algo: há trabalho em curso.
 */
export function RenderStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const definition = resolveRenderStatus(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        definition.badgeClass,
        className,
      )}
      title={definition.description}
    >
      <definition.icon
        className={cn("size-3", definition.inFlight && "animate-spin")}
        aria-hidden
      />
      {definition.label}
    </span>
  );
}

export function RendererLabel({
  renderer,
  version,
  className,
}: {
  renderer: string;
  version?: string | null;
  className?: string;
}) {
  const definition = resolveRenderer(renderer);
  return (
    <span className={cn("text-sm", className)}>
      {definition.label}
      {version ? (
        <span className="ml-1 font-mono text-xs text-muted-foreground">
          v{version}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Hash de conteúdo.
 *
 * Mostrado abreviado com o valor inteiro no título: o que importa na tela é
 * poder conferir, não ocupar a linha com 64 caracteres.
 */
export function ContentHash({
  hash,
  className,
}: {
  hash: string | null;
  className?: string;
}) {
  if (!hash) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        sem conteúdo
      </span>
    );
  }
  return (
    <span
      className={cn("font-mono text-xs text-muted-foreground", className)}
      title={hash}
    >
      {hash.slice(0, 12)}…{hash.slice(-8)}
    </span>
  );
}
