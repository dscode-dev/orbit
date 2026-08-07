"use client";

/**
 * Categorias do catálogo.
 *
 * ## Uma árvore, dois consumidores
 *
 * `ProductCategory` é hierárquica (`parentId`) e serve **produtos e serviços
 * ao mesmo tempo** — é a mesma tabela, e `Product.categoryId` aponta para ela
 * independentemente do `kind`. A centralização que a PR pede já existe no
 * contrato; a tela só a torna visível.
 *
 * ## Sem paginação
 *
 * `GET /catalog/categories` devolve o array inteiro, ordenado por nome. É
 * coerente: uma organização tem dezenas de categorias, não milhares, e a
 * árvore precisa estar completa para ser montada.
 *
 * ## A árvore é montada aqui — e isso não é regra de negócio
 *
 * O backend publica a lista plana com `parentId`. Aninhar é apresentação: não
 * há decisão, cálculo nem validação — só o mesmo dado desenhado na forma que
 * ele já declara. Quem valida ciclos e dependências é o servidor.
 */
import { useMemo, useState } from "react";
import { FolderTree, Plus } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/actions";
import {
  useCatalogCategories,
  useRemoveCatalogCategory,
} from "@/hooks/catalog/use-catalog";
import { cn } from "@/lib/utils";
import type { CatalogCategory } from "@/types/catalog";
import { ListState } from "@/workspace";
import { CatalogCategoryFormDialog } from "../catalog-category-form.dialog";

/** Uma categoria e as suas filhas, para desenho. */
interface CategoryNode {
  readonly category: CatalogCategory;
  readonly depth: number;
}

/**
 * Achata a árvore preservando a ordem de leitura.
 *
 * Renderizar aninhado exigiria recursão em JSX; uma lista plana com `depth`
 * dá o mesmo resultado visual e mantém a tabela acessível — cada linha
 * continua sendo uma linha.
 *
 * Categoria cujo pai não veio na lista (removido, ou fora do escopo) aparece
 * na raiz em vez de sumir: um registro que existe precisa ser alcançável.
 */
function flatten(categories: readonly CatalogCategory[]): CategoryNode[] {
  const byParent = new Map<string | null, CatalogCategory[]>();
  const known = new Set(categories.map((category) => category.id));

  for (const category of categories) {
    const parent =
      category.parentId && known.has(category.parentId)
        ? category.parentId
        : null;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(category);
    byParent.set(parent, siblings);
  }

  const nodes: CategoryNode[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const category of byParent.get(parent) ?? []) {
      nodes.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  return nodes;
}

export function CatalogCategoriesTab() {
  const query = useCatalogCategories();
  const create = useAction("catalog-item.create-category");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogCategory | null>(null);
  const [parent, setParent] = useState<CatalogCategory | null>(null);

  const remove = useRemoveCatalogCategory();

  /**
   * `?? []` cria um array novo a cada render, o que faria o `useMemo` abaixo
   * recalcular sempre. Memoizado à parte, a referência só muda quando os dados
   * mudam.
   */
  const categories = useMemo(() => query.data ?? [], [query.data]);
  const nodes = useMemo(() => flatten(categories), [categories]);

  const openNew = (under: CatalogCategory | null) => {
    setEditing(null);
    setParent(under);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          As categorias são compartilhadas por produtos, serviços e peças.
        </p>
        {create.allowed ? (
          <Button size="sm" onClick={() => openNew(null)}>
            <Plus className="size-4" />
            {create.label}
          </Button>
        ) : null}
      </div>

      <MutationError error={remove.error} />

      <ListState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        items={nodes}
        rows={4}
        empty={{
          icon: <FolderTree className="size-5" />,
          title: "Nenhuma categoria",
          description:
            "Categorias organizam produtos e serviços, e são o que os filtros do catálogo usam.",
          action: create.allowed ? (
            <Button size="sm" onClick={() => openNew(null)}>
              <Plus className="size-4" />
              {create.label}
            </Button>
          ) : undefined,
        }}
      >
        {(rows) => (
          <ul className="glass-panel divide-y divide-border rounded-xl">
            {rows.map((node) => (
              <CategoryRow
                key={node.category.id}
                node={node}
                onEdit={() => {
                  setParent(null);
                  setEditing(node.category);
                  setFormOpen(true);
                }}
                onAddChild={() => openNew(node.category)}
                onRemove={() => remove.mutate(node.category.id)}
                removing={
                  remove.isPending && remove.variables === node.category.id
                }
              />
            ))}
          </ul>
        )}
      </ListState>

      <CatalogCategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        parent={parent}
        categories={categories}
      />
    </div>
  );
}

function CategoryRow({
  node,
  onEdit,
  onAddChild,
  onRemove,
  removing,
}: {
  node: CategoryNode;
  onEdit: () => void;
  onAddChild: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const edit = useAction("catalog-item.update-category");
  const create = useAction("catalog-item.create-category");
  const destroy = useAction("catalog-item.delete-category");

  const hasActions = edit.allowed || create.allowed || destroy.allowed;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div
        className="min-w-0 flex-1"
        style={{ paddingLeft: `${node.depth * 1.5}rem` }}
      >
        <p className={cn("truncate text-sm", node.depth === 0 && "font-medium")}>
          {node.category.name}
        </p>
        {node.category.description ? (
          <p className="truncate text-xs text-muted-foreground">
            {node.category.description}
          </p>
        ) : null}
      </div>

      <span className="font-mono text-xs text-muted-foreground">
        {node.category.slug}
      </span>

      {hasActions ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Ações de ${node.category.name}`}
              disabled={removing}
            >
              <span aria-hidden>⋯</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {edit.allowed ? (
              <DropdownMenuItem onSelect={onEdit}>
                <edit.definition.icon className="size-4" />
                {edit.label}
              </DropdownMenuItem>
            ) : null}
            {create.allowed ? (
              <DropdownMenuItem onSelect={onAddChild}>
                <FolderTree className="size-4" />
                Nova subcategoria
              </DropdownMenuItem>
            ) : null}
            {destroy.allowed ? (
              <DropdownMenuItem
                onSelect={onRemove}
                className="text-destructive"
              >
                <destroy.definition.icon className="size-4" />
                {destroy.label}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}
