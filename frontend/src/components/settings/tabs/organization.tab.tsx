"use client";

/**
 * Organização — dados, plano, capabilities, unidades e consumo.
 *
 * ## Reusa, não copia
 *
 * `GeneralSection`, `PlanSection`, `CapabilitiesSection` e
 * `BusinessUnitsSection` são as mesmas do Organization Workspace (PR-09).
 * Reescrevê-las aqui criaria duas telas para o mesmo contrato, que divergiriam
 * no primeiro campo novo.
 */
import { PanelError, PanelLoading } from "@/components/panels";
import { BusinessUnitsSection } from "@/components/organization/business-units.section";
import { UsersSection } from "@/components/organization/integrations.section";
import { CapabilitiesSection } from "@/components/organization/capabilities.section";
import { GeneralSection } from "@/components/organization/general.section";
import { PlanSection } from "@/components/organization/plan.section";
import { useOrganization } from "@/hooks/organization/use-organization";
import { useSession } from "@/providers/session-provider";
import { UsageSection } from "../usage.section";

export function OrganizationTab() {
  const session = useSession();
  const query = useOrganization();

  const canManageOrganization = session.hasPermission("organization.update");
  const canManageUnits =
    session.hasPermission("business_units.update") &&
    session.hasCapability("business_units.manage");

  if (query.isPending) return <PanelLoading rows={8} />;
  if (query.error || !query.data) {
    return (
      <PanelError error={query.error} onRetry={() => void query.refetch()} />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="min-w-0 space-y-6">
        <GeneralSection
          organization={query.data}
          canManage={canManageOrganization}
        />
        <BusinessUnitsSection canManage={canManageUnits} />
        {/*
          * Veio da página `/organizacao`, que deixou de existir como porta
          * separada. É um encaminhamento para o Workspace da Equipe, não uma
          * segunda administração de membros.
          */}
        <UsersSection />
      </div>

      <div className="min-w-0 space-y-6">
        <PlanSection organization={query.data} />
        <UsageSection />
        <CapabilitiesSection />
      </div>
    </div>
  );
}
