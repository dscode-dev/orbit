"use client";

/**
 * Cadastro de alguém da equipe, com senha temporária.
 *
 * ## Por que existe ao lado do convite
 *
 * O convite pressupõe que a pessoa tem e-mail, lê e-mail e conclui um cadastro
 * sozinha. Boa parte de uma equipe de campo não atende às três — e o resultado
 * era o owner não conseguir colocar o próprio técnico no sistema.
 *
 * ## A senha aparece uma vez
 *
 * Ela vem no 201 e não existe em lugar nenhum depois disso: não há coluna que a
 * guarde nem rota que a releia. Por isso o diálogo troca de estado em vez de
 * fechar — quem fecha sem copiar precisa gerar um link novo, e a tela diz isso
 * antes, não depois.
 */
import { useState } from "react";
import { Check, Copy, KeyRound, UserPlus } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBusinessUnits } from "@/hooks/organization/use-organization";
import {
  useCreateTeamMember,
  useTeamRoles,
} from "@/hooks/workforce/use-workforce";
import type { CreatedTeamMember } from "@/types/workforce";

/** O papel do dono não é oferecido: o servidor o recusa, e com razão. */
const PAPEL_DO_DONO = "OWNER";

export function CreateMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {/* Corpo remontado a cada abertura: a senha da criação anterior não
            pode reaparecer numa sessão nova do diálogo. */}
        <Body onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function Body({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const create = useCreateTeamMember();
  const roles = useTeamRoles();
  const units = useBusinessUnits();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");

  /** Preenchido, o formulário deu lugar à senha. */
  const [criado, setCriado] = useState<CreatedTeamMember | null>(null);

  const papeis = (roles.data ?? []).filter(
    (papel) => papel.key !== PAPEL_DO_DONO,
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        roleId,
        ...(businessUnitId ? { businessUnitId } : {}),
      },
      { onSuccess: setCriado },
    );
  };

  if (criado) {
    return (
      <SenhaGerada
        resultado={criado}
        onClose={() => onOpenChange(false)}
      />
    );
  }

  const incompleto =
    firstName.trim().length < 1 ||
    lastName.trim().length < 1 ||
    !email.includes("@") ||
    !roleId;

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>Cadastrar usuário</DialogTitle>
        <DialogDescription>
          A pessoa entra com uma senha temporária que você repassa, e é obrigada
          a trocá-la no primeiro acesso — no app e no site.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="member-first-name">Nome</Label>
          <Input
            id="member-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="member-last-name">Sobrenome</Label>
          <Input
            id="member-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="member-email">E-mail</Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Usado para entrar, mesmo que a pessoa não o leia"
            required
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="member-role">Papel</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id="member-role">
              <SelectValue placeholder="Escolher papel" />
            </SelectTrigger>
            <SelectContent>
              {papeis.map((papel) => (
                <SelectItem key={papel.id} value={papel.id}>
                  {papel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {descricaoDoPapel(
              papeis.find((papel) => papel.id === roleId)?.key,
            )}
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="member-unit">Unidade de negócio</Label>
          <Select value={businessUnitId} onValueChange={setBusinessUnitId}>
            <SelectTrigger id="member-unit">
              <SelectValue placeholder="Unidade principal" />
            </SelectTrigger>
            <SelectContent>
              {(units.data ?? []).map((unidade) => (
                <SelectItem key={unidade.id} value={unidade.id}>
                  {unidade.tradeName ?? unidade.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <MutationError error={create.error} />

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={incompleto || create.isPending}>
          <UserPlus className="size-4" />
          {create.isPending ? "Cadastrando…" : "Cadastrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** O papel escolhido, em uma frase — antes de conceder, não depois. */
function descricaoDoPapel(key: string | undefined): string {
  if (key === "FIELD_TECHNICIAN") {
    return "Executa o atendimento em campo: abre, preenche o checklist, registra material, emite e fecha.";
  }
  if (key === "ASSISTANT_TECHNICIAN") {
    return "Acompanha o atendimento: vê o que foi atribuído, abre a rota e compartilha o documento já emitido. Não executa nem emite.";
  }
  return "O papel define o que a pessoa pode fazer.";
}

function SenhaGerada({
  resultado,
  onClose,
}: {
  resultado: CreatedTeamMember;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resultado.temporaryPassword);
      setCopiado(true);
    } catch {
      /* Sem área de transferência: a senha está na tela para ser lida. */
    }
  };

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle>{resultado.member.displayName} cadastrado</DialogTitle>
        <DialogDescription>
          Esta senha aparece <strong>uma única vez</strong>. Guarde-a agora e
          repasse para a pessoa.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Senha temporária</p>
          <p
            className="mt-1 font-mono text-2xl font-semibold tracking-wider"
            data-testid="temporary-password"
          >
            {resultado.temporaryPassword}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={copiar}
        >
          {copiado ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          {copiado ? "Copiada" : "Copiar senha"}
        </Button>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {resultado.member.email} entra com esta senha e é levado direto para
            a troca — no app e no site. Se você perder a senha, gere um link de
            definição nas ações da pessoa.
          </span>
        </p>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Concluir
        </Button>
      </DialogFooter>
    </div>
  );
}
