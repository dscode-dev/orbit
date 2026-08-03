"use client";

/**
 * Listagem de clientes.
 *
 * **Filtros.** `CustomerQueryDto` aceita `search`, `type`, `status`, `page` e
 * `limit`. Nada além disso — verificado: `?city=Recife` devolve
 * `['property city should not exist']`.
 *
 * Por isso a tela **não** oferece filtro por unidade, cidade nem responsável:
 *
 * - **unidade** — o cliente é da organização; não há `businessUnitId` no
 *   modelo `Customer` (só o contato tem);
 * - **cidade** — mora em `address`, que é `Json?` sem esquema e sem índice;
 * - **responsável** — não existe campo de gestor de conta.
 *
 * A busca do servidor cobre nome, nome fantasia, documento e e-mail, então
 * localizar por cidade só funciona se ela estiver no texto buscado — e a tela
 * não promete o contrário.
 *
 * **Ordenação** é do backend (`legalName asc, id asc`), declarada no cabeçalho.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Handshake, ListFilter, Search } from "lucide-react";

import { EmptyState } from "@/components/feedback/states";
import { PanelError, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
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
import { entityHref } from "@/entities";
import { useCustomersList } from "@/hooks/customers/use-customers";
import { CustomerStatus, CustomerType } from "@/types/contracts";
import {
  CUSTOMER_LIMITS,
  type Customer,
  type CustomerQuery,
} from "@/types/customers";
import {
  customerStatusLabel,
  customerTypeLabel,
  CustomerStatusBadge,
  readAddress,
} from "./customer-presentation";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;
const ANY = "__all__";

export function CustomersList() {
  const [filters, setFilters] = useState<CustomerQuery>({
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

  const query = useCustomersList(filters);
  const customers = query.data?.data ?? [];
  const meta = query.data?.meta;

  const summary = useMemo(() => {
    if (!meta) return null;
    const first = (meta.page - 1) * meta.limit + 1;
    const last = Math.min(meta.page * meta.limit, meta.total);
    return meta.total === 0
      ? "Nenhum cliente"
      : `${first}–${last} de ${meta.total}`;
  }, [meta]);

  const patch = (next: Partial<CustomerQuery>) =>
    setFilters((current) => ({ ...current, ...next, page: 1 }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]">
        <div className="space-y-2">
          <Label htmlFor="customers-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="customers-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              maxLength={CUSTOMER_LIMITS.searchMaxLength}
              placeholder="Nome, documento ou e-mail"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customers-type">Tipo</Label>
          <Select
            value={filters.type ?? ANY}
            onValueChange={(value) =>
              patch({
                type:
                  value === ANY ? undefined : (value as CustomerQuery["type"]),
              })
            }
          >
            <SelectTrigger id="customers-type">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {Object.values(CustomerType).map((type) => (
                <SelectItem key={type} value={type}>
                  {customerTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customers-status">Status</Label>
          <Select
            value={filters.status ?? ANY}
            onValueChange={(value) =>
              patch({
                status:
                  value === ANY
                    ? undefined
                    : (value as CustomerQuery["status"]),
              })
            }
          >
            <SelectTrigger id="customers-status">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {Object.values(CustomerStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {customerStatusLabel(status)}
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
            disabled={!filters.search && !filters.type && !filters.status}
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
          Ordenado por razão social (ordem definida pelo backend)
        </p>
      </div>

      {query.isPending ? (
        <PanelLoading rows={6} />
      ) : query.error ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<Handshake className="size-5" />}
          title="Nenhum cliente encontrado"
          description="Ajuste a busca ou os filtros para ver mais resultados."
        />
      ) : (
        <div className="glass-panel overflow-x-auto rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Contato principal</TableHead>
                <TableHead>Vínculos</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} />
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

function CustomerRow({ customer }: { customer: Customer }) {
  const href = entityHref("customer", customer.id) ?? "#";
  const address = readAddress(customer.address);
  const primary =
    customer.contacts.find((item) => item.isPrimary) ?? customer.contacts[0];

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0 space-y-1">
          <Link href={href} className="font-medium hover:underline">
            {customer.tradeName ?? customer.legalName}
          </Link>
          {customer.documentNumber ? (
            <p className="font-mono text-xs text-muted-foreground">
              {customer.documentType} {customer.documentNumber}
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {customerTypeLabel(customer.type)}
      </TableCell>
      <TableCell>
        <CustomerStatusBadge status={customer.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {address.city ?? "—"}
        {address.stateCode ? `/${address.stateCode}` : ""}
      </TableCell>
      <TableCell className="text-sm">
        {primary ? (
          <>
            {primary.name}
            {primary.role ? (
              <span className="block text-xs text-muted-foreground">
                {primary.role}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px]">
            {customer.counts.assets} ativo(s)
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {customer.counts.operations} operação(ões)
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" asChild>
          <Link href={href} aria-label={`Abrir ${customer.legalName}`}>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
