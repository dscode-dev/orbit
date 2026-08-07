"use client";

/**
 * Equipamentos do cliente.
 *
 * O centro da consolidação: a entrada para o parque instalado deixa de ser um
 * item de menu solto e passa a ser a aba do cliente que o contratou. Listar,
 * criar, editar, ativar, desativar e localizar por QR Code acontecem aqui —
 * sem sair do contexto.
 *
 * ## Vínculo com o cliente
 *
 * `customerId` é filtro real de `AssetQueryDto` e campo de `CreateAssetDto`:
 * a lista é recortada pelo servidor e o cadastro nasce vinculado. Nada é
 * filtrado no cliente.
 *
 * ## Ativar e desativar
 *
 * São `PATCH /assets/:id` com `status` — a única forma que o contrato oferece.
 * Não há endpoint dedicado, e a tela não inventa um: manda o campo que o
 * `UpdateAssetDto` aceita e mostra o que o servidor responder.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Plus, QrCode } from "lucide-react";

import { AssetFormDialog } from "@/components/assets/asset-form.dialog";
import { AssetResolveDialog } from "@/components/assets/asset-resolve.dialog";
import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAction } from "@/actions";
import { EntityBadge, entityHref } from "@/entities";
import { useUpdateAsset } from "@/hooks/assets/use-assets";
import { useCustomerAssetsList } from "@/hooks/customers/use-customers";
import { AssetStatus } from "@/types/contracts";
import type { Asset } from "@/types/assets";
import {
  FilterBar,
  FilterSelect,
  ListState,
  Pagination,
  ResultSummary,
  SearchField,
  optionsFrom,
  useListController,
} from "@/workspace";
import { ASSET_CATEGORY_LABELS, ASSET_STATUS_LABELS } from "@/entities";
import { AssetCategory } from "@/types/contracts";
import type { AssetQuery } from "@/types/assets";

const CATEGORY_OPTIONS = optionsFrom(
  Object.values(AssetCategory),
  ASSET_CATEGORY_LABELS,
);
const STATUS_OPTIONS = optionsFrom(
  Object.values(AssetStatus),
  ASSET_STATUS_LABELS,
);

export function EquipmentTab({ customerId }: { customerId: string }) {
  const list = useListController<AssetQuery>({ limit: 10 });
  const query = useCustomerAssetsList(customerId, list.query);

  const create = useAction("asset.create");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);

  const assets = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultSummary meta={meta} noun="equipamento" />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResolveOpen(true)}
          >
            <QrCode className="size-4" />
            Localizar por QR Code
          </Button>

          {create.allowed ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              {create.label}
            </Button>
          ) : null}
        </div>
      </div>

      <FilterBar onClear={list.reset} canClear={list.isFiltered}>
        <SearchField
          id="customer-assets-search"
          value={list.searchTerm}
          onChange={list.setSearchTerm}
          placeholder="Nome, identificador, série, fabricante ou modelo"
        />
        <FilterSelect
          id="customer-assets-category"
          label="Categoria"
          value={list.query.category}
          onChange={(value) =>
            list.setFilter("category", value as AssetQuery["category"])
          }
          options={CATEGORY_OPTIONS}
          anyLabel="Todas"
        />
        <FilterSelect
          id="customer-assets-status"
          label="Status"
          value={list.query.status}
          onChange={(value) =>
            list.setFilter("status", value as AssetQuery["status"])
          }
          options={STATUS_OPTIONS}
        />
      </FilterBar>

      <ListState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        items={assets}
        rows={4}
        empty={{
          icon: <Boxes className="size-5" />,
          title: "Nenhum equipamento vinculado",
          description:
            "Cadastre o parque instalado deste cliente para acompanhar operações, PMOCs e documentos por equipamento.",
          action: create.allowed ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              {create.label}
            </Button>
          ) : undefined,
        }}
      >
        {(rows) => (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    onEdit={() => {
                      setEditing(asset);
                      setFormOpen(true);
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ListState>

      <Pagination
        meta={meta}
        onPrevious={list.previousPage}
        onNext={list.nextPage}
        isFetching={query.isFetching}
      />

      <AssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        customerId={customerId}
      />

      <AssetResolveDialog open={resolveOpen} onOpenChange={setResolveOpen} />
    </div>
  );
}

function AssetRow({ asset, onEdit }: { asset: Asset; onEdit: () => void }) {
  const href = entityHref("asset", asset.id) ?? "#";
  const edit = useAction("asset.update");
  const activate = useAction("asset.activate");
  const deactivate = useAction("asset.deactivate");

  const update = useUpdateAsset(asset.id);
  const inactive = asset.status === AssetStatus.INACTIVE;
  const toggle = inactive ? activate : deactivate;

  const setStatus = () =>
    update.mutate({
      status: inactive ? AssetStatus.ACTIVE : AssetStatus.INACTIVE,
    });

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0 space-y-1">
          <Link href={href} className="font-medium hover:underline">
            {asset.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {[asset.manufacturer, asset.model].filter(Boolean).join(" · ") ||
              "—"}
          </p>
          {asset.identifier ? (
            <p className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <QrCode className="size-3" aria-hidden />
              {asset.identifier}
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <EntityBadge entity="asset" group="category" value={asset.category} />
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <EntityBadge entity="asset" group="status" value={asset.status} />
          <MutationError error={update.error} />
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {asset.location ?? "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {edit.allowed || toggle.allowed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Ações de ${asset.name}`}
                  disabled={update.isPending}
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
                {toggle.allowed ? (
                  <DropdownMenuItem onSelect={setStatus}>
                    <toggle.definition.icon className="size-4" />
                    {toggle.label}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Button variant="ghost" size="icon" asChild>
            <Link href={href} aria-label={`Abrir ${asset.name}`}>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
