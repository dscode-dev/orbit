"use client";

/**
 * Leitura visual dos literais do template.
 *
 * Um só lugar para status, visibilidade e origem — as telas não repetem mapas
 * nem `switch`. Valores desconhecidos são exibidos crus em vez de traduzidos
 * para um rótulo genérico: `status` e `visibility` são `varchar` com
 * `CHECK` no banco, e um valor novo do backend deve aparecer, não sumir.
 */
import { cn } from "@/lib/utils";

const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

const STATUS_CLASSES: Readonly<Record<string, string>> = {
  DRAFT: "bg-surface-strong text-muted-foreground",
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  INACTIVE: "bg-amber-500/15 text-amber-400",
};

const VISIBILITY_LABELS: Readonly<Record<string, string>> = {
  PRIVATE: "Privado",
  ORGANIZATION: "Organização",
  GLOBAL: "Global",
};

export function templateStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function templateVisibilityLabel(visibility: string): string {
  return VISIBILITY_LABELS[visibility] ?? visibility;
}

export function TemplateStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status] ?? "bg-surface-strong text-muted-foreground",
        className,
      )}
    >
      {templateStatusLabel(status)}
    </span>
  );
}

/**
 * Marca de template da plataforma.
 *
 * `organizationId` nulo significa template global: o backend responde 403 a
 * qualquer alteração (`Global and external templates are read-only`). Sinalizar
 * antes evita que alguém edite por vinte minutos para descobrir na hora de
 * publicar.
 */
export function isPlatformTemplate(template: {
  organizationId: string | null;
}): boolean {
  return template.organizationId === null;
}

export function PlatformTemplateBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary",
        className,
      )}
    >
      Plataforma
    </span>
  );
}
