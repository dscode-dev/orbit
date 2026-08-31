"use client";

/**
 * A lista de **configurações** de PMOC.
 *
 * Cada linha é um contrato de manutenção — não um ciclo, não uma execução. O
 * que se lê aqui é: para quem, em que unidade, com que periodicidade, sob
 * responsabilidade de quem, e como está a conformidade.
 *
 * "Atrasado" e "Vence em breve" vêm de `compliance`, calculado pelo servidor
 * contra a data dele. A tela nunca compara `dueOn` com `new Date()`: o
 * relógio do navegador está no fuso de quem abriu, e o vencimento é do fuso da
 * unidade — duas pessoas veriam estados diferentes do mesmo plano.
 */
import { ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";

import {
  ComplianceBadge,
  PlanStatusBadge,
} from "@/components/pmoc/pmoc-presentation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePmocPlans } from "@/hooks/pmoc/use-pmoc";
import { formatDate } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";
import { PLAN_STATUS } from "@/registry";
import { useSession } from "@/providers/session-provider";
import type { PmocPlanQuery } from "@/types/pmoc";
import {
  FilterBar,
  FilterSelect,
  ListState,
  Pagination,
  ResultSummary,
  SearchField,
  useListController,
} from "@/workspace";

const STATUS_OPTIONS = Object.entries(PLAN_STATUS).map(([value, entry]) => ({
  value,
  label: entry.label,
}));

export function PmocList({ onCreate }: { onCreate: () => void }) {
  const session = useSession();
  const canManage = session.hasPermission("pmoc.manage");
  const controller = useListController<PmocPlanQuery>();
  const plans = usePmocPlans(controller.query);

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchField
          id="pmoc-search"
          value={controller.searchTerm}
          onChange={controller.setSearchTerm}
          label="Buscar"
          placeholder="Código, nome ou cliente"
          hint="A busca é aplicada pelo backend."
        />
        <FilterSelect
          id="pmoc-status"
          label="Situação"
          value={controller.query.status ?? ""}
          onChange={(value) => controller.setFilter("status", value)}
          options={STATUS_OPTIONS}
        />
        <Button variant="ghost" size="sm" onClick={controller.reset}>
          Limpar
        </Button>
      </FilterBar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultSummary
          meta={plans.data?.meta}
          noun="configuração de PMOC"
          gender="f"
          note="Ordenado pelo próximo vencimento (ordem definida pelo backend)."
        />
        {canManage ? (
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-3.5" />
            Novo PMOC
          </Button>
        ) : null}
      </div>

      <ListState
        isPending={plans.isPending}
        error={plans.error}
        onRetry={() => void plans.refetch()}
        items={plans.data?.data ?? []}
        empty={{
          icon: <ClipboardCheck className="size-5" />,
          title: "Nenhum PMOC configurado",
          description:
            "Um PMOC define a cobertura de equipamentos, a periodicidade e o Responsável Técnico do contrato de manutenção.",
          action: canManage ? (
            <Button size="sm" onClick={onCreate}>
              <Plus className="size-3.5" />
              Novo PMOC
            </Button>
          ) : undefined,
        }}
      >
        {(rows) => (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Equipamentos</TableHead>
                  <TableHead>Responsável Técnico</TableHead>
                  <TableHead>Próximo vencimento</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <Link
                        href={`${ROUTES.pmoc}/${plan.id}`}
                        className="block max-w-[16rem] truncate font-medium hover:underline"
                      >
                        {plan.name}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">
                        {plan.code}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate">
                      {plan.customer.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {plan.frequency.label}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {plan.coveredEquipment}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate text-sm">
                      {plan.technician?.displayName ?? (
                        <span className="text-muted-foreground">
                          Não definido
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">
                          {plan.compliance.nextDueOn
                            ? formatDate(plan.compliance.nextDueOn)
                            : "—"}
                        </span>
                        <ComplianceBadge status={plan.compliance.status} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <PlanStatusBadge status={plan.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ListState>

      <Pagination
        meta={plans.data?.meta}
        onPrevious={controller.previousPage}
        onNext={controller.nextPage}
        isFetching={plans.isFetching}
      />
    </div>
  );
}
