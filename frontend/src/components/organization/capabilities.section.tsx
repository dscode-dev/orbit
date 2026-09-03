"use client";

/**
 * Capabilities: quais existem, quais este plano concede e de onde vêm.
 *
 * ## De onde sai "disponíveis"
 *
 * O backend não publica um catálogo de capabilities. O que ele publica é
 * `GET /plans` — cada plano com a sua lista. A **união** das listas é o
 * conjunto de capabilities que existem no produto, e a origem de cada uma são
 * os planos que a concedem. Tudo derivado de contrato publicado; nada inventado.
 *
 * ## Descrição
 *
 * Também não é publicada. A tela agrupa pelo **prefixo do módulo**
 * (`operations.*`, `scheduling.*`), que é a convenção de nomenclatura visível
 * nos próprios `@Capabilities(...)` dos controllers, e mostra a chave crua. Um
 * dicionário de descrições escrito aqui seria documentação paralela, que
 * envelhece na primeira capability nova.
 *
 * ## O frontend não decide permissão
 *
 * O painel é de consulta. `hasCapability` da sessão serve para não oferecer o
 * que seria recusado; quem autoriza é o `ActivePlanGuard` no servidor.
 */
import { useMemo } from "react";
import { Check, Lock } from "lucide-react";

import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { humanizeId } from "@/registry";
import { Badge } from "@/components/ui/badge";
import {
  useOrganizationEntitlements,
  usePlanCatalog,
} from "@/hooks/organization/use-organization";
import { cn } from "@/lib/utils";
import type { OrganizationPlan } from "@/types/organization";

/** Rótulo do módulo a partir do prefixo da capability. */
const MODULE_LABELS: Readonly<Record<string, string>> = {
  operations: "Operações",
  scheduling: "Agenda",
  assets: "Equipamentos",
  crm: "Clientes",
  catalog: "Catálogo",
  analytics: "Analytics",
  dashboard: "Dashboard",
  integrations: "Integrações",
  notifications: "Notificações",
  checklists: "Checklists",
  reports: "Relatórios",
  document_engine: "Documentos",
  signatures: "Assinaturas",
  artifact_templates: "Modelos de documento",
  artifact_manifests: "Documentos emitidos",
  artifact_rendering: "Emissão de documentos",
  artifact_executions: "Execuções de artefato",
  business_units: "Unidades de negócio",
  ai: "Inteligência",
};

interface CapabilityRow {
  key: string;
  enabled: boolean;
  /** Planos que concedem esta capability. */
  grantedBy: readonly string[];
}

export function CapabilitiesSection() {
  const entitlements = useOrganizationEntitlements();
  const catalog = usePlanCatalog();

  const groups = useMemo(
    () =>
      buildGroups(catalog.data ?? [], entitlements.data?.capabilities ?? []),
    [catalog.data, entitlements.data],
  );

  const enabledCount = entitlements.data?.capabilities.length ?? 0;

  return (
    <PanelFrame
      panelId="organization-capabilities"
      title="Capabilities"
      description="O que o plano habilita, e o que existe no produto"
      actions={
        entitlements.data ? (
          <Badge variant="secondary">{enabledCount} habilitadas</Badge>
        ) : null
      }
    >
      <PanelState
        query={toPanelQuery(catalog)}
        loadingRows={5}
        isEmpty={() => groups.length === 0}
        emptyMessage="Nenhum plano publicado."
      >
        {() => (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.module} className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase">
                  {/**
                   * O título é `uppercase` por CSS: uma chave sem rótulo
                   * apareceria como `ARTIFACT_MANIFESTS` na tela, e nenhum
                   * guard estático veria isso — a transformação é do estilo.
                   */}
                  {MODULE_LABELS[group.module] ?? humanizeId(group.module)}
                </h3>
                <ul className="space-y-1">
                  {group.rows.map((row) => (
                    <li
                      key={row.key}
                      className={cn(
                        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5",
                        row.enabled
                          ? "border-border"
                          : "border-dashed border-border opacity-70",
                      )}
                    >
                      {row.enabled ? (
                        <Check
                          className="size-3.5 shrink-0 text-emerald-400"
                          aria-label="habilitada"
                        />
                      ) : (
                        <Lock
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label="não habilitada"
                        />
                      )}
                      <code className="min-w-0 flex-1 truncate text-xs">
                        {row.key}
                      </code>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {row.grantedBy.length > 0
                          ? row.grantedBy.join(", ")
                          : "sem plano"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              O conjunto de capabilities existentes é a união das listas de{" "}
              <code>GET /plans</code> — não há catálogo publicado, e a descrição
              de cada uma também não é publicada. A coluna da direita mostra
              quais planos concedem a capability.
            </p>
          </div>
        )}
      </PanelState>
    </PanelFrame>
  );
}

function buildGroups(
  plans: readonly OrganizationPlan[],
  enabled: readonly string[],
): readonly { module: string; rows: readonly CapabilityRow[] }[] {
  const enabledSet = new Set(enabled);
  const grantedBy = new Map<string, string[]>();

  for (const plan of plans) {
    for (const capability of plan.capabilities) {
      grantedBy.set(capability, [
        ...(grantedBy.get(capability) ?? []),
        plan.key,
      ]);
    }
  }
  /** Capability concedida à organização que nenhum plano do catálogo lista. */
  for (const capability of enabled) {
    if (!grantedBy.has(capability)) grantedBy.set(capability, []);
  }

  const byModule = new Map<string, CapabilityRow[]>();
  for (const [key, plansGranting] of grantedBy) {
    const moduleKey = key.split(".")[0] ?? key;
    byModule.set(moduleKey, [
      ...(byModule.get(moduleKey) ?? []),
      { key, enabled: enabledSet.has(key), grantedBy: plansGranting },
    ]);
  }

  return [...byModule.entries()]
    .map(([module, rows]) => ({
      module,
      rows: [...rows].sort((left, right) => left.key.localeCompare(right.key)),
    }))
    .sort((left, right) => left.module.localeCompare(right.module));
}
