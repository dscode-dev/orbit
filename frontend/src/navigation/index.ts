/**
 * Navigation Core — destinos, trilha e paleta.
 *
 * `import { entityCrumbs, Breadcrumbs } from "@/navigation";`
 *
 * A regra: **nenhuma rota é montada à mão.** Ver `docs/workspace-core.md`.
 */
export {
  ROUTES,
  crumbs,
  entityCrumbs,
  entityTargets,
  homeRouteFor,
  type Crumb,
  type NavigationIcon,
  type NavigationTarget,
} from "./navigation-core";
export { Breadcrumbs } from "./breadcrumbs";
