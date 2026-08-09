"use client";

/**
 * Categorias de receita e despesa.
 *
 * ## Nenhuma categoria HVAC-R está escrita aqui
 *
 * "Peças e materiais", "Deslocamento", "Contratos de manutenção" — nada disso
 * aparece neste arquivo. Elas são **dados**: o backend semeia dez categorias na
 * primeira abertura do módulo, e a tela apenas lista o que a organização tem.
 * Uma lista fixa no componente divergiria da do servidor no primeiro rename, e
 * a interface passaria a mostrar categorias que não existem.
 *
 * ## Semeada não é imutável
 *
 * `isSystem` marca as que o Orbit criou. Elas podem ser **renomeadas,
 * recoloridas e reordenadas** — o que não se pode é removê-las, e o servidor é
 * quem recusa. A tela só evita oferecer o botão.
 *
 * ## Duas listas, um contrato
 *
 * Receitas e despesas aparecem separadas porque uma categoria serve a um lado
 * só (`type` não é editável). O endpoint é o mesmo, com filtro.
 */
import { useState } from "react";
import { FolderTree, MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { useAction } from "@/actions";
import {
  useFinancialCategories,
  useRemoveFinancialCategory,
} from "@/hooks/financial/use-financial";
import {
  FINANCIAL_TYPE_LABELS,
  type FinancialCategory,
  type FinancialEntryType,
} from "@/types/financial";
import { FinancialCategoryFormDialog } from "../financial-category-form.dialog";
import { ConfirmDialog } from "../confirm.dialog";

export function FinancialCategoriesTab() {
  const create = useAction("financial-entry.create-category");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialCategory | null>(null);
  const [defaultType, setDefaultType] =
    useState<FinancialEntryType>("EXPENSE");

  const openNew = (type: FinancialEntryType) => {
    setEditing(null);
    setDefaultType(type);
    setFormOpen(true);
  };

  const openEdit = (category: FinancialCategory) => {
    setEditing(category);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        As categorias agrupam lançamentos nos relatórios. O Orbit semeia um
        conjunto inicial na primeira abertura do módulo — renomeie, recolora ou
        crie as suas.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <CategoryList
          type="INCOME"
          onNew={() => openNew("INCOME")}
          onEdit={openEdit}
          canCreate={create.allowed}
          createLabel={create.label}
        />
        <CategoryList
          type="EXPENSE"
          onNew={() => openNew("EXPENSE")}
          onEdit={openEdit}
          canCreate={create.allowed}
          createLabel={create.label}
        />
      </div>

      <FinancialCategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        defaultType={defaultType}
      />
    </div>
  );
}

function CategoryList({
  type,
  onNew,
  onEdit,
  canCreate,
  createLabel,
}: {
  type: FinancialEntryType;
  onNew: () => void;
  onEdit: (category: FinancialCategory) => void;
  canCreate: boolean;
  createLabel: string;
}) {
  const query = useFinancialCategories({ type });
  const remove = useRemoveFinancialCategory();
  const [removing, setRemoving] = useState<FinancialCategory | null>(null);

  const edit = useAction("financial-entry.update-category");
  const destroy = useAction("financial-entry.delete-category");

  return (
    <PanelFrame
      panelId={`financial-categories-${type}`}
      title={`${FINANCIAL_TYPE_LABELS[type]}s`}
      description={
        type === "INCOME"
          ? "Como as entradas são agrupadas"
          : "Como as saídas são agrupadas"
      }
      actions={
        canCreate ? (
          <Button size="sm" variant="outline" onClick={onNew}>
            <Plus className="size-4" />
            {createLabel}
          </Button>
        ) : null
      }
    >
      <PanelState
        query={toPanelQuery(query)}
        isEmpty={(items) => items.length === 0}
        emptyMessage="Nenhuma categoria neste lado."
      >
        {(items) => (
          <ul className="divide-y divide-border">
            {items.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FolderTree
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {category.name}
                    </span>
                    {category.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {category.description}
                      </span>
                    ) : null}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {category.entryCount === 0
                      ? "sem uso"
                      : `${category.entryCount} lanç.`}
                  </span>
                  {edit.allowed || destroy.allowed ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Ações">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {edit.allowed ? (
                          <DropdownMenuItem
                            onSelect={() => onEdit(category)}
                          >
                            {edit.label}
                          </DropdownMenuItem>
                        ) : null}
                        {/*
                          Semeada pelo Orbit não se remove — e o servidor é
                          quem recusa. Esconder o item evita oferecer o que
                          voltaria 409.
                        */}
                        {destroy.allowed && !category.isSystem ? (
                          <DropdownMenuItem
                            onSelect={() => setRemoving(category)}
                            className="text-destructive"
                          >
                            {destroy.label}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelState>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={destroy.confirm?.title ?? "Excluir esta categoria?"}
        body={destroy.confirm?.body ?? ""}
        confirmLabel={destroy.confirm?.confirmLabel ?? "Excluir"}
        isPending={remove.isPending}
        error={remove.error}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </PanelFrame>
  );
}
