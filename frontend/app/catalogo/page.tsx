import { CatalogWorkspace } from "@/components/catalog/catalog-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Catalog Workspace — produtos, serviços e peças.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. Título,
 * descrição e capability vêm do Entity Registry — `catalog.read` é a mesma que
 * o backend exige em `@Capabilities`.
 *
 * `contained={false}` porque as abas gerenciam a própria largura.
 */
export default function CatalogPage() {
  return (
    <WorkspacePage
      entity="catalog-item"
      contained={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("catalog-item")} />}
    >
      <CatalogWorkspace />
    </WorkspacePage>
  );
}
