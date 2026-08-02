"use client";

/**
 * Listagem de ativos.
 *
 * **Filtros.** `AssetQueryDto` aceita busca, unidade, cliente, categoria e
 * status — e só isso. A busca do servidor cobre nome, identificador, número de
 * série, fabricante e modelo, então "tipo, fabricante e modelo" são
 * alcançáveis pela busca, não por filtro próprio.
 *
 * **Criticidade não existe no contrato** — não há campo no modelo `Asset` nem
 * parâmetro na consulta. A coluna e o filtro não são oferecidos, em vez de
 * derivar criticidade de status ou de `specifications`, que é JSON livre do
 * tenant. Ver `docs/asset-workspace.md`.
 *
 * **Ordenação** é do backend (`name asc, id asc`) e está declarada na tela: o
 * contrato não aceita parâmetro de ordenação, e reordenar a página atual daria
 * impressão falsa de ordem global.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, ListFilter, Search } from "lucide-react";

import { EmptyState } from "@/components/feedback/states";
import { PanelError, PanelLoading } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntityBadge, entityHref } from "@/entities";
import { useAssetsList } from "@/hooks/assets/use-assets";
import { useActiveScope } from "@/providers/use-active-scope";
import { AssetCategory, AssetStatus } from "@/types/contracts";
import { ASSET_CATEGORY_LABELS, ASSET_STATUS_LABELS } from "@/entities";
import { ASSET_LIMITS, type Asset, type AssetQuery } from "@/types/assets";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;
const ANY = "__all__";

export function AssetsList() {
  const { businessUnitId } = useActiveScope();
  const [filters, setFilters] = useState<AssetQuery>({
    page: 1,
    limit: PAGE_SIZE,
  });
  const [searchTerm, setSearchTerm] = useState("");

  /** Busca só viaja depois que o usuário para de digitar. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) =>
        current.search === (searchTerm || undefined)
          ? current
          : { ...current, search: searchTerm || undefined, page: 1 },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const scoped = useMemo<AssetQuery>(
    () => ({
      ...filters,
      businessUnitId: filters.businessUnitId ?? businessUnitId ?? undefined,
    }),
    [filters, businessUnitId],
  );

  const query = useAssetsList(scoped);
  const assets = query.data?.data ?? [];
  const meta = query.data?.meta;

  const summary = useMemo(() => {
    if (!meta) return null;
    const first = (meta.page - 1) * meta.limit + 1;
    const last = Math.min(meta.page * meta.limit, meta.total);
    return meta.total === 0
      ? "Nenhum ativo"
      : `${first}–${last} de ${meta.total}`;
  }, [meta]);

  const patch = (next: Partial<AssetQuery>) =>
    setFilters((current) => ({ ...current, ...next, page: 1 }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]">
        <div className="space-y-2">
          <Label htmlFor="assets-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="assets-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              maxLength={ASSET_LIMITS.searchMaxLength}
              placeholder="Nome, identificador, série, fabricante ou modelo"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assets-category">Categoria</Label>
          <Select
            value={filters.category ?? ANY}
            onValueChange={(value) =>
              patch({
                category:
                  value === ANY ? undefined : (value as AssetQuery["category"]),
              })
            }
          >
            <SelectTrigger id="assets-category">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {Object.values(AssetCategory).map((category) => (
                <SelectItem key={category} value={category}>
                  {ASSET_CATEGORY_LABELS[category] ?? category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assets-status">Status</Label>
          <Select
            value={filters.status ?? ANY}
            onValueChange={(value) =>
              patch({
                status:
                  value === ANY ? undefined : (value as AssetQuery["status"]),
              })
            }
          >
            <SelectTrigger id="assets-status">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {Object.values(AssetStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {ASSET_STATUS_LABELS[status] ?? status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            variant="ghost"
            onClick={() => {
              setSearchTerm("");
              setFilters({ page: 1, limit: PAGE_SIZE });
            }}
            disabled={!filters.search && !filters.category && !filters.status}
          >
            Limpar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ListFilter className="size-4" aria-hidden />
          <span>{summary ?? "Carregando…"}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Ordenado por nome (ordem definida pelo backend)
        </p>
      </div>

      {query.isPending ? (
        <PanelLoading rows={6} />
      ) : query.error ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-5" />}
          title="Nenhum ativo encontrado"
          description="Ajuste a busca ou os filtros para ver mais resultados."
        />
      ) : (
        <div className="glass-panel overflow-x-auto rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fabricante e modelo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <AssetRow key={asset.id} asset={asset} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage || query.isFetching}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: Math.max(1, (current.page ?? 1) - 1),
              }))
            }
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage || query.isFetching}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: (current.page ?? 1) + 1,
              }))
            }
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AssetRow({ asset }: { asset: Asset }) {
  const href = entityHref("asset", asset.id) ?? "#";

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0 space-y-1">
          <Link href={href} className="font-medium hover:underline">
            {asset.name}
          </Link>
          {asset.identifier ? (
            <p className="font-mono text-xs text-muted-foreground">
              {asset.identifier}
            </p>
          ) : asset.serialNumber ? (
            <p className="font-mono text-xs text-muted-foreground">
              série {asset.serialNumber}
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <EntityBadge entity="asset" group="category" value={asset.category} />
      </TableCell>
      <TableCell>
        <EntityBadge entity="asset" group="status" value={asset.status} />
      </TableCell>
      <TableCell className="text-sm">
        {(asset.manufacturer ?? asset.model) ? (
          <>
            {asset.manufacturer ?? "—"}
            {asset.model ? (
              <span className="block text-xs text-muted-foreground">
                {asset.model}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {asset.customer ? (
          (asset.customer.tradeName ?? asset.customer.legalName)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {asset.businessUnit
          ? (asset.businessUnit.tradeName ?? asset.businessUnit.legalName)
          : "—"}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" asChild>
          <Link href={href} aria-label={`Abrir ${asset.name}`}>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
