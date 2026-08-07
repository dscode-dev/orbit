"use client";

/**
 * Criação e edição de papel.
 *
 * ## As permissões vêm dos papéis existentes
 *
 * Não há catálogo de permissões no backend — `Role.permissions` é um
 * `String[]` sem validação contra uma lista. O formulário oferece as
 * permissões que **já aparecem** nos papéis da organização, agrupadas por
 * módulo, e aceita digitar uma nova.
 *
 * Inventar aqui uma lista fixa de permissões seria criar um catálogo paralelo
 * que envelheceria a cada módulo novo do servidor — e que não impediria nada,
 * porque o backend aceita qualquer string. Quem não reconhece uma permissão
 * simplesmente não a concede a nada.
 *
 * ## `key` é do servidor
 *
 * Derivada do nome (`Técnico de Campo` → `TECNICO_DE_CAMPO`), para manter o
 * padrão dos papéis semeados sem pedir um identificador técnico a quem está
 * cadastrando.
 */
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateRole,
  useTeamRoles,
  useUpdateRole,
} from "@/hooks/workforce/use-workforce";
import type { TeamRole } from "@/types/workforce";

export function RoleFormDialog({
  role,
  open,
  onOpenChange,
}: {
  role: TeamRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <Body
          key={role?.id ?? "new"}
          role={role}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function Body({
  role,
  onOpenChange,
}: {
  role: TeamRole | null;
  onOpenChange: (open: boolean) => void;
}) {
  const roles = useTeamRoles();
  const create = useCreateRole();
  const update = useUpdateRole(role?.id ?? "");
  const mutation = role ? update : create;

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(
    role ? [...role.permissions] : [],
  );
  const [draft, setDraft] = useState("");

  /**
   * Permissões conhecidas: as que já existem em algum papel da organização.
   *
   * É o mais próximo de um catálogo que o contrato permite — e envelhece
   * sozinho, porque cresce com os papéis que a plataforma semeia.
   */
  const known = useMemo(() => {
    const all = new Set<string>();
    for (const item of roles.data ?? []) {
      for (const permission of item.permissions) all.add(permission);
    }
    return [...all].sort();
  }, [roles.data]);

  const selected = new Set(permissions);
  const available = known.filter((permission) => !selected.has(permission));

  const add = (permission: string) => {
    const value = permission.trim();
    if (!value || selected.has(value)) return;
    setPermissions((current) => [...current, value].sort());
    setDraft("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>{role ? "Editar papel" : "Novo papel"}</DialogTitle>
        <DialogDescription>
          As permissões deste papel valem para todas as pessoas que o têm.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="role-name">Nome</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Técnico de Campo"
            required
          />
          {role ? (
            <p className="text-xs text-muted-foreground">
              O identificador (<span className="font-mono">{role.key}</span>) é
              gerado pelo servidor a partir do nome.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role-description">Descrição</Label>
          <Textarea
            id="role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Permissões concedidas</Label>

          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma permissão — quem tiver este papel não poderá fazer nada.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {permissions.map((permission) => (
                <li key={permission}>
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface-strong px-1.5 py-0.5 font-mono text-[11px]">
                    {permission}
                    <button
                      type="button"
                      onClick={() =>
                        setPermissions((current) =>
                          current.filter((item) => item !== permission),
                        )
                      }
                      aria-label={`Remover ${permission}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add(draft);
                }
              }}
              placeholder="modulo.acao"
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => add(draft)}
              disabled={!draft.trim()}
              aria-label="Adicionar permissão"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {available.length > 0 ? (
            <div className="space-y-1.5 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Permissões já usadas por outros papéis desta organização:
              </p>
              <ul className="flex flex-wrap gap-1">
                {available.map((permission) => (
                  <li key={permission}>
                    <button
                      type="button"
                      onClick={() => add(permission)}
                      className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-surface-strong hover:text-foreground"
                    >
                      + {permission}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Não há catálogo de permissões no backend: qualquer texto é aceito, e
            o que o servidor não reconhece simplesmente não concede nada.
          </p>
        </div>
      </div>

      <MutationError error={mutation.error} />

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={name.trim().length < 2 || mutation.isPending}
        >
          {mutation.isPending ? "Salvando…" : role ? "Salvar" : "Criar papel"}
        </Button>
      </DialogFooter>
    </form>
  );
}
