"use client";

/**
 * A equipe técnica, em tabela.
 *
 * ## Quem é "técnico"
 *
 * O `ProfessionalProfile` responde: perfil ativo com `fieldTechnicianEnabled`.
 * É a mesma definição que o seletor de atribuição usa, e é por isso que a tabela
 * de comissão lista exatamente quem pode ser atribuído a um atendimento.
 *
 * O comentário que estava aqui dizia que o backend não tinha esse conceito e que
 * a aba recortava por papel. Era verdade antes do domínio profissional (PR-27):
 * o perfil existe, e usar papel de acesso para adivinhar quem é técnico
 * quebraria no primeiro papel renomeado.
 *
 * ## Tabela, e não cartões
 *
 * Eram cartões com quatro indicadores cada. A pergunta de quem abre esta aba é
 * comparativa — quem está com mais trabalho, quem tem mais a receber — e
 * comparar é o que uma tabela faz. Os cartões também custavam **quatro
 * requisições por pessoa** (uma consulta com `limit: 1` por número, lendo
 * `meta.total`): quarenta numa equipe de dez.
 *
 * ## Por que a tabela vem do Financeiro
 *
 * É o mesmo componente da aba Comissão, e os números vêm do mesmo endpoint —
 * comissão e carga na mesma linha. Duas implementações divergiriam no primeiro
 * número novo, e a desta aba seria a que ficaria para trás.
 *
 * Quem não tem acesso financeiro não pode ver quanto cada pessoa recebe: para
 * esse caso a aba mostra a lista da equipe com a carga de cada um, sem dinheiro.
 *
 * ## Carga, não produtividade
 *
 * Cada número conta trabalho atribuído. Produtividade exigiria tempo gasto por
 * tarefa, que nenhum contrato publica — e um indicador de desempenho inventado é
 * a pior classe de número inventado, porque alguém decide sobre pessoas com ele.
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
import { useSession } from "@/providers/session-provider";
import { CommissionTechniciansSection } from "@/components/financial/commission-technicians.section";
import { MemberSheet } from "../member.sheet";
import { WorkloadCards } from "../workload-cards";

interface TechnicianFilters {
  search?: string;
  roleId?: string;
  page?: number;
  limit?: number;
}

export function TechniciansTab() {
  const session = useSession();

  /* A tabela inteira depende de leitura financeira, porque comissão é dinheiro.
     Sem ela, resta a carga de trabalho. */
  return session.hasPermission("financial.read") ? (
    <CommissionTechniciansSection
      canManage={
        session.hasPermission("financial.manage") &&
        session.hasCapability("financial.manage")
      }
    />
  ) : (
    <WorkloadList />
  );
}

function WorkloadList() {
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
          Carga de trabalho de cada pessoa.
        </p>
        <p className="text-xs text-muted-foreground">
          A comissão de cada técnico é informação financeira, e o seu acesso não
          a inclui.
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
