"use client";

/**
 * Como o dinheiro aparece.
 *
 * O único lugar do módulo que converte `"1250.40"` em `R$ 1.250,40`. Não é
 * cálculo: `Number(value)` acontece uma vez, para formatar, e o resultado
 * nunca volta a ser somado. Todo total exibido no Financeiro veio pronto do
 * servidor.
 *
 * O formatador é o **do Metric Registry** — `FORMATTERS.currency`. Um
 * `Intl.NumberFormat` local aqui seria o segundo mapa de formatação da
 * aplicação, e os dois divergiriam na primeira mudança de moeda.
 */
import { cn } from "@/lib/utils";
import { FORMATTERS } from "@/metrics";
import type { FinancialEntryType } from "@/types/financial";

/**
 * Valor monetário.
 *
 * `signed` desenha o sentido: receita com `+`, despesa com `−`. O sinal é
 * **apresentação** — o backend guarda todo valor positivo e diz o sentido em
 * `type`, justamente para que somar a coluna não dependa de como cada
 * lançamento foi digitado.
 */
export function Money({
  value,
  type,
  signed = false,
  muted = false,
  className,
}: {
  value: string;
  type?: FinancialEntryType;
  signed?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const amount = Number(value);
  const formatted = Number.isFinite(amount)
    ? FORMATTERS.currency(amount)
    : value;

  const tone = muted
    ? "text-muted-foreground"
    : type === "INCOME"
      ? "text-emerald-400"
      : type === "EXPENSE"
        ? "text-rose-400"
        : "text-foreground";

  const prefix = signed && type ? (type === "INCOME" ? "+" : "−") : "";

  return (
    <span className={cn("font-mono tabular-nums", tone, className)}>
      {prefix}
      {formatted}
    </span>
  );
}

/**
 * Data de competência.
 *
 * Vem como `YYYY-MM-DD` de uma coluna `DATE`, **sem hora e sem fuso**. Passar
 * isso por `new Date()` a interpretaria como meia-noite UTC e, num fuso
 * negativo, a exibiria um dia antes — o lançamento do dia 1º apareceria em 31.
 * Por isso a formatação é textual.
 */
export function CompetenceDate({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>{formatDay(value)}</span>
  );
}

/** `2026-08-05` → `05/08/2026`, sem passar por `Date`. */
export function formatDay(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

/** `2026-08` → `ago/2026`, para os rótulos da série mensal. */
export function formatMonth(value: string): string {
  const [year, month] = value.split("-");
  const index = Number(month) - 1;
  return year && MONTHS[index] ? `${MONTHS[index]}/${year}` : value;
}

const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/**
 * Marca de vencido.
 *
 * `isOverdue` é publicado pelo backend, comparado contra o relógio **do
 * servidor**. Recalcular aqui deixaria o atraso na mão do relógio do
 * navegador — e um computador com a data errada passaria a decidir o que está
 * em dia.
 */
export function OverdueMark({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return (
    <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-xs font-medium text-rose-400">
      Vencido
    </span>
  );
}
