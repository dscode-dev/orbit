"use client";

/**
 * Ações do Owner sobre uma operação, direto da lista.
 *
 * Cada ação é uma chamada a um endpoint que já existia; nenhuma delas
 * reproduz regra:
 *
 * | Ação        | Endpoint                              |
 * | ----------- | ------------------------------------- |
 * | Editar      | `PATCH /operations/:id`               |
 * | Reagendar   | `PATCH /operations/:id` (janela)      |
 * | Prioridade  | `PATCH /operations/:id` (prioridade)  |
 * | Reatribuir  | `POST`/`DELETE /operations/:id/assignments` |
 * | Cancelar    | `PATCH /operations/:id/status`        |
 * | Excluir     | `DELETE /operations/:id`              |
 *
 * ## Transições
 *
 * O menu oferece **todos** os status do literal e deixa o backend recusar o
 * que não vale. Reproduzir aqui a máquina de estados criaria uma segunda
 * verdade que envelheceria na primeira mudança do servidor — a recusa vem com
 * mensagem e é exibida como está.
 *
 * ## Permissões
 *
 * `operations.update`, `operations.assign`, `operations.status.update` e
 * `operations.delete` são exigidas pelo backend. As ações são escondidas de
 * quem não as tem — não para proteger (o servidor protege), mas para não
 * oferecer o que vai falhar.
 */
import { useState } from "react";
import {
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCog,
  XCircle,
} from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useAssignOperationUser,
  useChangeOperationStatus,
  useRemoveOperation,
  useUnassignOperationUser,
  useUpdateOperation,
} from "@/hooks/operations/use-operations";
import { useOrganizationMembers } from "@/hooks/organization/use-organization";
import { instantFromZoned, zonedParts } from "@/lib/scheduling";
import { useSession } from "@/providers/session-provider";
import { OperationPriority, OperationStatus } from "@/types/contracts";
import {
  OPERATION_LIMITS,
  OPERATION_STATUS_LABELS,
  type Operation,
} from "@/types/operations";
import { operationPriorityLabel } from "./operation-badges";

type ActionKind = "reschedule" | "assign" | "priority" | "status" | "delete";

export function OperationActions({
  operation,
  timeZone,
  onEdit,
}: {
  operation: Operation;
  timeZone: string;
  onEdit: () => void;
}) {
  const session = useSession();
  const [action, setAction] = useState<ActionKind | null>(null);

  const canUpdate = session.hasPermission("operations.update");
  const canAssign = session.hasPermission("operations.assign");
  const canChangeStatus = session.hasPermission("operations.status.update");
  const canDelete = session.hasPermission("operations.delete");

  if (!canUpdate && !canAssign && !canChangeStatus && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Ações da operação ${operation.code}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-mono text-xs">
            {operation.code}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {canUpdate ? (
            <>
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAction("reschedule")}>
                <CalendarClock className="size-4" />
                Reagendar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAction("priority")}>
                <MoreHorizontal className="size-4" />
                Alterar prioridade
              </DropdownMenuItem>
            </>
          ) : null}

          {canAssign ? (
            <DropdownMenuItem onSelect={() => setAction("assign")}>
              <UserCog className="size-4" />
              Reatribuir técnico
            </DropdownMenuItem>
          ) : null}

          {canChangeStatus ? (
            <DropdownMenuItem onSelect={() => setAction("status")}>
              <XCircle className="size-4" />
              Alterar status
            </DropdownMenuItem>
          ) : null}

          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setAction("delete")}
              >
                <Trash2 className="size-4" />
                Excluir
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {action === "reschedule" ? (
            <RescheduleForm
              operation={operation}
              timeZone={timeZone}
              onClose={() => setAction(null)}
            />
          ) : null}
          {action === "priority" ? (
            <PriorityForm
              operation={operation}
              onClose={() => setAction(null)}
            />
          ) : null}
          {action === "assign" ? (
            <AssignForm operation={operation} onClose={() => setAction(null)} />
          ) : null}
          {action === "status" ? (
            <StatusForm operation={operation} onClose={() => setAction(null)} />
          ) : null}
          {action === "delete" ? (
            <DeleteForm operation={operation} onClose={() => setAction(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Reagendar                                                           */
/* ------------------------------------------------------------------ */

function RescheduleForm({
  operation,
  timeZone,
  onClose,
}: {
  operation: Operation;
  timeZone: string;
  onClose: () => void;
}) {
  const update = useUpdateOperation(operation.id);
  const [start, setStart] = useState(() =>
    toLocalInput(operation.scheduledStart, timeZone),
  );
  const [end, setEnd] = useState(() =>
    toLocalInput(operation.scheduledEnd, timeZone),
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reagendar {operation.code}</DialogTitle>
        <DialogDescription>
          Janela prevista, no fuso {timeZone}. A operação não passa pelo motor
          de agenda — nenhuma sobreposição é avaliada.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reschedule-start">Início</Label>
          <Input
            id="reschedule-start"
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reschedule-end">Fim</Label>
          <Input
            id="reschedule-end"
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      </div>

      <MutationError error={update.error} />

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={update.isPending || (!!start && !!end && end < start)}
          onClick={() =>
            update.mutate(
              {
                scheduledStart: toInstant(start, timeZone),
                scheduledEnd: toInstant(end, timeZone),
              },
              { onSuccess: onClose },
            )
          }
        >
          {update.isPending ? "Salvando…" : "Reagendar"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Prioridade                                                          */
/* ------------------------------------------------------------------ */

function PriorityForm({
  operation,
  onClose,
}: {
  operation: Operation;
  onClose: () => void;
}) {
  const update = useUpdateOperation(operation.id);
  const [priority, setPriority] = useState<string>(operation.priority);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Prioridade de {operation.code}</DialogTitle>
        <DialogDescription>
          A prioridade não altera a ordem da listagem — o backend ordena por
          agendamento e criação.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="operation-priority-change">Prioridade</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger id="operation-priority-change">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(OperationPriority).map((value) => (
              <SelectItem key={value} value={value}>
                {operationPriorityLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <MutationError error={update.error} />

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={update.isPending || priority === operation.priority}
          onClick={() =>
            update.mutate(
              { priority: priority as Operation["priority"] },
              { onSuccess: onClose },
            )
          }
        >
          {update.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Reatribuição                                                        */
/* ------------------------------------------------------------------ */

/**
 * Reatribuir é atribuir e desatribuir.
 *
 * Não existe endpoint de troca; `POST /assignments` adiciona e
 * `DELETE /assignments/:userId` remove. A tela executa as duas chamadas na
 * ordem — adicionar primeiro, para que a operação nunca fique sem responsável
 * caso a segunda falhe.
 */
function AssignForm({
  operation,
  onClose,
}: {
  operation: Operation;
  onClose: () => void;
}) {
  const members = useOrganizationMembers();
  const assign = useAssignOperationUser(operation.id);
  const unassign = useUnassignOperationUser(operation.id);

  const current = operation.users.map((entry) => entry.userId);
  const [selected, setSelected] = useState<string>(current[0] ?? "");

  const eligible = (members.data ?? []).filter(
    (member) => member.status === "ACTIVE",
  );

  const replace = async () => {
    if (!selected) return;
    if (!current.includes(selected)) {
      await assign.mutateAsync({ userId: selected });
    }
    for (const userId of current) {
      if (userId !== selected) await unassign.mutateAsync(userId);
    }
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Responsável por {operation.code}</DialogTitle>
        <DialogDescription>
          {current.length === 0
            ? "Sem técnico atribuído."
            : `Hoje: ${operation.users.map((entry) => entry.user.displayName).join(", ")}`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="operation-assignee">Técnico</Label>
        <Select
          value={selected}
          disabled={members.isPending || eligible.length === 0}
          onValueChange={setSelected}
        >
          <SelectTrigger id="operation-assignee">
            <SelectValue
              placeholder={members.isPending ? "Carregando…" : "Selecione"}
            />
          </SelectTrigger>
          <SelectContent>
            {eligible.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.displayName} · {member.role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          O backend aceita mais de um responsável por operação; esta tela
          trabalha com um, e substituir remove os demais.
        </p>
      </div>

      <MutationError error={members.error ?? assign.error ?? unassign.error} />

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={
            !selected ||
            assign.isPending ||
            unassign.isPending ||
            (current.length === 1 && current[0] === selected)
          }
          onClick={() => void replace()}
        >
          {assign.isPending || unassign.isPending ? "Atribuindo…" : "Atribuir"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

function StatusForm({
  operation,
  onClose,
}: {
  operation: Operation;
  onClose: () => void;
}) {
  const change = useChangeOperationStatus(operation.id);
  const [status, setStatus] = useState<string>(operation.status);
  const [reason, setReason] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Status de {operation.code}</DialogTitle>
        <DialogDescription>
          Quem valida a transição é o backend. Um destino inválido é recusado
          com a mensagem do servidor.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="operation-status">Novo status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="operation-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(OperationStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {OPERATION_STATUS_LABELS[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="operation-status-reason">Motivo</Label>
          <Textarea
            id="operation-status-reason"
            rows={2}
            value={reason}
            maxLength={OPERATION_LIMITS.statusReasonMaxLength}
            placeholder="Registrado no histórico da operação"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </div>

      <MutationError error={change.error} />

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={change.isPending || status === operation.status}
          onClick={() =>
            change.mutate(
              {
                status: status as Operation["status"],
                reason: reason.trim() || undefined,
              },
              { onSuccess: onClose },
            )
          }
        >
          {change.isPending ? "Aplicando…" : "Aplicar"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Exclusão                                                            */
/* ------------------------------------------------------------------ */

function DeleteForm({
  operation,
  onClose,
}: {
  operation: Operation;
  onClose: () => void;
}) {
  const remove = useRemoveOperation();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Excluir {operation.code}?</DialogTitle>
        <DialogDescription>
          A exclusão é lógica no backend: o registro sai das listagens e o
          histórico permanece no banco. Cancelar a operação, mudando o status,
          preserva o rastro na interface.
        </DialogDescription>
      </DialogHeader>

      <MutationError error={remove.error} />

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Manter
        </Button>
        <Button
          variant="destructive"
          disabled={remove.isPending}
          onClick={() => remove.mutate(operation.id, { onSuccess: onClose })}
        >
          {remove.isPending ? "Excluindo…" : "Excluir"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

function toLocalInput(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const parts = zonedParts(new Date(iso), timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function toInstant(local: string, timeZone: string): string | undefined {
  if (!local) return undefined;
  const [date, time] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time ?? "00:00").split(":").map(Number);
  return instantFromZoned(
    { year, month, day, hour, minute },
    timeZone,
  ).toISOString();
}
