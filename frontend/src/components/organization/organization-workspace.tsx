"use client";

/**
 * Organization Workspace — composição.
 *
 * Ponto central de administração da empresa. Cada painel tem consulta própria e
 * `PanelFrame` próprio, que já embute Error Boundary local — e aqui isso é
 * especialmente visível, porque os painéis exigem **capabilities e permissões
 * diferentes**:
 *
 * | Painel | Exigência do backend |
 * | --- | --- |
 * | Organização | `organization.update` para escrever |
 * | Plano e capabilities | nenhuma além de sessão |
 * | Consumo | permissão `usage.read` |
 * | Unidades | capability `business_units.read` / `.manage` |
 * | Integrações | capability `integrations.read` / `.manage` |
 *
 * Um 403 em qualquer um deles aparece como **ausência de acesso naquele
 * painel**, não como falha da tela — o restante segue utilizável. No plano
 * STARTER, por exemplo, `business_units.*` não é concedida: o painel de
 * unidades mostra acesso negado enquanto plano, capabilities e integrações
 * continuam funcionando.
 *
 * ## Ações
 *
 * As ações desta tela (salvar organização, remover unidade, validar
 * integração) estão declaradas onde a permissão que as governa é declarada —
 * no Entity Registry, quando a entidade está registrada, ou no próprio painel
 * quando não está. Nenhuma condicional de ação espalhada por componentes de
 * apresentação. É a preparação para o Action Registry descrita em
 * `docs/action-registry.md`.
 */
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelError, PanelFrame, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { allEntities, resolveEntity } from "@/entities";
import { useOrganization } from "@/hooks/organization/use-organization";
import { formatDateTime } from "@/lib/formatters";
import { useSession } from "@/providers/session-provider";
import type { Organization } from "@/types/organization";
import { BusinessUnitsSection } from "./business-units.section";
import { CapabilitiesSection } from "./capabilities.section";
import { GeneralSection } from "./general.section";
import { IntegrationsSection, UsersSection } from "./integrations.section";
import { PlanSection } from "./plan.section";

export function OrganizationWorkspace() {
  const query = useOrganization();

  if (query.isPending) {
    return (
      <ContentContainer size="wide" className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <PanelLoading rows={10} />
          <PanelLoading rows={6} />
        </div>
      </ContentContainer>
    );
  }

  if (query.error || !query.data) {
    return (
      <ContentContainer size="wide">
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      </ContentContainer>
    );
  }

  return (
    <WorkspaceBody
      organization={query.data}
      onRefresh={() => void query.refetch()}
    />
  );
}

function WorkspaceBody({
  organization,
  onRefresh,
}: {
  organization: Organization;
  onRefresh: () => void;
}) {
  const session = useSession();
  const canManageOrganization = session.hasPermission("organization.update");
  const canManageUnits =
    session.hasPermission("business_units.update") &&
    session.hasCapability("business_units.manage");
  const canManageIntegrations = session.hasCapability("integrations.manage");

  return (
    <ContentContainer size="wide" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {organization.displayName}
            </h1>
            <Badge variant="secondary">{organization.primarySegment}</Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {organization.slug}
          </p>
          <p className="text-xs text-muted-foreground">
            Atualizada em {formatDateTime(organization.updatedAt)}
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          Atualizar
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 space-y-6">
          <GeneralSection
            organization={organization}
            canManage={canManageOrganization}
          />
          <BusinessUnitsSection canManage={canManageUnits} />
          <IntegrationsSection canManage={canManageIntegrations} />
          <UsersSection />
        </div>

        <div className="min-w-0 space-y-6">
          <PlanSection organization={organization} />
          <CapabilitiesSection />
          <WorkspaceShortcuts />
        </div>
      </div>
    </ContentContainer>
  );
}

/**
 * Atalhos para os demais Workspaces.
 *
 * A lista sai do **Entity Registry**: rótulo, ícone, cor, rota e capability de
 * leitura vêm de lá, e o atalho só aparece se o plano concede a capability —
 * o mesmo critério que o backend usa para responder. Acrescentar um Workspace
 * novo é registrá-lo; esta lista não muda.
 */
function WorkspaceShortcuts() {
  const session = useSession();
  const entities = allEntities().filter(
    (entity) =>
      entity.href !== undefined &&
      (!entity.capability.read ||
        session.hasCapability(entity.capability.read)),
  );

  return (
    <PanelFrame
      panelId="organization-shortcuts"
      title="Áreas do produto"
      description="Habilitadas pelo plano desta organização"
    >
      {entities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          O plano atual não habilita nenhuma área.
        </p>
      ) : (
        <ul className="space-y-1">
          {entities.map((entity) => {
            const definition = resolveEntity(entity.id);
            return (
              <li key={entity.id}>
                <Link
                  href={entity.basePath}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-strong"
                >
                  <definition.icon
                    className={`size-4 shrink-0 ${definition.color}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {definition.labelPlural}
                  </span>
                  <ArrowUpRight
                    className="size-3.5 shrink-0 opacity-60"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PanelFrame>
  );
}
