/**
 * Janela de consulta e agrupamento por dia, no fuso da unidade.
 *
 * ## Por que a janela é calculada aqui, e não pedida ao `GET /scheduling/agenda`
 *
 * O endpoint de agenda existe e devolve os dias já agrupados — mas agrupa em
 * **UTC**:
 *
 * ```ts
 * // scheduling.service.ts
 * private viewRange(view: string, date: Date) {
 *   const from = new Date(date);
 *   from.setUTCHours(0, 0, 0, 0);   // meia-noite UTC, não local
 *   …
 * }
 * const date = event.startsAt.slice(0, 10);   // dia em UTC
 * ```
 *
 * Para um tenant em `America/Recife` (UTC−3), uma visita às 22h de terça é
 * `01:00Z` de quarta — e cairia no balde do dia errado. A "visão do dia" iria
 * das 21h de segunda às 21h de terça.
 *
 * Então o Workspace usa `GET /scheduling/events?from&to`, que devolve as
 * ocorrências já expandidas pelo motor de recorrência do backend, e calcula os
 * limites da janela no fuso da unidade. **Isso não move regra de negócio para
 * o cliente**: quais eventos existem, como a recorrência se expande, o que é
 * conflito e o que é indisponibilidade continuam sendo respostas do servidor.
 * O que se decide aqui é o recorte da consulta e em que dia da tela cada
 * ocorrência aparece — apresentação.
 *
 * A lacuna está registrada em `docs/scheduling-workspace.md`: bastaria o
 * `AgendaQueryDto` aceitar `timezone` para o agrupamento voltar ao servidor.
 */
import {
  addZonedDays,
  addZonedMonths,
  startOfZonedDay,
  startOfZonedMonth,
  startOfZonedWeek,
  zonedDateKey,
  zonedParts,
} from "./timezone";

export const SCHEDULING_VIEWS = ["DAY", "WEEK", "MONTH", "LIST"] as const;
export type SchedulingView = (typeof SCHEDULING_VIEWS)[number];

export interface ViewWindow {
  /** Início inclusivo, como instante. */
  readonly from: Date;
  /** Fim exclusivo, como instante. */
  readonly to: Date;
  /** Dias locais cobertos pela janela, em ordem. */
  readonly days: readonly string[];
  readonly timeZone: string;
}

/** Quantos dias a visão em lista cobre a partir da data de referência. */
const LIST_HORIZON_DAYS = 30;

export function buildViewWindow(
  view: SchedulingView,
  reference: Date,
  timeZone: string,
): ViewWindow {
  const from = startOf(view, reference, timeZone);
  const to = endOf(view, from, timeZone);
  return { from, to, days: enumerateDays(from, to, timeZone), timeZone };
}

function startOf(
  view: SchedulingView,
  reference: Date,
  timeZone: string,
): Date {
  if (view === "WEEK") return startOfZonedWeek(reference, timeZone);
  if (view === "MONTH") return startOfZonedMonth(reference, timeZone);
  return startOfZonedDay(reference, timeZone);
}

function endOf(view: SchedulingView, from: Date, timeZone: string): Date {
  if (view === "WEEK") return addZonedDays(from, 7, timeZone);
  if (view === "MONTH") return addZonedMonths(from, 1, timeZone);
  if (view === "LIST") return addZonedDays(from, LIST_HORIZON_DAYS, timeZone);
  return addZonedDays(from, 1, timeZone);
}

/**
 * Avança ou recua uma janela inteira.
 *
 * A navegação anda em unidades do calendário local — mês a mês, semana a
 * semana —, não em blocos de 24 horas.
 */
export function shiftReference(
  view: SchedulingView,
  reference: Date,
  direction: 1 | -1,
  timeZone: string,
): Date {
  if (view === "MONTH") return addZonedMonths(reference, direction, timeZone);
  if (view === "WEEK") return addZonedDays(reference, 7 * direction, timeZone);
  if (view === "LIST") {
    return addZonedDays(reference, LIST_HORIZON_DAYS * direction, timeZone);
  }
  return addZonedDays(reference, direction, timeZone);
}

/**
 * A grade do mês começa no domingo da semana do dia 1 e termina no sábado da
 * semana do último dia — as seis linhas de um calendário.
 */
export function monthGridDays(
  reference: Date,
  timeZone: string,
): readonly string[] {
  const monthStart = startOfZonedMonth(reference, timeZone);
  const gridStart = startOfZonedWeek(monthStart, timeZone);
  const nextMonth = addZonedMonths(monthStart, 1, timeZone);
  const lastDay = addZonedDays(nextMonth, -1, timeZone);
  const gridEnd = addZonedDays(
    startOfZonedWeek(lastDay, timeZone),
    7,
    timeZone,
  );
  return enumerateDays(gridStart, gridEnd, timeZone);
}

/** Chaves `AAAA-MM-DD` de todos os dias locais entre dois instantes. */
export function enumerateDays(
  from: Date,
  to: Date,
  timeZone: string,
): readonly string[] {
  const days: string[] = [];
  let cursor = startOfZonedDay(from, timeZone);
  /** Guarda contra fuso inválido, que faria o cursor não avançar. */
  for (let guard = 0; cursor < to && guard < 400; guard += 1) {
    days.push(zonedDateKey(cursor, timeZone));
    cursor = addZonedDays(cursor, 1, timeZone);
  }
  return days;
}

/** Rótulo do período apresentado no cabeçalho. */
export function describeWindow(
  view: SchedulingView,
  window: ViewWindow,
): string {
  const { from, timeZone } = window;

  if (view === "DAY") {
    return capitalize(
      new Intl.DateTimeFormat("pt-BR", {
        timeZone,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(from),
    );
  }

  if (view === "MONTH") {
    return capitalize(
      new Intl.DateTimeFormat("pt-BR", {
        timeZone,
        month: "long",
        year: "numeric",
      }).format(from),
    );
  }

  const last = addZonedDays(window.to, -1, timeZone);
  const short = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "short",
  });
  return `${short.format(from)} — ${short.format(last)}`;
}

/** Rótulo curto de um dia da grade (`AAAA-MM-DD` → "12"). */
export function dayNumber(dayKey: string): string {
  return dayKey.slice(8, 10).replace(/^0/, "");
}

/** O dia pertence ao mês de referência? Usado para esmaecer a grade. */
export function belongsToMonth(
  dayKey: string,
  reference: Date,
  timeZone: string,
): boolean {
  const parts = zonedParts(reference, timeZone);
  return (
    dayKey.slice(0, 7) ===
    `${parts.year}-${String(parts.month).padStart(2, "0")}`
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
