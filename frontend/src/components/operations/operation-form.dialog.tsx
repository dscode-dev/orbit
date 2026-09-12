"use client";

/**
 * Criação e edição de operação.
 *
 * Escreve em `POST /operations` e `PATCH /operations/:id`. O que o DTO exige
 * está aqui e nada além: unidade, código, tipo, título, descrição, prioridade,
 * janela prevista, cliente e ativo.
 *
 * ## O que não é decidido aqui
 *
 * - **Status.** Quem o define na criação é o backend, a partir da janela
 *   informada: criar com agendamento devolveu `SCHEDULED`, não `OPEN`
 *   (verificado). Depois disso só muda por `PATCH /operations/:id/status`, que
 *   valida a transição — `SCHEDULED → SCHEDULED` é recusado com mensagem. O
 *   formulário não oferece o campo.
 * - **Código.** É livre no contrato (`@MinLength(2)`), sem unicidade
 *   declarada e sem geração no servidor. O formulário sugere um formato ao
 *   criar e deixa editar; quem recusa duplicidade, se houver regra, é o
 *   backend.
 * - **Conflito de agenda.** Operação não passa pelo motor de agenda — a
 *   janela prevista é informativa, e nenhuma sobreposição é avaliada.
 *
 * ## Referências
 *
 * Cliente e ativo reaproveitam o `ReferencePicker` da agenda, que consulta
 * `/customers` e `/assets` reais. Quando o plano não concede `crm.read` ou
 * `assets.read`, o backend responde 403 e o seletor declara a
 * indisponibilidade em vez de sumir sem explicação.
 */
import { useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { ReferencePicker } from "@/components/scheduling/reference-picker";
import { schedulingReferencesService } from "@/services/scheduling-references.service";
import {
  useCreateOperation,
  useUpdateOperation,
} from "@/hooks/operations/use-operations";
import { instantFromZoned, zonedParts } from "@/lib/scheduling";
import { X } from "lucide-react";

import { useFieldTechnicians } from "@/hooks/workforce/use-workforce";
import { useSession } from "@/providers/session-provider";
import { useActiveScope } from "@/providers/use-active-scope";
import { OperationKind, OperationPriority } from "@/types/contracts";
import {
  OPERATION_LIMITS,
  type CreateOperationInput,
  type OperationListItem,
} from "@/types/operations";
import { operationKindLabel, operationPriorityLabel } from "./operation-badges";

/** `Select` não aceita item de valor vazio; este é o "ninguém ainda". */
const SEM_RESPONSAVEL = "__none__";

interface FormState {
  businessUnitId: string;
  code: string;
  kind: string;
  title: string;
  description: string;
  priority: string;
  startLocal: string;
  customerId: string;
  assetId: string;
  responsibleId: string;
  auxiliaryIds: string[];
}

/**
 * Contexto que já se conhece antes de abrir o formulário.
 *
 * Existe para a entrada por etiqueta QR: o servidor prepara o atendimento
 * (`GET /assets/:id/service-order-preparation`) e devolve equipamento, cliente
 * e unidade. Preencher **não** é criar — o formulário abre como qualquer
 * outro, e a criação continua dependendo de alguém confirmar.
 *
 * Os rótulos acompanham os identificadores porque os seletores mostram nome, e
 * sem eles o campo apareceria preenchido com um UUID.
 */
export interface OperationPrefill {
  readonly businessUnitId?: string;
  readonly customerId?: string;
  readonly assetId?: string;
  readonly title?: string;
  readonly customerLabel?: string;
  readonly assetLabel?: string;
}

export function OperationFormDialog({
  open,
  editing,
  timeZone,
  prefill,
  onOpenChange,
}: {
  open: boolean;
  /** Operação em edição, ou `null` para criação. */
  editing: OperationListItem | null;
  timeZone: string;
  prefill?: OperationPrefill;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {open ? (
          <OperationForm
            editing={editing}
            timeZone={timeZone}
            prefill={prefill}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function OperationForm({
  editing,
  timeZone,
  prefill,
  onClose,
}: {
  editing: OperationListItem | null;
  timeZone: string;
  prefill?: OperationPrefill;
  onClose: () => void;
}) {
  const session = useSession();
  const { businessUnitId } = useActiveScope();
  const create = useCreateOperation();
  const update = useUpdateOperation(editing?.id ?? "");
  const mutation = editing ? update : create;

  const [form, setForm] = useState<FormState>(() =>
    initialState(
      editing,
      businessUnitId,
      session.businessUnits,
      timeZone,
      prefill,
    ),
  );
  const [labels, setLabels] = useState<{ customer?: string; asset?: string }>(
    () => ({
      customer:
        editing?.customer?.tradeName ??
        editing?.customer?.legalName ??
        prefill?.customerLabel,
      asset: editing?.asset?.name ?? prefill?.assetLabel,
    }),
  );

  const edit = (patch: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  const valid =
    form.businessUnitId.length > 0 &&
    form.code.trim().length >= OPERATION_LIMITS.codeMinLength &&
    form.title.trim().length >= OPERATION_LIMITS.titleMinLength &&
    form.kind.length > 0;

  const submit = () => {
    const payload = buildPayload(form, timeZone);
    if (editing) {
      update.mutate(payload, { onSuccess: onClose });
      return;
    }
    create.mutate(payload, { onSuccess: onClose });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {editing ? `Editar ${editing.code}` : "Nova operação"}
        </DialogTitle>
        <DialogDescription>
          Horários no fuso {timeZone}. A situação inicial e as mudanças
          possíveis seguem as regras do atendimento.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="operation-title">Título</Label>
          <Input
            id="operation-title"
            value={form.title}
            maxLength={OPERATION_LIMITS.titleMaxLength}
            onChange={(event) => edit({ title: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="operation-code">Código</Label>
          <Input
            id="operation-code"
            value={form.code}
            maxLength={OPERATION_LIMITS.codeMaxLength}
            onChange={(event) => edit({ code: event.target.value })}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="operation-kind">Tipo</Label>
          <Select
            value={form.kind}
            onValueChange={(value) => edit({ kind: value })}
          >
            <SelectTrigger id="operation-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(OperationKind).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {operationKindLabel(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="operation-unit">Unidade</Label>
          <Select
            value={form.businessUnitId}
            onValueChange={(value) => edit({ businessUnitId: value })}
          >
            <SelectTrigger id="operation-unit">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {session.businessUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.tradeName ?? unit.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="operation-priority">Prioridade</Label>
          <Select
            value={form.priority}
            onValueChange={(value) => edit({ priority: value })}
          >
            <SelectTrigger id="operation-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(OperationPriority).map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {operationPriorityLabel(priority)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/*
          Só o começo.

          "Fim previsto" saiu: quem agenda sabe quando o técnico chega, não
          quando termina — a duração depende do que for encontrado no local.
          Um campo que pede uma previsão que ninguém tem produz dado que
          ninguém confere. O contrato mantém `scheduledEnd` opcional; o
          formulário deixa de pedi-lo.
        */}
        <div className="space-y-2">
          <Label htmlFor="operation-start">Início previsto</Label>
          <Input
            id="operation-start"
            type="datetime-local"
            value={form.startLocal}
            onChange={(event) => edit({ startLocal: event.target.value })}
          />
        </div>

        <ReferencePicker
          id="operation-customer"
          label="Cliente"
          placeholder="Sem cliente"
          value={form.customerId || undefined}
          selectedLabel={labels.customer}
          queryKey={schedulingReferencesService.keys.customers}
          fetcher={(search, options) =>
            schedulingReferencesService.customers(search, options)
          }
          toOption={(customer) => ({
            id: customer.id,
            label: customer.tradeName ?? customer.legalName,
          })}
          onChange={(customerId, label) => {
            edit({ customerId: customerId ?? "" });
            setLabels((current) => ({ ...current, customer: label }));
          }}
        />

        <ReferencePicker
          id="operation-asset"
          label="Equipamento"
          placeholder="Sem equipamento"
          value={form.assetId || undefined}
          selectedLabel={labels.asset}
          queryKey={schedulingReferencesService.keys.assets}
          fetcher={(search, options) =>
            schedulingReferencesService.assets(search, options)
          }
          toOption={(asset) => ({
            id: asset.id,
            label: asset.name,
            hint: asset.identifier,
          })}
          onChange={(assetId, label) => {
            edit({ assetId: assetId ?? "" });
            setLabels((current) => ({ ...current, asset: label }));
          }}
        />

        {/*
          Quem executa e quem acompanha.

          Os dois campos existem no contrato desde sempre e nenhuma tela os
          enviava: o atendimento nascia sem dono, e atribuir exigia abrir a
          operação depois de criada.
        */}
        <div className="sm:col-span-2">
          <TechnicianAssignment
            responsibleId={form.responsibleId}
            auxiliaryIds={form.auxiliaryIds}
            onChange={(patch) => edit(patch)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="operation-description">Descrição</Label>
          <Textarea
            id="operation-description"
            rows={3}
            value={form.description}
            onChange={(event) => edit({ description: event.target.value })}
          />
        </div>
      </div>

      <MutationError error={mutation.error} />

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={!valid || mutation.isPending}>
          {mutation.isPending
            ? "Salvando…"
            : editing
              ? "Salvar alterações"
              : "Criar operação"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Código sugerido: prefixo e o dia, para não nascer em branco. */
function suggestedCode(): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = String(now.getTime() % 1000).padStart(3, "0");
  return `OS-${stamp}-${suffix}`;
}

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

function initialState(
  editing: OperationListItem | null,
  activeUnitId: string | null,
  units: readonly { id: string; isPrimary: boolean }[],
  timeZone: string,
  prefill?: OperationPrefill,
): FormState {
  if (editing) {
    return {
      businessUnitId: editing.businessUnitId,
      code: editing.code,
      kind: editing.kind,
      title: editing.title,
      description: editing.description ?? "",
      priority: editing.priority,
      startLocal: toLocalInput(editing.scheduledStart, timeZone),
      responsibleId: editing.responsibleFieldTechnicianId ?? "",
      /// A atribuição carrega `userId`; o `user` aninhado é só para exibir.
      auxiliaryIds: (editing.auxiliaryTechnicians ?? []).map(
        (item) => item.userId,
      ),
      customerId: editing.customerId ?? "",
      assetId: editing.assetId ?? "",
    };
  }

  const fallbackUnit =
    activeUnitId ??
    units.find((unit) => unit.isPrimary)?.id ??
    units[0]?.id ??
    "";

  return {
    businessUnitId: prefill?.businessUnitId || fallbackUnit,
    code: suggestedCode(),
    kind: OperationKind.MAINTENANCE,
    title: prefill?.title ?? "",
    description: "",
    priority: OperationPriority.NORMAL,
    /**
     * Data em branco de propósito.
     *
     * A preparação sabe **o que** será atendido, não **quando**. Sugerir
     * "agora" faria a etiqueta parecer um comando de início — exatamente o que
     * o domínio recusa.
     */
    startLocal: "",
    responsibleId: "",
    auxiliaryIds: [],
    customerId: prefill?.customerId ?? "",
    assetId: prefill?.assetId ?? "",
  };
}

function buildPayload(form: FormState, timeZone: string): CreateOperationInput {
  return {
    businessUnitId: form.businessUnitId,
    code: form.code.trim(),
    kind: form.kind as CreateOperationInput["kind"],
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    priority: form.priority as CreateOperationInput["priority"],
    scheduledStart: toInstant(form.startLocal, timeZone),
    responsibleFieldTechnicianId: form.responsibleId || undefined,
    auxiliaryTechnicianIds:
      form.auxiliaryIds.length > 0 ? form.auxiliaryIds : undefined,
    customerId: form.customerId || undefined,
    assetId: form.assetId || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Atribuição                                                          */
/* ------------------------------------------------------------------ */

/**
 * O responsável e os auxiliares do atendimento.
 *
 * ## Os dois papéis não são o mesmo com nomes diferentes
 *
 * O **responsável** executa: inicia, responde o checklist, registra
 * evidência, conclui e assina. O **auxiliar** acompanha: no aplicativo de
 * campo ele lê o atendimento e os documentos já emitidos, e não executa nada.
 *
 * Quem garante isso é o servidor, em `MobileFieldOperationService.actions` —
 * a lista de ações permitidas é dele. Este formulário só declara quem é quem.
 *
 * ## Por que uma pessoa não pode ser as duas coisas
 *
 * Estar nas duas listas tornaria a pergunta "esta pessoa pode concluir?"
 * dependente da ordem em que o servidor olhasse as listas. Quem é escolhido
 * como responsável some das opções de auxiliar, e vice-versa.
 */
function TechnicianAssignment({
  responsibleId,
  auxiliaryIds,
  onChange,
}: {
  responsibleId: string;
  auxiliaryIds: string[];
  onChange: (patch: {
    responsibleId?: string;
    auxiliaryIds?: string[];
  }) => void;
}) {
  const technicians = useFieldTechnicians();
  const pessoas = technicians.data ?? [];

  const nomeDe = (id: string) =>
    pessoas.find((pessoa) => pessoa.id === id)?.name ?? id;

  const disponiveisComoAuxiliar = pessoas.filter(
    (pessoa) =>
      pessoa.id !== responsibleId && !auxiliaryIds.includes(pessoa.id),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="operation-responsible">Técnico responsável</Label>
        <Select
          value={responsibleId || SEM_RESPONSAVEL}
          onValueChange={(value) =>
            onChange({
              responsibleId: value === SEM_RESPONSAVEL ? "" : value,
              /// Se a pessoa já era auxiliar, deixa de ser ao virar
              /// responsável: os dois papéis se excluem.
              auxiliaryIds: auxiliaryIds.filter((id) => id !== value),
            })
          }
        >
          <SelectTrigger id="operation-responsible">
            <SelectValue placeholder="Definir depois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_RESPONSAVEL}>Definir depois</SelectItem>
            {pessoas
              .filter((pessoa) => !auxiliaryIds.includes(pessoa.id))
              .map((pessoa) => (
                <SelectItem key={pessoa.id} value={pessoa.id}>
                  {pessoa.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Executa o atendimento no aplicativo de campo.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="operation-auxiliary">Auxiliares</Label>
        <Select
          value=""
          onValueChange={(value) =>
            onChange({ auxiliaryIds: [...auxiliaryIds, value] })
          }
          disabled={disponiveisComoAuxiliar.length === 0}
        >
          <SelectTrigger id="operation-auxiliary">
            <SelectValue placeholder="Adicionar auxiliar" />
          </SelectTrigger>
          <SelectContent>
            {disponiveisComoAuxiliar.map((pessoa) => (
              <SelectItem key={pessoa.id} value={pessoa.id}>
                {pessoa.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {auxiliaryIds.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {auxiliaryIds.map((id) => (
              <li key={id}>
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-strong px-2 py-0.5 text-xs">
                  {nomeDe(id)}
                  <button
                    type="button"
                    aria-label={`Remover ${nomeDe(id)}`}
                    onClick={() =>
                      onChange({
                        auxiliaryIds: auxiliaryIds.filter(
                          (item) => item !== id,
                        ),
                      })
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Acompanham: leem o atendimento e os documentos emitidos, sem executar.
        </p>
      </div>
    </div>
  );
}
