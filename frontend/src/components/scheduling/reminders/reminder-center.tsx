"use client";

/**
 * Central de Lembretes.
 *
 * ## O que um lembrete é, no contrato que existe
 *
 * Um evento do Scheduling em um **calendário próprio**. Não há modelo de
 * "lembrete" no backend, e inventar um no cliente criaria uma entidade que só
 * este navegador conhece. O que existe é: calendário, evento, recorrência e
 * status — e é exatamente o que a central usa.
 *
 * Por que um calendário separado e não um `type` reservado: `EventQueryDto`
 * **não filtra por tipo**. Filtra por `calendarId`. Um calendário dedicado
 * torna a leitura um recorte de servidor, não uma filtragem no cliente sobre
 * uma página qualquer de eventos.
 *
 * ## Como cada campo pedido se traduz
 *
 * | Pedido               | Contrato usado                                    |
 * | -------------------- | ------------------------------------------------- |
 * | tipo de operação     | `type` do evento (texto livre, sugestões do kind)  |
 * | período do lembrete  | `startsAt`/`endsAt`, com atalhos de 3, 6 e 12 meses |
 * | recorrência          | `recurrence` (`RecurrenceDto`), expandida no servidor |
 * | ativação             | `status`: `CONFIRMED` ativo, `CANCELLED` desativado |
 *
 * A ativação merece a nota explícita: **o evento não tem campo `isActive`**.
 * `CANCELLED` é o estado que o contrato oferece para "não vale mais", e é o
 * que a central usa — sem criar bandeira paralela em `metadata`, que nenhuma
 * outra parte do sistema leria.
 *
 * ## A lacuna: nada dispara sozinho
 *
 * "Concluir uma instalação e gerar um lembrete de retorno em 6 meses" exige
 * uma automação no backend — um gatilho na conclusão da operação. Ela **não
 * existe**: não há regra, fila ou job que reaja a `PATCH /operations/:id/status`.
 * A central cria e agenda o lembrete; quem o cria é uma pessoa. A proposta de
 * evolução mínima está em `docs/ux-improvements.md`.
 */
import { useMemo, useState } from "react";
import { BellRing, CalendarClock, Pencil, Power } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { EmptyState } from "@/components/feedback/states";
import { PanelError, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useSchedulingCalendars,
  useSchedulingOccurrences,
  useUpdateSchedulingEvent,
} from "@/hooks/scheduling/use-scheduling";
import { addZonedMonths, formatZonedDateTime } from "@/lib/scheduling";
import { useSession } from "@/providers/session-provider";
import { useActiveScope } from "@/providers/use-active-scope";
import type {
  SchedulingCalendar,
  SchedulingOccurrence,
} from "@/types/scheduling";
import { CalendarSetup } from "../calendar-setup";
import { useSchedulingTimeZone } from "../use-scheduling-timezone";
import { ReminderFormDialog } from "./reminder-form.dialog";

/** Chave do calendário que guarda os lembretes. */
export const REMINDERS_CALENDAR_KEY = "LEMBRETES";

/**
 * Horizonte consultado.
 *
 * `EventQueryDto` exige `from` e `to`, e o serviço recusa janelas maiores que
 * **366 dias** ("Schedule range cannot exceed 366 days" — verificado). Então a
 * central olha do mês passado até onze meses à frente: doze meses, o máximo
 * que cabe em uma consulta. Um lembrete que dispara além disso continua
 * existindo; só não aparece nesta janela, e a tela diz qual janela é.
 */
const HORIZON_MONTHS = 11;

export function ReminderCenter() {
  const session = useSession();
  const { businessUnitId } = useActiveScope();
  const { timeZone } = useSchedulingTimeZone();

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const calendars = useSchedulingCalendars(businessUnitId ?? undefined);
  const remindersCalendar = findReminders(calendars.data ?? []);

  /**
   * Janela consultada — quantizada no dia para não gerar query key nova a
   * cada render.
   */
  const today = new Date().toISOString().slice(0, 10);
  const query = useMemo(() => {
    const reference = new Date(`${today}T12:00:00Z`);
    return {
      from: addZonedMonths(reference, -1, timeZone).toISOString(),
      to: addZonedMonths(reference, HORIZON_MONTHS, timeZone).toISOString(),
      calendarId: remindersCalendar?.id,
      businessUnitId: businessUnitId ?? undefined,
    };
  }, [today, timeZone, remindersCalendar?.id, businessUnitId]);

  const occurrences = useSchedulingOccurrences(query);

  const canManage =
    session.hasPermission("scheduling.events.create") &&
    session.hasCapability("scheduling.manage");

  /**
   * Uma linha por regra, não por ocorrência.
   *
   * O backend expande a recorrência e devolve cada ocorrência da janela — o
   * que é certo para a grade e errado para uma central de configuração: um
   * lembrete trimestral apareceria oito vezes. A deduplicação é por `eventId`;
   * a contagem de ocorrências acompanha a linha.
   */
  const rules = useMemo(
    () => dedupeByRule(occurrences.data ?? []),
    [occurrences.data],
  );

  if (calendars.isPending) return <PanelLoading rows={4} />;
  if (calendars.error) {
    return (
      <PanelError
        error={calendars.error}
        onRetry={() => void calendars.refetch()}
      />
    );
  }

  if (!remindersCalendar) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Os lembretes ficam em um calendário próprio, separado da agenda de
          trabalho. Crie-o para começar.
        </p>
        <CalendarSetup
          timeZone={timeZone}
          businessUnitId={businessUnitId ?? undefined}
          suggestedName="Lembretes"
          isFirst={(calendars.data ?? []).length === 0}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rules.length === 0
            ? "Nenhum lembrete configurado"
            : `${rules.length} lembrete(s) nos próximos 12 meses · calendário ${remindersCalendar.name}`}
        </p>
        {canManage ? (
          <Button
            onClick={() => {
              setEditingEventId(null);
              setFormOpen(true);
            }}
          >
            <BellRing className="size-4" />
            Novo lembrete
          </Button>
        ) : null}
      </div>

      {occurrences.isPending ? (
        <PanelLoading rows={5} />
      ) : occurrences.error ? (
        <PanelError
          error={occurrences.error}
          onRetry={() => void occurrences.refetch()}
        />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title="Nenhum lembrete nos próximos doze meses"
          description="Configure retornos de visita, renovação de contrato ou qualquer rotina que precise voltar à agenda."
        />
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <ReminderRow
              key={rule.eventId}
              rule={rule}
              timeZone={timeZone}
              canManage={canManage}
              onEdit={() => {
                setEditingEventId(rule.eventId);
                setFormOpen(true);
              }}
            />
          ))}
        </ul>
      )}

      <ReminderFormDialog
        open={formOpen}
        editingEventId={editingEventId}
        calendar={remindersCalendar}
        timeZone={timeZone}
        businessUnitId={businessUnitId ?? undefined}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingEventId(null);
        }}
      />
    </div>
  );
}

interface ReminderRule {
  readonly eventId: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  /** O backend marca a ocorrência como parte de uma regra recorrente. */
  readonly recurring: boolean;
  /** Quantas ocorrências a regra produz na janela consultada. */
  readonly occurrences: number;
  /** Ocorrência mais próxima dentro da janela. */
  readonly nextAt: string;
}

function findReminders(
  calendars: readonly SchedulingCalendar[],
): SchedulingCalendar | undefined {
  return calendars.find(
    (calendar) => calendar.key.toUpperCase() === REMINDERS_CALENDAR_KEY,
  );
}

function dedupeByRule(
  occurrences: readonly SchedulingOccurrence[],
): readonly ReminderRule[] {
  const byEvent = new Map<string, ReminderRule>();

  for (const occurrence of occurrences) {
    const existing = byEvent.get(occurrence.eventId);
    if (!existing) {
      byEvent.set(occurrence.eventId, {
        eventId: occurrence.eventId,
        title: occurrence.title,
        type: occurrence.type,
        status: occurrence.status,
        recurring: occurrence.recurring,
        occurrences: 1,
        nextAt: occurrence.startsAt,
      });
      continue;
    }
    byEvent.set(occurrence.eventId, {
      ...existing,
      occurrences: existing.occurrences + 1,
      nextAt:
        occurrence.startsAt < existing.nextAt
          ? occurrence.startsAt
          : existing.nextAt,
    });
  }

  return [...byEvent.values()].sort((left, right) =>
    left.nextAt.localeCompare(right.nextAt),
  );
}

function ReminderRow({
  rule,
  timeZone,
  canManage,
  onEdit,
}: {
  rule: ReminderRule;
  timeZone: string;
  canManage: boolean;
  onEdit: () => void;
}) {
  const toggle = useUpdateSchedulingEvent(rule.eventId);
  const active = rule.status !== "CANCELLED";

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-lg border border-border px-3 py-3">
      <BellRing
        className={
          active
            ? "mt-0.5 size-4 text-primary"
            : "mt-0.5 size-4 text-muted-foreground"
        }
        aria-hidden
      />

      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{rule.title}</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {rule.type}
          </Badge>
          {!active ? <Badge variant="secondary">Desativado</Badge> : null}
        </p>

        <p className="text-xs text-muted-foreground">
          Próximo em {formatZonedDateTime(rule.nextAt, timeZone)}
          {rule.recurring
            ? ` · recorrente · ${rule.occurrences} ocorrência(s) nesta janela`
            : " · sem repetição"}
        </p>

        <MutationError error={toggle.error} />
      </div>

      {canManage ? (
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={toggle.isPending}
            onClick={() =>
              toggle.mutate({ status: active ? "CANCELLED" : "CONFIRMED" })
            }
          >
            <Power className="size-4" />
            {active ? "Desativar" : "Ativar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            Editar
          </Button>
        </div>
      ) : null}
    </li>
  );
}
