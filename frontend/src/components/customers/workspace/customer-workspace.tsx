"use client";

/**
 * Customer Workspace — composição.
 *
 * Visão de 360° do cliente, com **seis fontes independentes**:
 *
 * ```
 * GET /customers/:id                   geral · endereço · contatos · contagens
 * GET /assets?customerId=              ativos
 * GET /operations?customerId=          operações
 * GET /scheduling/events?customerId=   agenda futura
 * GET /artifact-executions?customerId= artefatos
 * GET /ai-executions?customerId=       Orbit Intelligence
 * ```
 *
 * `customerId` é filtro real nos cinco contratos cruzados — nada é recortado
 * no cliente, e todos os serviços já existiam.
 *
 * Cada painel tem consulta e `PanelFrame` próprios, com Error Boundary local.
 * Como as fontes são de módulos diferentes, com capabilities diferentes, um
 * 403 aparece como ausência de acesso **naquele painel**: sem `assets.read` o
 * painel de ativos fecha e o restante segue funcionando.
 *
 * O cabeçalho e a navegação resolvem tudo pelo **Entity Registry** — não há
 * `switch` de entidade nesta árvore.
 */
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelError, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntityAccess } from "@/entities";
import { useCustomer } from "@/hooks/customers/use-customers";
import { formatDateTime } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/providers/session-provider";
import type { Customer } from "@/types/customers";
import {
  CustomerStatusBadge,
  customerTypeLabel,
} from "../customer-presentation";
import {
  ContactsSection,
  CustomerAssetsSection,
  CustomerExecutionsSection,
  CustomerOperationsSection,
  CustomerScheduleSection,
  HistorySection,
  IndicatorsSection,
  IntelligenceSection,
  OverviewSection,
} from "./panels";

export function CustomerWorkspace({ customerId }: { customerId: string }) {
  const query = useCustomer(customerId);

  if (query.isPending) {
    return (
      <ContentContainer size="wide" className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <PanelLoading rows={10} />
          <PanelLoading rows={6} />
        </div>
      </ContentContainer>
    );
  }

  if (query.error || !query.data) {
    return (
      <ContentContainer size="wide" className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.customers}>
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      </ContentContainer>
    );
  }

  return (
    <WorkspaceBody
      customer={query.data}
      onRefresh={() => void query.refetch()}
    />
  );
}

function WorkspaceBody({
  customer,
  onRefresh,
}: {
  customer: Customer;
  onRefresh: () => void;
}) {
  const session = useSession();
  const { definition, can } = useEntityAccess("customer");
  const canManage = can("update");
  const canReadIntelligence = session.hasCapability("ai.executions.read");

  return (
    <ContentContainer size="wide" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={ROUTES.customers}>
              <ArrowLeft className="size-4" />
              {definition.labelPlural}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <definition.icon
              className={`size-6 shrink-0 ${definition.color}`}
              aria-hidden
            />
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {customer.tradeName ?? customer.legalName}
            </h1>
            <CustomerStatusBadge status={customer.status} />
            <Badge variant="secondary">
              {customerTypeLabel(customer.type)}
            </Badge>
          </div>
          {customer.tradeName ? (
            <p className="text-xs text-muted-foreground">
              {customer.legalName}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Atualizado em {formatDateTime(customer.updatedAt)}
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          Atualizar
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 space-y-6">
          <OverviewSection customer={customer} />
          <ContactsSection customer={customer} canManage={canManage} />
          <CustomerAssetsSection customerId={customer.id} />
          <CustomerOperationsSection customerId={customer.id} />
          <CustomerScheduleSection customerId={customer.id} />
          <CustomerExecutionsSection customerId={customer.id} />
          <HistorySection />
        </div>

        <div className="min-w-0 space-y-6">
          <IndicatorsSection customer={customer} />
          <IntelligenceSection
            customerId={customer.id}
            enabled={canReadIntelligence}
          />
        </div>
      </div>
    </ContentContainer>
  );
}
