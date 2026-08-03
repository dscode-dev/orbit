"use client";

/**
 * Apresentação dos tipos de artefato.
 *
 * A porta que os componentes usam para exibir um `artifactType`. Nenhum deles
 * escolhe ícone, cor ou rótulo por conta própria — e nenhum compara o tipo com
 * string.
 */
import {
  resolveTemplateType,
  TEMPLATE_TYPE_CATEGORY_LABELS,
  type TemplateTypeDefinition,
} from "./template-type-registry";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TemplateTypeIcon({
  artifactType,
  className,
}: {
  artifactType: string;
  className?: string;
}) {
  const type = resolveTemplateType(artifactType);
  return (
    <type.icon
      className={cn("size-4 shrink-0", type.color, className)}
      aria-hidden
    />
  );
}

/** Nome do tipo com o ícone, para tabelas e cabeçalhos. */
export function TemplateTypeLabel({
  artifactType,
  className,
  showCategory = false,
}: {
  artifactType: string;
  className?: string;
  showCategory?: boolean;
}) {
  const type = resolveTemplateType(artifactType);
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <TemplateTypeIcon artifactType={artifactType} />
      <span className="truncate">{type.name}</span>
      {showCategory ? (
        <Badge variant="outline" className="text-[10px]">
          {TEMPLATE_TYPE_CATEGORY_LABELS[type.category]}
        </Badge>
      ) : null}
    </span>
  );
}

/**
 * Crachá do tipo.
 *
 * Um tipo não registrado aparece com o identificador humanizado — a ausência
 * de registro é visível para quem administra, não escondida de quem usa.
 */
export function TemplateTypeBadge({
  artifactType,
  className,
}: {
  artifactType: string;
  className?: string;
}) {
  const type = resolveTemplateType(artifactType);
  return (
    <Badge variant="secondary" className={cn("gap-1.5", className)}>
      <type.icon className={cn("size-3", type.color)} aria-hidden />
      {type.name}
    </Badge>
  );
}

/** Cartão descritivo — usado na escolha do tipo ao criar um template. */
export function TemplateTypeCard({
  type,
  selected,
  onSelect,
}: {
  type: TemplateTypeDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-border hover:bg-surface-strong",
      )}
    >
      <type.icon
        className={cn("mt-0.5 size-4 shrink-0", type.color)}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{type.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {TEMPLATE_TYPE_CATEGORY_LABELS[type.category]}
          </Badge>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {type.description}
        </span>
      </span>
    </button>
  );
}
