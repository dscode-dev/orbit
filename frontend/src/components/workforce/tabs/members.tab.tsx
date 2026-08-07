"use client";

/**
 * Usuários da organização.
 *
 * ## Busca e filtros são locais — e por quê
 *
 * `GET /organizations/current/members` **não é paginado e não aceita
 * parâmetros**: devolve a organização inteira, ordenada por nome. Não há
 * `?search=` para chamar.
 *
 * Filtrar aqui é, portanto, recorte de uma lista que já está inteira na mão —
 * não é substituir um filtro de servidor, nem paginar no cliente aquilo que o
 * servidor pagina. A tela declara isso, e quando o endpoint aceitar consulta,
 * o `useListController` já está no lugar para passá-la adiante.
 *
 * ## Permissões efetivas
 *
 * Vêm do **papel**, que `GET /organizations/current/roles` publica com a lista
 * `permissions`. É o mesmo dado que o backend usa para autorizar, exibido —
 * nenhuma permissão é derivada ou inferida aqui.
 */
import { useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAction } from "@/actions";
import { EntityBadge, MEMBER_STATUS_LABELS } from "@/entities";
import {
  useTeamMembers,
  useTeamRoles,
} from "@/hooks/workforce/use-workforce";
import { formatDateTime } from "@/lib/formatters";
import type { TeamMember } from "@/types/workforce";
import {
  FilterBar,
  FilterSelect,
  ListState,
  ResultSummary,
  SearchField,
  optionsFrom,
  useListController,
} from "@/workspace";
import { InviteMemberDialog } from "../invite-member.dialog";
import { MemberSheet } from "../member.sheet";

interface MemberFilters {
  search?: string;
  roleId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function MembersTab() {
  const members = useTeamMembers();
  const roles = useTeamRoles();
  const list = useListController<MemberFilters>();

  const invite = useAction("team-member.create");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const all = useMemo(() => members.data ?? [], [members.data]);

  const filtered = useMemo(() => {
    const term = list.query.search?.toLowerCase() ?? "";
    return all.filter((member) => {
      if (list.query.roleId && member.role.id !== list.query.roleId) {
        return false;
      }
      if (list.query.status && member.status !== list.query.status) {
        return false;
      }
      if (!term) return true;
      return (
        member.displayName.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term)
      );
    });
  }, [all, list.query.roleId, list.query.search, list.query.status]);

  const roleOptions = (roles.data ?? []).map((role) => ({
    value: role.id,
    label: role.name,
  }));

  const statusOptions = optionsFrom(
    [...new Set(all.map((member) => member.status))],
    MEMBER_STATUS_LABELS,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultSummary
          meta={
            members.data
              ? {
                  page: 1,
                  limit: all.length || 1,
                  total: filtered.length,
                  totalPages: 1,
                  hasNextPage: false,
                  hasPreviousPage: false,
                }
              : undefined
          }
          noun="pessoa"
          note="O backend devolve a equipe inteira, ordenada por nome — sem paginação."
        />
        {invite.allowed ? (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            {invite.label}
          </Button>
        ) : null}
      </div>

      <FilterBar onClear={list.reset} canClear={list.isFiltered}>
        <SearchField
          id="team-members-search"
          value={list.searchTerm}
          onChange={list.setSearchTerm}
          placeholder="Nome ou e-mail"
          hint="Busca sobre a lista já recebida — o endpoint de membros não aceita consulta."
        />
        <FilterSelect
          id="team-members-role"
          label="Papel"
          value={list.query.roleId}
          onChange={(value) => list.setFilter("roleId", value)}
          options={roleOptions}
          anyLabel="Todos"
        />
        <FilterSelect
          id="team-members-status"
          label="Situação"
          value={list.query.status}
          onChange={(value) => list.setFilter("status", value)}
          options={statusOptions}
        />
      </FilterBar>

      <ListState
        isPending={members.isPending}
        error={members.error}
        onRetry={() => void members.refetch()}
        items={filtered}
        empty={{
          icon: <Users className="size-5" />,
          title: list.isFiltered ? "Nenhuma pessoa encontrada" : "Equipe vazia",
          description: list.isFiltered
            ? "Ajuste a busca ou os filtros."
            : "Convide as pessoas que vão executar as operações em campo.",
          action:
            invite.allowed && !list.isFiltered ? (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" />
                {invite.label}
              </Button>
            ) : undefined,
        }}
      >
        {(rows) => (
          <div className="glass-panel overflow-x-auto rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelected(member)}
                        className="text-left"
                      >
                        <span className="flex items-center gap-2 font-medium hover:underline">
                          {member.displayName}
                          {member.isOwner ? (
                            <Badge variant="secondary">Dono</Badge>
                          ) : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.role.name}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.businessUnits.length > 0
                        ? member.businessUnits
                            .map((unit) => unit.tradeName ?? unit.legalName)
                            .join(", ")
                        : "Toda a organização"}
                    </TableCell>
                    <TableCell>
                      <EntityBadge
                        entity="team-member"
                        group="status"
                        value={member.status}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(member.joinedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ListState>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <MemberSheet
        member={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
