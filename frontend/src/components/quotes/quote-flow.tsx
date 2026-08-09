"use client";

/**
 * Os dois caminhos que saem de uma proposta aprovada.
 *
 * ```
 * Orçamento ──▶ Aprovado ──▶ Receita PREVISTA        (Financeiro)
 *                   └──────▶ Conversão ──▶ Operação  (campo)
 * ```
 *
 * São **independentes**, e mostrá-los como uma esteira só seria mentira:
 * aprovar já cria a previsão financeira; converter é uma decisão separada, que
 * pode nunca acontecer. Uma proposta aprovada e não convertida continua sendo
 * receita prevista.
 *
 * ## Previsto nunca é apresentado como recebido
 *
 * O rótulo diz "receita prevista" e a cor é âmbar — a mesma que o Financeiro
 * usa para `PENDING`. Confirmar é ato do Financeiro, quando o dinheiro entrar.
 * Esta tela nunca escreve "recebido".
 */
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Wallet,
  Wrench,
} from "lucide-react";

import { PanelFrame } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityLink } from "@/entities";
import { useQuoteForecast } from "@/hooks/quotes/use-quotes";
import { useSession } from "@/providers/session-provider";
import { cn } from "@/lib/utils";
import { FINANCIAL_STATUS_LABELS } from "@/types/financial";
import { ROUTES } from "@/lib/routes";
import type { Quote } from "@/types/quotes";
import { Money } from "./quote-presentation";

export function QuoteFlow({ quote }: { quote: Quote }) {
  const approved = quote.status === "APPROVED";

  return (
    <PanelFrame
      panelId="quote-flow"
      title="O que acontece depois da aprovação"
      description="Dois caminhos independentes"
    >
      <div className="space-y-4">
        <ForecastTrack quote={quote} approved={approved} />
        <OperationTrack quote={quote} approved={approved} />
      </div>
    </PanelFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Aprovação → receita prevista                                        */
/* ------------------------------------------------------------------ */

function ForecastTrack({
  quote,
  approved,
}: {
  quote: Quote;
  approved: boolean;
}) {
  const session = useSession();
  /**
   * Sem `financial.read`, nem se pergunta.
   *
   * A capability financeira é independente da comercial: quem cuida de
   * propostas não vê necessariamente o caixa. Consultar assim mesmo devolveria
   * 403 a cada abertura da página.
   */
  const allowed = session.hasCapability("financial.read");
  const forecast = useQuoteForecast(quote.id, allowed && approved);

  return (
    <Track
      icon={<Wallet className="size-4" aria-hidden />}
      title="Receita prevista"
      done={approved}
    >
      {!approved ? (
        <p className="text-xs text-muted-foreground">
          Ao registrar a aprovação, o total da proposta entra no Financeiro como
          receita <strong>prevista</strong> — não recebida.
        </p>
      ) : !allowed ? (
        <p className="text-xs text-muted-foreground">
          A aprovação gerou receita prevista no Financeiro. Seu acesso não
          inclui o módulo financeiro, concedido separadamente do comercial.
        </p>
      ) : forecast.isPending ? (
        <Skeleton className="h-8 w-40" />
      ) : forecast.entry ? (
        <div className="space-y-1.5">
          <p className="flex flex-wrap items-baseline gap-2">
            <Money
              value={forecast.entry.amount}
              className="text-lg font-semibold text-amber-400"
            />
            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-400">
              {FINANCIAL_STATUS_LABELS[forecast.entry.status] ??
                forecast.entry.status}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Previsão, não caixa. A confirmação acontece no Financeiro quando o
            pagamento entrar.
          </p>
          <Button asChild size="sm" variant="ghost" className="-ml-2">
            <Link href={ROUTES.financial}>
              Ver no Financeiro
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          O lançamento é criado em segundo plano, logo após a aprovação. Ainda
          não apareceu — atualize em instantes.
        </p>
      )}
    </Track>
  );
}

/* ------------------------------------------------------------------ */
/* Aprovação → conversão → operação                                    */
/* ------------------------------------------------------------------ */

function OperationTrack({
  quote,
  approved,
}: {
  quote: Quote;
  approved: boolean;
}) {
  return (
    <Track
      icon={<Wrench className="size-4" aria-hidden />}
      title="Operação"
      done={quote.operation !== null}
    >
      {quote.operation ? (
        <div className="space-y-1.5">
          <EntityLink
            entity="operation"
            id={quote.operation.id}
            className="text-sm font-medium"
          >
            {quote.operation.code} · {quote.operation.title}
          </EntityLink>
          <p className="text-xs text-muted-foreground">
            Convertida. Repetir a conversão não cria uma segunda operação.
          </p>
        </div>
      ) : approved ? (
        <p className="text-xs text-muted-foreground">
          A proposta está aprovada e ainda não virou trabalho. Converter é uma
          decisão separada — pode acontecer depois, ou nunca.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Só uma proposta aprovada pode virar ordem de serviço.
        </p>
      )}
    </Track>
  );
}

/* ------------------------------------------------------------------ */
/* Trilha                                                              */
/* ------------------------------------------------------------------ */

function Track({
  icon,
  title,
  done,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border p-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          done
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-surface-strong text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {title}
          {done ? (
            <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden />
          ) : (
            <Circle className="size-3.5 text-muted-foreground" aria-hidden />
          )}
        </p>
        {children}
      </div>
    </div>
  );
}
