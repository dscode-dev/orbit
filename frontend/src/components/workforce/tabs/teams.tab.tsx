"use client";

/**
 * Equipes operacionais.
 *
 * Agrupam pessoas para escala e atribuição. Uma equipe pode ter líder e ficar
 * vinculada a uma unidade — os dois opcionais, porque nem toda organização
 * trabalha assim.
 *
 * ## Membros vêm da equipe, não da tela
 *
 * `GET /workforce/teams` já devolve os membros embutidos, com nome e papel na
 * equipe. Adicionar ou remover devolve a equipe atualizada — a tela nunca
 * recompõe a lista por conta própria.
 */
import { useState } from "react";
import { Plus, Trash2, Users, UserPlus, X } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
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
import { useAction } from "@/actions";
import {
  useAddTeamMember,
  useCreateTeam,
  useRemoveTeam,
  useRemoveTeamMember,
  useTeamMembers,
  useTeams,
} from "@/hooks/workforce/use-workforce";
import type { Team } from "@/types/workforce";
import { ListState } from "@/workspace";

export function TeamsTab() {
  const query = useTeams();
  const manage = useAction("team-member.update");

  const create = useCreateTeam();
  const remove = useRemoveTeam();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const teams = query.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Equipes agrupam pessoas para escala e atribuição de trabalho.
        </p>
        {manage.allowed && !adding ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Nova equipe
          </Button>
        ) : null}
      </div>

      {adding ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate(
              { name: name.trim() },
              {
                onSuccess: () => {
                  setName("");
                  setAdding(false);
                },
              },
            );
          }}
          className="glass-panel space-y-3 rounded-xl p-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Nome da equipe</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Equipe Norte"
              required
            />
          </div>

          <MutationError error={create.error} />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdding(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? "Criando…" : "Criar"}
            </Button>
          </div>
        </form>
      ) : null}

      <MutationError error={remove.error} />

      <ListState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        items={teams}
        rows={3}
        empty={{
          icon: <Users className="size-5" />,
          title: "Nenhuma equipe",
          description:
            "Equipes agrupam quem trabalha junto — útil para escalar e atribuir em bloco.",
          action: manage.allowed ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Nova equipe
            </Button>
          ) : undefined,
        }}
      >
        {(rows) => (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onRemove={() => remove.mutate(team.id)}
                removing={remove.isPending && remove.variables === team.id}
              />
            ))}
          </div>
        )}
      </ListState>
    </div>
  );
}

function TeamCard({
  team,
  onRemove,
  removing,
}: {
  team: Team;
  onRemove: () => void;
  removing: boolean;
}) {
  const manage = useAction("team-member.update");
  const members = useTeamMembers({ page: 1, limit: 100 });

  const add = useAddTeamMember(team.id);
  const removeMember = useRemoveTeamMember(team.id);

  const [userId, setUserId] = useState("");

  const inTeam = new Set(team.members.map((member) => member.userId));
  const available = (members.data?.data ?? []).filter(
    (member) => !inTeam.has(member.userId),
  );

  return (
    <article className="glass-panel space-y-4 rounded-xl p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-medium">
            {team.name}
            <Badge variant="outline">
              {team.memberCount === 1
                ? "1 pessoa"
                : `${team.memberCount} pessoas`}
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground">
            {team.leader
              ? `Líder: ${team.leader.displayName}`
              : "Sem líder definido"}
            {team.businessUnit
              ? ` · ${team.businessUnit.tradeName ?? team.businessUnit.legalName}`
              : ""}
          </p>
        </div>

        {manage.allowed ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remover ${team.name}`}
            disabled={removing}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </header>

      {team.members.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {team.members.map((member) => (
            <li key={member.userId}>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
                {member.displayName}
                {member.role ? (
                  <span className="text-muted-foreground">· {member.role}</span>
                ) : null}
                {manage.allowed ? (
                  <button
                    type="button"
                    onClick={() => removeMember.mutate(member.userId)}
                    disabled={removeMember.isPending}
                    aria-label={`Remover ${member.displayName} da equipe`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Equipe sem pessoas.</p>
      )}

      {manage.allowed && available.length > 0 ? (
        <div className="flex items-end gap-2 border-t border-border pt-3">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger
              className="flex-1"
              aria-label={`Adicionar pessoa a ${team.name}`}
            >
              <SelectValue placeholder="Adicionar pessoa" />
            </SelectTrigger>
            <SelectContent>
              {available.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!userId || add.isPending}
            onClick={() =>
              add.mutate({ userId }, { onSuccess: () => setUserId("") })
            }
          >
            <UserPlus className="size-4" />
          </Button>
        </div>
      ) : null}

      <MutationError error={add.error ?? removeMember.error} />
    </article>
  );
}
