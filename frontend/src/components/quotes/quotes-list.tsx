"use client";

/**
 * Listagem de propostas — serve as cinco abas.
 *
 * ## Um componente, cinco recortes
 *
 * As abas são o **mesmo endpoint** com `status` diferente, filtrado pelo
 * servidor. "Encerrados" é a exceção: `REJECTED`, `EXPIRED` e `CANCELLED` são
 * três situações distintas, e `QuoteQueryDto` aceita **uma** por consulta.
 * A aba oferece um seletor entre as três em vez de buscar as três e juntar no
 * cliente — juntar quebraria a paginação e a contagem.
 *
 * ## Nada é recortado aqui
 *
 * Todo filtro é parâmetro do contrato, `meta.total` é do servidor, e os
 * valores da linha vêm calculados. A tela não soma coluna.
 */
import { useState } from "react";
import { Plus, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAction } from "@/actions";
import { EntityBadge, EntityLink } from "@/entities";
import { useQuotes } from "@/hooks/quotes/use-quotes";
import { useActiveScope } from "@/providers/use-active-scope";
import {
  QUOTE_STATUS_LABELS,
  type QuoteQuery,
  type QuoteStatus,
} from "@/types/quotes";
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
import { Money, Quantity, ValidUntil } from "./quote-presentation";
import { QuoteFormDialog } from "./quote-form.dialog";

const CLOSED_OPTIONS = optionsFrom(
  ["REJECTED", "EXPIRED", "CANCELLED"],
  QUOTE_STATUS_LABELS,
);

export function QuotesList({
  /** Situação fixa da aba. `closed` abre o seletor entre os três desfechos. */
  status,
  closed = false,
  /** Recorte por cliente — usado dentro do Customer Workspace. */
  customerId,
  emptyTitle,
  emptyDescription,
  compact = false,
}: {
  status?: QuoteStatus;
  closed?: boolean;
  customerId?: string;
  emptyTitle: string;
  emptyDescription: string;
  compact?: boolean;
}) {
  const list = useListController<QuoteQuery>({ limit: compact ? 10 : 20 });
  const { businessUnits } = useActiveScope();
  const create = useAction("quote.create");
  const [formOpen, setFormOpen] = useState(false);

  /**
   * A situação da aba vence a do filtro.
   *
   * Em "Encerrados" o usuário escolhe qual desfecho ver; nas demais, a aba já
   * respondeu essa pergunta.
   */
  const effectiveStatus = closed ? (list.query.status ?? "REJECTED") : status;

  const query = useQuotes({
    ...list.query,
    status: effectiveStatus,
    customerId: customerId ?? list.query.customerId,
  });

  const quotes = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultSummary
          meta={meta}
          noun="orçamento"
          note="Ordenado do mais recente"
        />
        {create.allowed && !compact ? (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            {create.label}
          </Button>
        ) : null}
      </div>

      <FilterBar onClear={list.reset} canClear={list.isFiltered}>
        <SearchField
          id={`quotes-${status ?? "all"}-search`}
          value={list.searchTerm}
          onChange={list.setSearchTerm}
          placeholder="Título, código ou observações"
          hint="A busca cobre título, código e observações."
        />

        {closed ? (
          <FilterSelect
            id="quotes-closed-status"
            label="Desfecho"
            value={effectiveStatus}
            onChange={(value) =>
              list.setFilter("status", (value ?? "REJECTED") as QuoteStatus)
            }
            options={CLOSED_OPTIONS}
            anyLabel="Recusados"
          />
        ) : null}

        {businessUnits.length > 1 ? (
          <FilterSelect
            id={`quotes-${status ?? "all"}-unit`}
            label="Unidade"
            value={list.query.businessUnitId}
            onChange={(value) => list.setFilter("businessUnitId", value)}
            options={businessUnits.map((unit) => ({
              value: unit.id,
              label: unit.tradeName ?? unit.legalName,
            }))}
            anyLabel="Todas"
          />
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`quotes-${status ?? "all"}-from`}>Criados de</Label>
          <Input
            id={`quotes-${status ?? "all"}-from`}
            type="date"
            value={list.query.from ?? ""}
            onChange={(event) =>
              list.setFilter("from", event.target.value || undefined)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`quotes-${status ?? "all"}-to`}>até</Label>
          <Input
            id={`quotes-${status ?? "all"}-to`}
            type="date"
            value={list.query.to ?? ""}
            onChange={(event) =>
              list.setFilter("to", event.target.value || undefined)
            }
          />
        </div>

        {/*
          Validade: existe no contrato como `validUntilBefore`, e é o filtro que
          responde "o que vence primeiro" — a pergunta de quem cobra decisão.
        */}
        <div className="space-y-2">
          <Label htmlFor={`quotes-${status ?? "all"}-valid`}>Vence até</Label>
          <Input
            id={`quotes-${status ?? "all"}-valid`}
            type="date"
            value={list.query.validUntilBefore ?? ""}
            onChange={(event) =>
              list.setFilter(
                "validUntilBefore",
                event.target.value || undefined,
              )
            }
          />
        </div>
      </FilterBar>

      <ListState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        items={quotes}
        empty={{
          icon: <ReceiptText className="size-5" />,
          title: emptyTitle,
          description: emptyDescription,
          action:
            create.allowed && !compact ? (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                {create.label}
              </Button>
            ) : undefined,
        }}
      >
        {(rows) => (
          <div className="glass-panel overflow-x-auto rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposta</TableHead>
                  {customerId ? null : <TableHead>Cliente</TableHead>}
                  <TableHead>Situação</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <EntityLink
                        entity="quote"
                        id={quote.id}
                        className="font-medium"
                      >
                        {quote.code}
                      </EntityLink>
                      <span className="block truncate text-xs text-muted-foreground">
                        {quote.title}
                      </span>
                    </TableCell>
                    {customerId ? null : (
                      <TableCell className="text-muted-foreground">
                        <EntityLink entity="customer" id={quote.customer.id}>
                          {quote.customer.displayName}
                        </EntityLink>
                      </TableCell>
                    )}
                    <TableCell>
                      <EntityBadge
                        entity="quote"
                        group="status"
                        value={quote.status}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ValidUntil quote={quote} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <Quantity value={`${quote.itemCount}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money
                        value={quote.total}
                        muted={quote.status === "CANCELLED"}
                      />
                    </TableCell>
                  </TableRow>
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

      <QuoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customerId={customerId}
      />
    </div>
  );
}
