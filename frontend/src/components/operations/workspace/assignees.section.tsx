"use client";

/**
 * Operadores vinculados à operação.
 *
 * A lista vem de `GET /operations/:id` (`users`). A remoção usa
 * `DELETE /operations/:id/assignments/:userId`.
 *
 * **Atribuir** exige o `userId` de um membro da organização, e o backend não
 * expõe endpoint de listagem de usuários do tenant (`/identity/me` cobre só o
 * próprio usuário; `/platform-admin/users` é global e restrito ao
 * administrador da plataforma). Sem essa fonte, um seletor de técnicos seria
 * um campo de UUID cru — a ação fica documentada como pendente de backend.
 */
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { PanelFrame, PanelState, type PanelQuery } from "@/components/panels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUnassignOperationUser } from "@/hooks/operations/use-operations";
import { formatDateTime } from "@/lib/formatters";
import { useSession } from "@/providers/session-provider";
import type { Operation, OperationAssignment } from "@/types/operations";

/** Permissão exigida por `POST`/`DELETE /operations/:id/assignments`. */
const ASSIGN_PERMISSION = "operations.assign";

export function AssigneesSection({
  operationId,
  query,
}: {
  operationId: string;
  query: PanelQuery<Operation>;
}) {
  const session = useSession();
  const canAssign = session.hasPermission(ASSIGN_PERMISSION);
  const unassign = useUnassignOperationUser(operationId);

  async function remove(assignment: OperationAssignment) {
    try {
      await unassign.mutateAsync(assignment.userId);
      toast.success(`${assignment.user.displayName} removido da operação`);
    } catch (error) {
      toast.error("Não foi possível remover o técnico", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <PanelFrame
      panelId="operation-assignees"
      title="Equipe"
      description="Técnicos atribuídos à operação"
      actions={
        query.data ? (
          <Badge variant="secondary">{query.data.users.length}</Badge>
        ) : null
      }
    >
      <PanelState
        query={query}
        loadingRows={3}
        emptyMessage="Nenhum técnico atribuído."
        isEmpty={(operation) => operation.users.length === 0}
      >
        {(operation) => (
          <ul className="space-y-3">
            {operation.users.map((assignment) => (
              <li
                key={assignment.userId}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback>
                      {initials(assignment.user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {assignment.user.displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      desde {formatDateTime(assignment.assignedAt)}
                    </p>
                  </div>
                </div>
                {canAssign ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${assignment.user.displayName}`}
                    disabled={unassign.isPending}
                    onClick={() => void remove(assignment)}
                  >
                    {unassign.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserMinus className="size-4" />
                    )}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelState>
    </PanelFrame>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
