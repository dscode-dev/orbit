"use client";

/**
 * Papel e situação de um membro.
 *
 * Escreve em `PATCH /organizations/current/members/:userId`. O DTO aceita
 * **dois campos**, e o formulário oferece exatamente esses dois.
 *
 * ## Por que não edita nome, e-mail ou avatar
 *
 * Não é limitação: é a divisão do domínio. Identidade é do **perfil**, que
 * cada pessoa administra em `identity/me`. Um gestor decide o que alguém pode
 * fazer na organização; não decide como essa pessoa se chama.
 *
 * ## O dono não aparece aqui
 *
 * `ownerUserId` é atributo da organização, e o servidor recusa alterá-lo
 * (`400 The organization owner cannot be modified here`). Rebaixar o dono
 * deixaria a conta sem ninguém capaz de administrá-la — e transferir a
 * propriedade é outra operação, com outras consequências.
 */
import { useState } from "react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEMBER_STATUS_LABELS } from "@/entities";
import {
  useTeamRoles,
  useUpdateMember,
} from "@/hooks/workforce/use-workforce";
import {
  MembershipStatus,
  type TeamMember,
  type UpdateMemberInput,
} from "@/types/workforce";

export function MemberFormDialog({
  member,
  onOpenChange,
}: {
  member: TeamMember | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {member ? (
          <Body key={member.userId} member={member} onOpenChange={onOpenChange} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  member,
  onOpenChange,
}: {
  member: TeamMember;
  onOpenChange: (open: boolean) => void;
}) {
  const roles = useTeamRoles();
  const update = useUpdateMember(member.userId);

  const [roleId, setRoleId] = useState(member.role.id);
  const [status, setStatus] = useState<string>(member.status);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    /**
     * Só o que mudou viaja.
     *
     * `undefined` significa "não mexa" no DTO — enviar o valor atual seria uma
     * escrita sem motivo, e cada escrita é uma linha a mais na auditoria.
     */
    const input: UpdateMemberInput = {
      roleId: roleId === member.role.id ? undefined : roleId,
      status:
        status === member.status ? undefined : (status as MembershipStatus),
    };

    if (!input.roleId && !input.status) {
      onOpenChange(false);
      return;
    }

    update.mutate(input, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>{member.displayName}</DialogTitle>
        <DialogDescription>
          Papel e situação na organização. Nome, e-mail e foto são do perfil,
          que cada pessoa administra.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="member-role">Papel</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id="member-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(roles.data ?? []).map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O papel define as permissões. Trocá-lo altera o que esta pessoa
            pode fazer imediatamente.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="member-status">Situação</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="member-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(MembershipStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {MEMBER_STATUS_LABELS[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Quem não está ativo permanece na organização e no histórico, mas
            deixa de receber trabalho.
          </p>
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Unidades</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {member.businessUnits.length > 0 ? (
              member.businessUnits.map((unit) => (
                <Badge key={unit.id} variant="outline">
                  {unit.tradeName ?? unit.legalName}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                Toda a organização
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            O vínculo de unidade é definido no convite. Não há rota para
            alterá-lo depois.
          </p>
        </div>
      </div>

      <MutationError error={update.error} />

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
