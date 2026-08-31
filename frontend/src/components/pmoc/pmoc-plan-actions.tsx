"use client";

/**
 * As ações do plano: editar e mudar de estado.
 *
 * ## O lifecycle vem do servidor
 *
 * `allowedTransitions` é publicado no detalhe do plano — a máquina de estados
 * já resolvida para a situação atual. É ela que decide quais botões existem.
 *
 * Deduzir `status === "DRAFT" → pode ativar` reconstruiria no navegador a
 * regra que o servidor publica pronta, e ela envelheceria na primeira mudança
 * do domínio. É a mesma doutrina da PR-FE-01, aplicada ao PMOC.
 *
 * ## Editar não tem autoridade publicada
 *
 * O backend recusa edição de plano encerrado ou cancelado
 * (`EDITABLE_STATUSES`), mas **não publica** isso em nenhum campo. Então a
 * ação segue pela permissão — como `operations.delete` na PR-FE-02 — e a
 * recusa do servidor é exibida como veio. Registrado como lacuna em
 * `docs/pmoc-v2-web.md`.
 */
import { useState } from "react";
import { MoreHorizontal, Pencil } from "lucide-react";

import { ConfirmDialog } from "@/components/financial/confirm.dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useActivatePmocPlan,
  useCancelPmocPlan,
  useSuspendPmocPlan,
} from "@/hooks/pmoc/use-pmoc";
import { useSession } from "@/providers/session-provider";
import type { PmocPlan } from "@/types/pmoc";
import { PmocPlanEditDialog } from "./pmoc-plan-edit.dialog";

/**
 * Cada transição, com o texto que o usuário precisa para decidir.
 *
 * O efeito descrito é o que o domínio garante — nada além. "Suspender" não
 * promete pausar a agenda nem avisar ninguém, porque o contrato não diz isso.
 */
const TRANSITIONS: Readonly<
  Record<
    string,
    { label: string; title: string; body: string; destructive?: boolean }
  >
> = {
  ACTIVE: {
    label: "Ativar",
    title: "Ativar PMOC",
    body: "O plano passa a valer: o primeiro ciclo é aberto e a periodicidade começa a contar.",
  },
  SUSPENDED: {
    label: "Suspender",
    title: "Suspender PMOC",
    body: "Novos ciclos deixam de ser gerados e as execuções ficam indisponíveis enquanto o plano estiver suspenso. O histórico permanece.",
  },
  CANCELLED: {
    label: "Cancelar plano",
    title: "Cancelar PMOC",
    body: "O encerramento é definitivo — o plano não volta a valer. Os ciclos já cumpridos e os documentos emitidos permanecem no histórico.",
    destructive: true,
  },
};

export function PmocPlanActions({ plan }: { plan: PmocPlan }) {
  const session = useSession();
  const canManage = session.hasPermission("pmoc.manage");

  const activate = useActivatePmocPlan(plan.id);
  const suspend = useSuspendPmocPlan(plan.id);
  const cancel = useCancelPmocPlan(plan.id);

  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  if (!canManage) return null;

  /** Só o que o servidor publicou como transição possível agora. */
  const transitions = plan.allowedTransitions.filter(
    (status) => status in TRANSITIONS,
  );

  const mutationFor = (status: string) =>
    status === "ACTIVE" ? activate : status === "SUSPENDED" ? suspend : cancel;

  const current = pending ? TRANSITIONS[pending] : null;
  const mutation = pending ? mutationFor(pending) : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Editar
        </Button>

        {transitions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Ações do plano ${plan.code}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {transitions.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => setPending(status)}
                  className={
                    TRANSITIONS[status]?.destructive
                      ? "text-destructive focus:text-destructive"
                      : undefined
                  }
                >
                  {TRANSITIONS[status]?.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={current?.title ?? ""}
        body={current?.body}
        confirmLabel={current?.label ?? "Confirmar"}
        isPending={mutation?.isPending ?? false}
        error={mutation?.error ?? null}
        onConfirm={() => {
          mutation?.mutate(undefined, { onSuccess: () => setPending(null) });
        }}
      />

      <PmocPlanEditDialog
        plan={plan}
        open={editing}
        onOpenChange={setEditing}
      />
    </>
  );
}
