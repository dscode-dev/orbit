"use client";

/**
 * Saúde Financeira — `GET /financial/analytics/summary` e `/timeline`.
 *
 * Substitui o painel que declarava a ausência do domínio financeiro. A
 * declaração estava certa até a PR-21 do backend: não havia modelo nem
 * endpoint, e o painel dizia isso em vez de estimar. Agora há.
 *
 * ## Por que este widget busca os próprios dados
 *
 * O Dashboard faz as leituras compartilhadas em `dashboard-view` e as
 * distribui — a regra existe para que dez widgets não repitam a mesma
 * consulta. Aqui há **um** consumidor, e a leitura é privilegiada: quem não
 * tem `financial.read` receberia 403 em toda abertura do Dashboard se a
 * consulta subisse para o nível compartilhado. O widget consulta se, e só se,
 * a sessão o permitir.
 *
 * ## Realizado e previsto continuam separados
 *
 * O card compacto mostra saldo, receitas e despesas **realizados**, e o
 * previsto aparece à parte, rotulado. Um "saldo" que somasse os dois pareceria
 * caixa e não seria — a mesma regra da Visão Geral do Workspace.
 *
 * ## Período e unidade são os do Dashboard
 *
 * `analytics.query` é o mesmo recorte que alimenta os demais painéis. O
 * Financeiro não inventa um seletor paralelo.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { Button } from "@/components/ui/button";
import {
  useFinancialSummary,
  useFinancialTimeline,
} from "@/hooks/financial/use-financial";
import { useSession } from "@/providers/session-provider";
import { ROUTES } from "@/lib/routes";
import { FORMATTERS, resolveMetric } from "@/metrics";
import type { FinancialAnalyticsQuery } from "@/types/financial";
import { formatMonth } from "@/components/financial/financial-presentation";
import type { WidgetProps } from "./widget-registry";

/** `2026-08-09T00:00:00.000Z` → `2026-08-09`. */
const toDay = (iso: string | undefined): string | undefined =>
  iso?.slice(0, 10);

export function FinancialHealthWidget({ widget, analytics }: WidgetProps) {
  const session = useSession();
  const allowed = session.hasCapability("financial.read");

  const query: FinancialAnalyticsQuery = {
    from: toDay(analytics.query.from),
    to: toDay(analytics.query.to),
    businessUnitId: analytics.query.businessUnitId,
  };

  /**
   * `enabled` mora no hook do TanStack Query.
   *
   * Chamar os hooks sempre e desligar a consulta é o que mantém a ordem dos
   * hooks estável — condicionar a chamada quebraria as regras do React na
   * primeira vez que a capability mudasse.
   */
  const summary = useFinancialSummary(allowed ? query : undefined);
  const timeline = useFinancialTimeline(allowed ? query : undefined);

  if (!allowed) {
    return (
      <PanelFrame
        panelId={widget.id}
        title={widget.title}
        description={widget.description}
      >
        <p className="text-sm text-muted-foreground">
          Seu acesso não inclui o módulo financeiro. Ele é concedido
          separadamente de operações e clientes.
        </p>
      </PanelFrame>
    );
  }

  return (
    <PanelFrame
      panelId={widget.id}
      title={widget.title}
      description={widget.description}
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link href={ROUTES.financial}>
            Abrir
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
    >
      <PanelState query={toPanelQuery(summary)} loadingRows={3}>
        {(data) => (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Figure id="financial.netConfirmed" value={data.netConfirmed} />
              <Figure
                id="financial.income.confirmed"
                value={data.income.confirmed}
              />
              <Figure
                id="financial.expense.confirmed"
                value={data.expense.confirmed}
              />
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">
                Previsto no período
              </span>
              <span className="flex flex-wrap items-baseline gap-3">
                <Inline
                  label="receitas"
                  value={data.income.pending}
                  tone="text-amber-400"
                />
                <Inline
                  label="despesas"
                  value={data.expense.pending}
                  tone="text-amber-400"
                />
                {Number(data.overdue.pending) > 0 ? (
                  <Inline
                    label="vencido"
                    value={data.overdue.pending}
                    tone="text-rose-400"
                  />
                ) : null}
              </span>
            </div>

            <TimelineStrip query={timeline} />

            <p className="text-xs text-muted-foreground">
              {data.period.from} a {data.period.to} · valores em{" "}
              {data.currency}. Totais calculados pelo servidor.
            </p>
          </div>
        )}
      </PanelState>
    </PanelFrame>
  );
}

/** Um número, com rótulo e cor vindos do Metric Registry. */
function Figure({ id, value }: { id: string; value: string }) {
  const metric = resolveMetric({ id });
  const amount = Number(value);

  return (
    <div className="space-y-0.5">
      <p className="truncate text-xs text-muted-foreground">{metric.label}</p>
      <p className={`font-display text-lg font-bold tabular-nums ${metric.color}`}>
        {Number.isFinite(amount) ? FORMATTERS.currency(amount) : value}
      </p>
    </div>
  );
}

function Inline({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  const amount = Number(value);
  return (
    <span className="text-xs">
      <span className="text-muted-foreground">{label} </span>
      <span className={`font-mono tabular-nums ${tone}`}>
        {Number.isFinite(amount) ? FORMATTERS.currency(amount) : value}
      </span>
    </span>
  );
}

/**
 * Faixa de evolução — só o saldo realizado.
 *
 * Uma linha, sem eixo e sem legenda: o painel do Dashboard é compacto, e cinco
 * séries aqui virariam ruído. A leitura completa está no Workspace.
 */
function TimelineStrip({
  query,
}: {
  query: ReturnType<typeof useFinancialTimeline>;
}) {
  const points = (query.data ?? []).map((point) => ({
    month: formatMonth(point.month),
    netConfirmed: Number(point.netConfirmed),
  }));

  if (points.length < 2) return null;

  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            formatter={(value: number) => FORMATTERS.currency(value)}
            labelFormatter={(label: string) => label}
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
            }}
          />
          <Line
            type="monotone"
            dataKey="netConfirmed"
            name="Saldo realizado"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
