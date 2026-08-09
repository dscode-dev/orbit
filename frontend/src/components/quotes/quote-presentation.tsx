"use client";

/**
 * Como a proposta aparece.
 *
 * Dinheiro usa `FORMATTERS.currency` do Metric Registry — o mesmo do
 * Financeiro. Um `Intl.NumberFormat` local aqui seria o terceiro mapa de
 * formatação da aplicação.
 *
 * Nada nestes componentes soma, subtrai ou compara datas para decidir estado:
 * subtotal, desconto, total e `isExpired` vêm prontos do servidor.
 */
import { AlertTriangle, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { FORMATTERS } from "@/metrics";
import type { Quote, QuoteSummary } from "@/types/quotes";

/** Valor monetário publicado como string. A conversão é só para formatar. */
export function Money({
  value,
  className,
  muted = false,
}: {
  value: string;
  className?: string;
  muted?: boolean;
}) {
  const amount = Number(value);
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        muted && "text-muted-foreground",
        className,
      )}
    >
      {Number.isFinite(amount) ? FORMATTERS.currency(amount) : value}
    </span>
  );
}

/**
 * Quantidade com três casas, sem zeros inúteis.
 *
 * O contrato publica `"4.000"`; mostrar assim faria toda peça parecer medida
 * em milésimos. `2.500` continua `2,5` porque meia hora existe.
 */
export function Quantity({ value }: { value: string }) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return <span>{value}</span>;
  return (
    <span className="tabular-nums">
      {amount.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
    </span>
  );
}

/** `2026-08-05` → `05/08/2026`, sem passar por `Date` — a coluna é `DATE`. */
export function formatDay(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function ValidUntil({
  quote,
}: {
  quote: Pick<QuoteSummary, "validUntil" | "isExpired">;
}) {
  if (!quote.validUntil) {
    return <span className="text-muted-foreground">sem prazo</span>;
  }
  return (
    <span
      className={cn(
        "tabular-nums",
        quote.isExpired && "text-orange-400",
      )}
    >
      {formatDay(quote.validUntil)}
    </span>
  );
}

/**
 * Aviso de que o item é uma fotografia.
 *
 * É a informação que o enunciado pede para deixar visualmente clara, e que
 * mais gera dúvida no uso: alguém muda o preço no Catálogo, volta ao orçamento
 * e não entende por que o valor não acompanhou. Não acompanha de propósito —
 * uma proposta que muda de valor sozinha é uma proposta que ninguém pode
 * honrar.
 */
export function SnapshotNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-surface-strong/40 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        Os itens guardam <strong className="text-foreground">o que valia
        quando entraram</strong> — descrição, SKU, unidade e preço. Alterar o
        Catálogo depois não muda nada aqui, e é o que permite honrar uma
        proposta enviada semanas atrás.
      </span>
    </p>
  );
}

/** O que falta para a proposta poder ser enviada — resposta do servidor. */
export function SendRequirements({ quote }: { quote: Quote }) {
  if (quote.status !== "DRAFT" || quote.transitions.canSend) return null;

  const missing: string[] = [];
  if (quote.itemCount === 0) missing.push("ao menos um item");
  if (Number(quote.total) <= 0) missing.push("um valor maior que zero");
  if (!quote.validUntil) missing.push("uma data de validade");
  if (quote.isExpired) missing.push("uma validade que ainda não passou");

  if (missing.length === 0) return null;

  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
      <AlertTriangle
        className="mt-0.5 size-3.5 shrink-0 text-amber-400"
        aria-hidden
      />
      <span className="text-muted-foreground">
        Para enviar, falta {missing.join(", ")}.
      </span>
    </p>
  );
}
