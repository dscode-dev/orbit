"use client";

/**
 * A sessão pode ver esta ação?
 *
 * A ponte entre o Action Registry e a tela. Responde três coisas — se a ação
 * existe, se o plano e o papel a liberam, e por que não, quando não — e para
 * por aí.
 *
 * **Não executa.** O `onClick` continua sendo o `useApiMutation` que a tela já
 * tem. Amarrar execução aqui exigiria que o registry conhecesse serviços, e
 * ele voltaria a ser o lugar onde a regra de negócio se esconde.
 *
 * ```tsx
 * const duplicate = useAction("artifact-template.duplicate");
 * if (!duplicate.allowed) return null;
 * return <Button onClick={() => mutation.mutate()}>{duplicate.label}</Button>;
 * ```
 */
import { useSession } from "@/providers/session-provider";
import { accessBlockReason, allowsAccess } from "@/registry";
import {
  actionsFor,
  resolveAction,
  type ActionDefinition,
  type ActionSurface,
} from "./action-registry";
import type { EntityId } from "@/entities/entity-registry";

export interface ActionState {
  readonly definition: ActionDefinition;
  readonly label: string;
  /** `true` quando vale oferecer o botão. */
  readonly allowed: boolean;
  /** Por que não aparece — `null` quando está liberado. */
  readonly blockReason: string | null;
  /** Pede confirmação antes de executar. */
  readonly destructive: boolean;
  readonly confirm: ActionDefinition["confirm"];
}

export function useAction(id: string): ActionState {
  const session = useSession();
  const definition = resolveAction(id);

  return {
    definition,
    label: definition.label,
    allowed: allowsAccess(definition, session),
    blockReason: accessBlockReason(definition, session),
    destructive: definition.destructive ?? false,
    confirm: definition.confirm,
  };
}

/**
 * As ações de uma entidade que esta sessão pode ver, numa superfície.
 *
 * É o que um menu de linha consome: pede as ações de `row`, recebe as
 * permitidas, e desenha. Nenhuma tela lista ação por nome.
 */
export function useEntityActions(
  entity: EntityId,
  surface?: ActionSurface,
): readonly ActionDefinition[] {
  const session = useSession();
  return actionsFor(entity, surface).filter((action) =>
    allowsAccess(action, session),
  );
}
