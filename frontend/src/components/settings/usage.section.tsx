"use client";

/**
 * Consumo do período.
 *
 * `GET /organizations/current/usage` exige a permissão `usage.read` — um 403
 * aqui é ausência de acesso, não ausência de dado, e o `PanelError` já sabe
 * distinguir isso.
 *
 * ## Dois contratos, lado a lado
 *
 * `PlanUsageRecord` publica **quanto foi usado**; `entitlements.limits`
 * publica **quanto é permitido**. São dois valores do servidor, e a tela os
 * põe lado a lado — não é conta, é justaposição.
 *
 * Um limite ultrapassado é decisão do backend, e é ele quem recusa a próxima
 * criação. A barra aqui só desenha.
 */
import { Gauge } from "lucide-react";

import { PanelError, PanelFrame, PanelLoading } from "@/components/panels";
import { useOrganizationUsage } from "@/hooks/organization/use-organization";
import { useSession } from "@/providers/session-provider";
import { cn } from "@/lib/utils";

export function UsageSection() {
  const query = useOrganizationUsage();
  const session = useSession();

  /** `limits` vem dos entitlements do plano; `null` significa sem teto. */
  const limits = session.entitlements?.limits ?? {};

  return (
    <PanelFrame
      panelId="settings-usage"
      title="Consumo"
      description="Uso do plano no período corrente"
    >
      {query.isPending ? (
        <PanelLoading rows={3} />
      ) : query.error ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
          <Gauge className="size-5 text-muted-foreground" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">
            As métricas de consumo deste plano ainda não estão disponíveis.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(query.data ?? []).map((item) => {
            const limit = limits[item.resource] ?? null;
            return (
              <li key={item.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs">{item.resource}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {item.used}
                    {limit === null ? "" : ` / ${limit}`}
                  </span>
                </div>
                {limit === null ? (
                  <p className="text-xs text-muted-foreground">
                    Sem limite neste plano.
                  </p>
                ) : (
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
                    role="progressbar"
                    aria-valuenow={item.used}
                    aria-valuemin={0}
                    aria-valuemax={limit}
                    aria-label={item.resource}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        item.used >= limit
                          ? "bg-destructive"
                          : "bg-gradient-orbit",
                      )}
                      style={{
                        width: `${Math.min(100, (item.used / limit) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PanelFrame>
  );
}
