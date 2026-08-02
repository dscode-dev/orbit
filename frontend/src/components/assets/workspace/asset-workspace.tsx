"use client";

/**
 * Asset Workspace — composição.
 *
 * A visão de 360° do equipamento vem de **cinco fontes independentes**:
 *
 * ```
 * GET /assets/:id                       geral, cliente, localização, identificação
 * GET /operations?assetId=              operações vinculadas
 * GET /scheduling/events?assetId=       agenda futura
 * GET /artifact-executions?assetId=     artefatos executados
 * meta.total das consultas acima        indicadores
 * ```
 *
 * Cada painel tem a própria consulta e o próprio `PanelFrame`, que já embute
 * Error Boundary local: se a agenda falhar, as operações continuam. Isso é
 * mais importante aqui do que nos Workspaces anteriores, porque as fontes são
 * de módulos diferentes e cada uma tem a sua capability — quem não tem
 * `scheduling.read` recebe 403 só naquele painel, e o resto da tela segue
 * funcionando.
 *
 * O cabeçalho e as ações resolvem tudo pelo **Entity Registry**: rótulo,
 * ícone, cor, badges e quais ações oferecer. Não há `switch` de entidade
 * nesta árvore.
 */
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelError, PanelLoading } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityBadge, useEntityAccess } from "@/entities";
import { useAsset } from "@/hooks/assets/use-assets";
import { formatDateTime } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";
import type { Asset } from "@/types/assets";
import { IdentifierSection } from "./identifier.section";
import {
  HealthSection,
  HistorySection,
  IndicatorsSection,
  IntelligenceSection,
} from "./indicators.section";
import { OverviewSection } from "./overview.section";
import {
  AssetExecutionsSection,
  AssetOperationsSection,
  AssetScheduleSection,
} from "./related.sections";

export function AssetWorkspace({ assetId }: { assetId: string }) {
  const query = useAsset(assetId);

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
          <Link href={ROUTES.assets}>
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      </ContentContainer>
    );
  }

  return (
    <WorkspaceBody asset={query.data} onRefresh={() => void query.refetch()} />
  );
}

function WorkspaceBody({
  asset,
  onRefresh,
}: {
  asset: Asset;
  onRefresh: () => void;
}) {
  const { definition } = useEntityAccess("asset");

  return (
    <ContentContainer size="wide" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={ROUTES.assets}>
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
              {asset.name}
            </h1>
            <EntityBadge entity="asset" group="status" value={asset.status} />
            <EntityBadge
              entity="asset"
              group="category"
              value={asset.category}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {[asset.manufacturer, asset.model].filter(Boolean).join(" · ") ||
              definition.description}
          </p>
          <p className="text-xs text-muted-foreground">
            Atualizado em {formatDateTime(asset.updatedAt)}
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          Atualizar
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 space-y-6">
          <OverviewSection asset={asset} />
          <AssetOperationsSection assetId={asset.id} />
          <AssetScheduleSection assetId={asset.id} />
          <AssetExecutionsSection assetId={asset.id} />
          <HistorySection />
        </div>

        <div className="min-w-0 space-y-6">
          <IdentifierSection asset={asset} />
          <IndicatorsSection assetId={asset.id} />
          <HealthSection />
          <IntelligenceSection />
        </div>
      </div>
    </ContentContainer>
  );
}
