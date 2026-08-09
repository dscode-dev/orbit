"use client";

/**
 * Indicadores do funil comercial.
 *
 * Cada número é o `meta.total` de uma consulta server-side com `limit: 1` —
 * a mesma técnica do Catálogo e do Execution Center. **Não existe Analytics
 * comercial**: `AnalyticsDomain` cobre operações, PMOC, equipamentos,
 * técnicos, contratos e ambiente.
 *
 * Não há indicador de **valor** aqui, e a ausência é deliberada: `/quotes` não
 * publica soma de totais por situação, e somar a página daria o valor da
 * página. O valor previsto que existe de verdade é o do Financeiro — receita
 * `PENDING` —, publicado lá.
 */
import { useQuoteCount } from "@/hooks/quotes/use-quotes";
import { MetricCard } from "@/workspace";

export function QuoteKpis() {
  const draft = useQuoteCount({ status: "DRAFT" });
  const sent = useQuoteCount({ status: "SENT" });
  const approved = useQuoteCount({ status: "APPROVED" });
  const expired = useQuoteCount({ status: "EXPIRED" });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        metricId="quotes.draft.total"
        value={draft.total}
        isPending={draft.isPending}
        failed={draft.failed}
      />
      <MetricCard
        metricId="quotes.sent.total"
        value={sent.total}
        isPending={sent.isPending}
        failed={sent.failed}
        showDescription
      />
      <MetricCard
        metricId="quotes.approved.total"
        value={approved.total}
        isPending={approved.isPending}
        failed={approved.failed}
      />
      <MetricCard
        metricId="quotes.expired.total"
        value={expired.total}
        isPending={expired.isPending}
        failed={expired.failed}
      />
    </div>
  );
}
