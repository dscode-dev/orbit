"use client";

/**
 * Usuários da organização.
 *
 * ## Paginado pelo servidor
 *
 * `GET /organizations/current/members` pagina (`MemberQueryDto`). Busca por
 * nome e filtro por papel ainda são locais — o DTO não os aceita —, e a tela
 * diz isso: são recorte da **página carregada**, não da organização.
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
  Pagination,
  ResultSummary,
  SearchField,
  optionsFrom,
  useListController,
} from "@/workspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteMemberDialog } from "../invite-member.dialog";
import { MemberFormDialog } from "../member-form.dialog";
import { MemberSheet } from "../member.sheet";

interface MemberFilters {
  search?: string;
  roleId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function MembersTab() {
  const list = useListController<MemberFilters>({ limit: 20 });
  const members = useTeamMembers({
    page: list.query.page,
    limit: list.query.limit,
  });
  const roles = useTeamRoles();

  const invite = useAction("team-member.create");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const all = useMemo(() => members.data?.data ?? [], [members.data]);
  const meta = members.data?.meta;

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
          meta={meta}
          noun="pessoa"
          gender="f"
          note={
            list.isFiltered
              ? "Busca e papel filtram apenas esta página."
              : "Ordenado por nome"
          }
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
          hint="Busca sobre a página carregada."
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
                  <TableHead className="w-12" />
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
                    <TableCell>
                      <MemberRowActions
                        member={member}
                        onOpen={() => setSelected(member)}
                        onEdit={() => setEditing(member)}
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
        isFetching={members.isFetching}
      />

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <MemberSheet
        member={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onEdit={setEditing}
      />

      <MemberFormDialog
        member={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

/**
 * Ações de linha.
 *
 * O **dono não é editável**: `ownerUserId` é atributo da organização, e o
 * servidor recusa (400). A tela reflete a mesma condição em vez de oferecer um
 * botão que voltaria erro.
 */
function MemberRowActions({
  member,
  onOpen,
  onEdit,
}: {
  member: TeamMember;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const edit = useAction("team-member.update");
  const editable = edit.allowed && !member.isOwner;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ações de ${member.displayName}`}
        >
          <span aria-hidden>⋯</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>Detalhes</DropdownMenuItem>
        {editable ? (
          <DropdownMenuItem onSelect={onEdit}>
            <edit.definition.icon className="size-4" />
            Papel e situação
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
