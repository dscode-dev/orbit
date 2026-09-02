"use client";

/**
 * Plano, limites e consumo.
 *
 * ## Nada é calculado aqui
 *
 * `limits` vem de `entitlements.limits`, publicado pelo backend. `used` vem de
 * `GET /organizations/current/usage`, que o servidor recorta pelo **período
 * corrente da assinatura** — não há janela a escolher no cliente.
 *
 * A barra de proporção é apresentação de dois números recebidos. O que a tela
 * **não** faz é decidir se o limite foi excedido ou bloquear ação por isso:
 * quem recusa é `UsageService`, e ele recusa no momento da escrita.
 *
 * ## Consumo vazio não é consumo zero
 *
 * O endpoint devolve os registros de `PlanUsage` do período. Recurso sem
 * registro não aparece — e "sem registro" é diferente de "consumo zero
 * medido". A tela diz "sem registro no período" em vez de escrever 0, que
 * afirmaria uma medição que não houve.
 */
import { CircleDollarSign, Gauge } from "lucide-react";

import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOrganizationEntitlements,
  useOrganizationUsage,
} from "@/hooks/organization/use-organization";
import { formatDate } from "@/lib/formatters";
import { USAGE_RESOURCE_LABELS } from "@/types/organization";
import type { Organization } from "@/types/organization";

const SUBSCRIPTION_LABELS: Readonly<Record<string, string>> = {
  TRIALING: "Em avaliação",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento pendente",
  CANCELED: "Cancelada",
  EXPIRED: "Expirada",
};

export function PlanSection({ organization }: { organization: Organization }) {
  const entitlements = useOrganizationEntitlements();
  const usage = useOrganizationUsage();

  return (
    <PanelFrame
      panelId="organization-plan"
      title="Plano"
      description="O que o plano desta organização inclui"
      actions={
        entitlements.data ? (
          <Badge variant="secondary">
            {SUBSCRIPTION_LABELS[entitlements.data.subscriptionStatus] ??
              entitlements.data.subscriptionStatus}
          </Badge>
        ) : null
      }
    >
      <PanelState query={toPanelQuery(entitlements)} loadingRows={4}>
        {(data) => (
          <div className="space-y-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-display text-2xl font-bold">
                {organization.plan?.name ?? data.planKey}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <CircleDollarSign className="size-3.5" aria-hidden />
                {organization.plan?.monthlyPrice != null
                  ? `${organization.plan.currency} ${organization.plan.monthlyPrice}/mês`
                  : "preço não publicado"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Período corrente:{" "}
              {data.currentPeriodStart
                ? formatDate(data.currentPeriodStart)
                : "—"}{" "}
              —{" "}
              {data.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : "—"}
            </p>

            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <Gauge className="size-3.5" aria-hidden />
                Limites e consumo
              </h3>

              {Object.keys(data.limits).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  O plano não declara limites.
                </p>
              ) : (
                <ul className="space-y-3">
                  {Object.entries(data.limits).map(([resource, limit]) => (
                    <LimitRow
                      key={resource}
                      resource={resource}
                      limit={limit}
                      used={
                        usage.data?.find(
                          (record) => record.resource === resource,
                        )?.used
                      }
                      pending={usage.isPending}
                      denied={Boolean(usage.error)}
                    />
                  ))}
                </ul>
              )}

              {usage.error ? (
                <p className="text-xs text-muted-foreground">
                  O consumo exige a permissão <code>usage.read</code>. Os
                  limites acima continuam sendo os publicados pelo plano.
                </p>
              ) : null}
            </section>
          </div>
        )}
      </PanelState>
    </PanelFrame>
  );
}

function LimitRow({
  resource,
  limit,
  used,
  pending,
  denied,
}: {
  resource: string;
  limit: number | null;
  used: number | undefined;
  pending: boolean;
  denied: boolean;
}) {
  const label = USAGE_RESOURCE_LABELS[resource] ?? resource;
  const ratio =
    limit && limit > 0 && used !== undefined
      ? Math.min(100, Math.round((used / limit) * 100))
      : null;

  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {pending ? (
            <Skeleton className="inline-block h-3 w-16" />
          ) : denied ? (
            `limite ${limit ?? "sem limite"}`
          ) : used === undefined ? (
            `sem registro no período · limite ${limit ?? "sem limite"}`
          ) : (
            `${used} de ${limit ?? "sem limite"}`
          )}
        </span>
      </div>
      {ratio !== null ? <Progress value={ratio} className="h-1.5" /> : null}
    </li>
  );
}
