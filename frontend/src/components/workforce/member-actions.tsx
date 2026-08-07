"use client";

/**
 * Ações sobre um membro, no cabeçalho do detalhe.
 *
 * O **dono não é editável**: `ownerUserId` é atributo da organização, e o
 * servidor recusa (400). A tela reflete a mesma condição e diz o motivo, em
 * vez de esconder o botão sem explicação.
 */
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAction } from "@/actions";
import type { TeamMember } from "@/types/workforce";

export function MemberActions({
  member,
  onEdit,
}: {
  member: TeamMember;
  onEdit?: () => void;
}) {
  const edit = useAction("team-member.update");

  if (!edit.allowed || !onEdit) return null;

  if (member.isOwner) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" disabled>
              <edit.definition.icon className="size-4" />
              Papel e situação
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          O dono da organização não é alterado por aqui — rebaixá-lo deixaria a
          conta sem quem a administre.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={onEdit}>
      <edit.definition.icon className="size-4" />
      Papel e situação
    </Button>
  );
}
