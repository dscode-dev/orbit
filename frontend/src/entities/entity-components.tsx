"use client";

/**
 * Componentes que consomem o Entity Registry.
 *
 * Nenhum deles conhece entidade específica: recebem o `EntityId` e resolvem
 * tudo pelo registry. É o que permite a um painel de "registros relacionados"
 * renderizar operações, execuções e agendamentos com o mesmo código.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { useSession } from "@/providers/session-provider";
import { getAction } from "@/actions/action-registry";
import { accessBlockReason, allowsAccess } from "@/registry";
import { cn } from "@/lib/utils";
import {
  entityBadgeClass,
  entityBadgeLabel,
  entityHref,
  resolveEntity,
  type EntityId,
} from "./entity-registry";

export function EntityIcon({
  entity,
  className,
}: {
  entity: EntityId;
  className?: string;
}) {
  const definition = resolveEntity(entity);
  return (
    <definition.icon
      className={cn("size-4 shrink-0", definition.color, className)}
      aria-hidden
    />
  );
}

/**
 * Link para um registro.
 *
 * Entidade sem tela própria (`href` ausente no registry) rende texto simples —
 * um link que não leva a lugar nenhum é pior que nenhum link.
 */
export function EntityLink({
  entity,
  id,
  children,
  className,
  showIcon = false,
}: {
  entity: EntityId;
  id: string;
  children: ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  const href = entityHref(entity, id);

  if (!href) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        {showIcon ? <EntityIcon entity={entity} /> : null}
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 hover:underline",
        className,
      )}
    >
      {showIcon ? <EntityIcon entity={entity} /> : null}
      {children}
      <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
    </Link>
  );
}

/** Rótulo visual de um atributo categórico, resolvido pelo registry. */
export function EntityBadge({
  entity,
  group,
  value,
  className,
}: {
  entity: EntityId;
  group: string;
  value: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium",
        entityBadgeClass(entity, group, value),
        className,
      )}
    >
      {entityBadgeLabel(entity, group, value)}
    </span>
  );
}

/**
 * A sessão permite oferecer esta ação?
 *
 * **Não é autorização.** O backend decide e recusa; isto evita apresentar um
 * botão que já se sabe que levaria 403.
 *
 * ## Quem responde é o Action Registry
 *
 * `can("update")` resolve `"<entidade>.update"` no Action Registry. Antes, a
 * resposta vinha de uma lista inline em `EntityDefinition.actions` — e as duas
 * listas divergiram: `customer` tinha `actions: []`, então `can("update")` era
 * **sempre falso** e a seção de contatos do Customer Workspace nunca ficava
 * editável, embora `customers.update` exista no backend e o papel a tivesse.
 *
 * Uma fonte só elimina a classe inteira desse defeito.
 */
export function useEntityAccess(entity: EntityId) {
  const session = useSession();
  const definition = resolveEntity(entity);

  const requirement = (actionId: string) => getAction(`${entity}.${actionId}`);

  return {
    definition,
    canRead:
      !definition.capability.read ||
      session.hasCapability(definition.capability.read),
    can: (actionId: string) => allowsAccess(requirement(actionId), session),
    /** Por que não aparece — para explicar em vez de sumir. */
    blockReason: (actionId: string) =>
      accessBlockReason(requirement(actionId), session),
  };
}
