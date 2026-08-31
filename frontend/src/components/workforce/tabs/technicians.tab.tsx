"use client";

/**
 * Visão operacional da equipe técnica.
 *
 * ## Quem é "técnico"
 *
 * O backend **não tem esse conceito**: não há flag, especialidade nem tipo de
 * pessoa. O que existe é papel, e é ele que a aba usa — a lista mostra quem
 * está na organização com a carga de trabalho de cada um, e o filtro de papel
 * permite recortar a equipe de campo.
 *
 * Inventar uma regra de "quem é técnico" aqui — pelo nome do papel, por
 * exemplo — seria criar uma classificação que o servidor não reconhece e que
 * quebraria no primeiro papel renomeado.
 *
 * ## Carga, não produtividade
 *
 * Cada número é `meta.total` de uma consulta filtrada por `assignedUserId` ou
 * `responsibleUserId`. Produtividade exigiria tempo gasto por tarefa, que
 * nenhum contrato publica — e um indicador de desempenho inventado é a pior
 * classe de número inventado, porque alguém decide sobre pessoas com ele.
 */
import { useMemo } from "react";
import { HardHat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntityBadge } from "@/entities";
import { useTeamMembers, useTeamRoles } from "@/hooks/workforce/use-workforce";
import type { TeamMember } from "@/types/workforce";
import {
  FilterBar,
  FilterSelect,
  ListState,
  Pagination,
  ResultSummary,
  SearchField,
  useListController,
} from "@/workspace";
import { useState } from "react";
import { MemberSheet } from "../member.sheet";
import { WorkloadCards } from "../workload-cards";

interface TechnicianFilters {
  search?: string;
  roleId?: string;
  page?: number;
  limit?: number;
}

export function TechniciansTab() {
  const list = useListController<TechnicianFilters>({ limit: 10 });
  const members = useTeamMembers({
    page: list.query.page,
    limit: list.query.limit,
  });
  const roles = useTeamRoles();
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const all = useMemo(() => members.data?.data ?? [], [members.data]);
  const meta = members.data?.meta;

  const filtered = useMemo(() => {
    const term = list.query.search?.toLowerCase() ?? "";
    return all.filter((member) => {
      if (list.query.roleId && member.role.id !== list.query.roleId) {
        return false;
      }
      if (!term) return true;
      return member.displayName.toLowerCase().includes(term);
    });
  }, [all, list.query.roleId, list.query.search]);

  const roleOptions = (roles.data ?? []).map((role) => ({
    value: role.id,
    label: `${role.name} (${role.memberCount})`,
  }));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Carga de trabalho de cada pessoa, contada pelo servidor.
        </p>
        <p className="text-xs text-muted-foreground">
          O backend não classifica ninguém como &ldquo;técnico&rdquo; — não há
          flag nem especialidade em contrato. Use o filtro de papel para
          recortar a equipe de campo.
        </p>
      </div>

      <FilterBar onClear={list.reset} canClear={list.isFiltered}>
        <SearchField
          id="technicians-search"
          value={list.searchTerm}
          onChange={list.setSearchTerm}
          placeholder="Nome"
        />
        <FilterSelect
          id="technicians-role"
          label="Papel"
          value={list.query.roleId}
          onChange={(value) => list.setFilter("roleId", value)}
          options={roleOptions}
          anyLabel="Todos"
        />
      </FilterBar>

      <ResultSummary meta={meta} noun="pessoa" gender="f" />

      <ListState
        isPending={members.isPending}
        error={members.error}
        onRetry={() => void members.refetch()}
        items={filtered}
        empty={{
          icon: <HardHat className="size-5" />,
          title: "Nenhuma pessoa encontrada",
          description: "Ajuste a busca ou o filtro de papel.",
        }}
      >
        {(rows) => (
          <div className="space-y-4">
            {rows.map((member) => (
              <article
                key={member.userId}
                className="glass-panel space-y-4 rounded-xl p-4"
              >
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {member.displayName}
                      <Badge variant="outline">{member.role.name}</Badge>
                      <EntityBadge
                        entity="team-member"
                        group="status"
                        value={member.status}
                      />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.businessUnits.length > 0
                        ? member.businessUnits
                            .map((unit) => unit.tradeName ?? unit.legalName)
                            .join(", ")
                        : "Toda a organização"}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(member)}
                  >
                    Abrir
                  </Button>
                </header>

                <WorkloadCards userId={member.userId} />
              </article>
            ))}
          </div>
        )}
      </ListState>

      <Pagination
        meta={meta}
        onPrevious={list.previousPage}
        onNext={list.nextPage}
        isFetching={members.isFetching}
      />

      <MemberSheet
        member={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
