/**
 * Normalização dos Read Models para o que as visões consomem.
 *
 * As visões (dia, semana, mês, lista) recebem **fatias por dia**, não a lista
 * crua de ocorrências. Isso desacopla os componentes da fonte: trocar
 * `GET /scheduling/events` por outro endpoint — ou por um cache offline no
 * aplicativo móvel — não muda nenhuma grade.
 *
 * Duas situações que só aparecem quando se olha o contrato de perto:
 *
 * **Evento que cruza a meia-noite.** Uma ocorrência das 22h às 2h precisa
 * aparecer nos dois dias, recortada em cada um, com marca de continuação. Sem
 * isso ela sumiria do segundo dia ou apareceria inteira nos dois.
 *
 * **Evento de dia inteiro.** `allDay: true` não tem horário a mostrar; ocupa a
 * faixa do dia toda e é listado à parte, acima da grade de horas.
 *
 * Recortar para exibição não é recalcular nada: os instantes vêm do servidor e
 * continuam intactos em `occurrence`.
 */
import type { SchedulingOccurrence } from "@/types/scheduling";
import {
  addZonedDays,
  minutesIntoZonedDay,
  startOfZonedDay,
  zonedDateKey,
} from "./timezone";
import type { ViewWindow } from "./view-window";

const MINUTES_IN_DAY = 24 * 60;

export interface DaySegment {
  readonly occurrence: SchedulingOccurrence;
  /** Minutos desde a meia-noite local, dentro deste dia. */
  readonly startMinute: number;
  readonly endMinute: number;
  /** A ocorrência começou antes deste dia. */
  readonly continuesBefore: boolean;
  /** A ocorrência termina depois deste dia. */
  readonly continuesAfter: boolean;
}

export interface DayBucket {
  readonly dayKey: string;
  /** Ocorrências de dia inteiro, ou que cobrem o dia todo. */
  readonly allDay: readonly DaySegment[];
  /** Ocorrências com horário, em ordem cronológica. */
  readonly timed: readonly DaySegment[];
}

/**
 * Distribui as ocorrências pelos dias locais da janela.
 *
 * Devolve um bucket para **todo** dia da janela, inclusive os vazios — as
 * grades precisam desenhar o dia sem evento.
 */
export function groupByDay(
  occurrences: readonly SchedulingOccurrence[],
  days: readonly string[],
  timeZone: string,
): ReadonlyMap<string, DayBucket> {
  const allDay = new Map<string, DaySegment[]>();
  const timed = new Map<string, DaySegment[]>();
  for (const day of days) {
    allDay.set(day, []);
    timed.set(day, []);
  }

  for (const occurrence of occurrences) {
    for (const segment of splitByDay(occurrence, timeZone)) {
      const bucket =
        occurrence.allDay || coversWholeDay(segment) ? allDay : timed;
      const target = bucket.get(segment.dayKey);
      /** Fora da janela pedida: o backend pode devolver borda. */
      if (target) target.push(segment.segment);
    }
  }

  const result = new Map<string, DayBucket>();
  for (const day of days) {
    result.set(day, {
      dayKey: day,
      allDay: allDay.get(day) ?? [],
      timed: (timed.get(day) ?? []).sort(
        (left, right) => left.startMinute - right.startMinute,
      ),
    });
  }
  return result;
}

/** Recorta uma ocorrência nos dias locais que ela atravessa. */
function splitByDay(
  occurrence: SchedulingOccurrence,
  timeZone: string,
): readonly { dayKey: string; segment: DaySegment }[] {
  const start = new Date(occurrence.startsAt);
  const end = new Date(occurrence.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const segments: { dayKey: string; segment: DaySegment }[] = [];
  let cursor = startOfZonedDay(start, timeZone);

  /** Guarda contra evento com fim anterior ao início ou duração absurda. */
  for (let guard = 0; guard < 366; guard += 1) {
    const dayKey = zonedDateKey(cursor, timeZone);
    const nextDay = addZonedDays(cursor, 1, timeZone);
    if (cursor >= end && segments.length > 0) break;

    const startsHere = start >= cursor;
    const endsHere = end <= nextDay;

    segments.push({
      dayKey,
      segment: {
        occurrence,
        startMinute: startsHere ? minutesIntoZonedDay(start, timeZone) : 0,
        endMinute: endsHere
          ? minutesOrEndOfDay(end, cursor, timeZone)
          : MINUTES_IN_DAY,
        continuesBefore: !startsHere,
        continuesAfter: !endsHere,
      },
    });

    if (endsHere) break;
    cursor = nextDay;
  }

  return segments;
}

/**
 * Minutos do fim dentro do dia.
 *
 * Um evento que termina exatamente à meia-noite pertence ao dia anterior, não
 * ao seguinte — daí o `MINUTES_IN_DAY` em vez de zero.
 */
function minutesOrEndOfDay(
  end: Date,
  dayStart: Date,
  timeZone: string,
): number {
  const minutes = minutesIntoZonedDay(end, timeZone);
  if (minutes === 0 && end > dayStart) return MINUTES_IN_DAY;
  return minutes;
}

function coversWholeDay(entry: { segment: DaySegment }): boolean {
  return (
    entry.segment.startMinute === 0 &&
    entry.segment.endMinute === MINUTES_IN_DAY
  );
}

/** Ocorrências da janela em ordem cronológica — base da visão em lista. */
export function chronological(
  occurrences: readonly SchedulingOccurrence[],
): readonly SchedulingOccurrence[] {
  return [...occurrences].sort(
    (left, right) =>
      Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
      left.title.localeCompare(right.title),
  );
}

/**
 * Índice de conflitos por evento.
 *
 * O backend devolve os conflitos como lista própria, com o `eventId` de cada
 * lado. Indexar permite marcar o evento na grade sem varrer a lista a cada
 * célula — e sem recalcular sobreposição, que é decisão dele.
 */
export function conflictsByEvent(
  conflicts: readonly { eventId?: string; conflictingEventId?: string }[],
): ReadonlyMap<string, number> {
  const index = new Map<string, number>();
  const bump = (eventId: string | undefined) => {
    if (!eventId) return;
    index.set(eventId, (index.get(eventId) ?? 0) + 1);
  };
  for (const conflict of conflicts) {
    bump(conflict.eventId);
    bump(conflict.conflictingEventId);
  }
  return index;
}

/** Janela em ISO, como os endpoints esperam. */
export function toIsoRange(window: ViewWindow): { from: string; to: string } {
  return { from: window.from.toISOString(), to: window.to.toISOString() };
}
