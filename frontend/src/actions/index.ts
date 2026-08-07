/**
 * Action Registry — o catálogo do que se pode fazer com uma entidade.
 *
 * `import { useAction, actionsFor } from "@/actions";`
 *
 * Ver `docs/action-registry.md`.
 */
export {
  ACTION_CATEGORIES,
  ACTION_SURFACES,
  actionsFor,
  allActions,
  getAction,
  resolveAction,
  type ActionCategory,
  type ActionDefinition,
  type ActionIcon,
  type ActionSurface,
} from "./action-registry";
export { useAction, useEntityActions, type ActionState } from "./use-action";
