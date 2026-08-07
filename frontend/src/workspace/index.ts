/**
 * Workspace Core — o que todo Workspace repete.
 *
 * `import { WorkspacePage, useListController, Pagination } from "@/workspace";`
 *
 * A regra: **nenhum Workspace mantém implementação própria do que existe
 * aqui**. Filtro, busca, paginação, contagem, estados de carga e o esqueleto
 * de página têm um dono, e é este módulo.
 *
 * O que continua de cada Workspace: quais filtros oferecer, o que cada linha
 * mostra, e como a tela conta a sua própria história. O Core cuida da moldura.
 *
 * Ver `docs/workspace-core.md`.
 */
export {
  ANY_OPTION,
  SEARCH_DEBOUNCE_MS,
  fromAnyOption,
  toAnyOption,
  useListController,
  type BaseListQuery,
  type ListController,
  type ListControllerOptions,
} from "./use-list-controller";
export {
  FilterBar,
  FilterSelect,
  ListState,
  Pagination,
  ResultSummary,
  SearchField,
  optionsFrom,
  type FilterOption,
  type ListMeta,
} from "./list-primitives";
export { MetricCard, type MetricCardProps } from "./metric-card";
export { TabBoundary } from "./tab-boundary";
export { WorkspacePage, type WorkspacePageProps } from "./workspace-page";
