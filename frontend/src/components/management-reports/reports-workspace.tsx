"use client";

/**
 * Reports Center — relatórios **gerenciais**.
 *
 * ## O que esta área não é
 *
 * Não é o Document Center. Lá ficam os documentos **emitidos pelo Artifact
 * Engine**: um PMOC preenchido em campo, com revisão, hash de conteúdo e
 * possibilidade de revogação. Aqui ficam retratos agregados de períodos, que
 * não têm execução, não têm revisão e não são assinados por ninguém.
 *
 * Os dois produzem PDF, e é só isso que têm em comum — misturá-los faria a
 * central de documentos responder por algo que o Artifact Engine não emitiu.
 *
 * ## Dashboard × Relatório
 *
 * A diferença está escrita na tela, não só na documentação: o dashboard
 * responde "como está agora"; o relatório responde "como estava em março", e
 * continua respondendo isso em setembro. Um relatório não é o dashboard
 * exportado.
 *
 * ## Isolamento de falha
 *
 * Cada aba tem `TabBoundary` própria, e dentro delas catálogo, histórico e
 * detalhe são consultas independentes. Um relatório financeiro que responde
 * 403 — porque o ator não tem `financial.read` — não derruba o histórico nem o
 * catálogo: é o caso mais provável de erro nesta tela, e o mais fácil de
 * confundir com "quebrou".
 */
import { Suspense, useState } from "react";
import { ArrowRight, CalendarClock, FileBarChart, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelError, PanelFrame, PanelLoading } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/actions";
import {
  useManagementReportCount,
  useManagementReports,
  useReportCatalog,
} from "@/hooks/management-reports/use-management-reports";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/providers/session-provider";
import type { ManagementReportSummary } from "@/types/management-reports";
import { MetricCard, TabBoundary } from "@/workspace";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { ReportGenerator } from "./report-generator";
import { ReportHistory } from "./report-history";
import { ReportStatusBadge } from "./report-presentation";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * `useSearchParams` exige um limite de Suspense: a leitura do parâmetro só
 * acontece no cliente. É como "gerar de novo" chega aqui com o tipo escolhido.
 */
export function ReportsWorkspace() {
  return (
    <Suspense
      fallback={
        <ContentContainer size="wide">
          <PanelLoading rows={4} />
        </ContentContainer>
      }
    >
      <Workspace />
    </Suspense>
  );
}

function Workspace() {
  const session = useSession();
  const router = useRouter();
  const params = useSearchParams();

  /**
   * `?tipo=` abre direto na geração, com o tipo pré-escolhido.
   *
   * É o retorno de "gerar de novo": o tipo vem do relatório antigo, o período
   * e o recorte são de quem está pedindo agora. Herdar tudo produziria uma
   * cópia que ninguém decidiu.
   */
  const requestedType = params.get("tipo") ?? undefined;

  const canRead = session.hasCapability("reports.management.read");
  const canManage = session.hasCapability("reports.management.manage");
  const create = useAction("management-report.create");

  const [tab, setTab] = useState(requestedType ? "gerar" : "visao-geral");
  const [seedType, setSeedType] = useState<string | undefined>(requestedType);

  const catalog = useReportCatalog(canRead);

  if (!canRead) {
    return (
      <ContentContainer size="wide">
        <PanelFrame
          panelId="reports-denied"
          title="Relatórios gerenciais"
          description="Fotografias reproduzíveis de um período"
        >
          <p className="text-sm text-muted-foreground">
            Seu acesso não inclui relatórios gerenciais. Eles são concedidos
            separadamente: um relatório consolida operação, agenda, comercial,
            financeiro e estoque numa página só — e cada domínio ainda exige o
            próprio acesso.
          </p>
        </PanelFrame>
      </ContentContainer>
    );
  }

  const openReport = (report: { id: string }) =>
    router.push(`${ROUTES.managementReports}/${report.id}`);

  const repeat = (report: ManagementReportSummary) => {
    setSeedType(report.type);
    setTab("gerar");
  };

  return (
    <ContentContainer size="wide" className="space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="gerar">Gerar relatório</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <TabBoundary id="reports-overview" label="a visão geral">
            <Overview
              canGenerate={canManage && create.allowed}
              onGenerate={() => setTab("gerar")}
              onOpen={openReport}
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="gerar">
          <TabBoundary id="reports-generate" label="a geração">
            <ReportGenerator
              canManage={canManage}
              initialType={seedType}
              onGenerated={(id) =>
                router.push(`${ROUTES.managementReports}/${id}`)
              }
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="historico">
          <TabBoundary id="reports-history" label="o histórico">
            <ReportHistory
              catalog={catalog.data}
              onOpen={openReport}
              onRepeat={canManage ? repeat : undefined}
            />
          </TabBoundary>
        </TabsContent>
      </Tabs>
    </ContentContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Visão geral                                                         */
/* ------------------------------------------------------------------ */

/**
 * Os números da própria área.
 *
 * **Todos vêm de `meta.total`** — uma consulta por recorte, com `limit: 1`.
 * Contar itens da página daria o total da página, e um indicador que muda
 * conforme a paginação é pior que indicador nenhum. É a mesma regra que vale
 * para o conteúdo dos relatórios: quem conta é o servidor.
 */
function Overview({
  canGenerate,
  onGenerate,
  onOpen,
}: {
  canGenerate: boolean;
  onGenerate: () => void;
  onOpen: (report: { id: string }) => void;
}) {
  const total = useManagementReportCount({});
  const inFlight = useManagementReportCount({ status: "GENERATING" });
  const queued = useManagementReportCount({ status: "PENDING" });
  const ready = useManagementReportCount({ status: "READY" });
  const failed = useManagementReportCount({ status: "FAILED" });

  const recent = useManagementReports({ page: 1, limit: 5 });
  const catalog = useReportCatalog();

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          metricId="management_reports.total"
          value={total.total}
          isPending={total.isPending}
          failed={total.failed}
          showDescription
        />
        {/*
          "Em composição" soma dois recortes do servidor — `PENDING` e
          `GENERATING` —, e não linhas de página. São duas contagens
          autoritativas; o que a tela faz é apresentá-las como um número só,
          porque para quem espera é a mesma espera.
        */}
        <MetricCard
          metricId="management_reports.in_flight"
          value={
            inFlight.total === undefined || queued.total === undefined
              ? undefined
              : inFlight.total + queued.total
          }
          isPending={inFlight.isPending || queued.isPending}
          failed={inFlight.failed || queued.failed}
          showDescription
        />
        <MetricCard
          metricId="management_reports.ready"
          value={ready.total}
          isPending={ready.isPending}
          failed={ready.failed}
          showDescription
        />
        <MetricCard
          metricId="management_reports.failed"
          value={failed.total}
          isPending={failed.isPending}
          failed={failed.failed}
          showDescription
        />
      </div>

      <PanelFrame
        panelId="reports-what-is-this"
        title="Relatório gerencial não é dashboard exportado"
        description="A diferença muda o que cada um serve para responder"
        actions={
          canGenerate ? (
            <Button size="sm" onClick={onGenerate}>
              <FileBarChart className="size-4" />
              Gerar relatório
            </Button>
          ) : null
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <LayoutGrid className="size-4 text-muted-foreground" aria-hidden />
              Dashboard
            </p>
            <p className="text-xs text-muted-foreground">
              Situação atual e acompanhamento contínuo. Os números mudam
              sozinhos, porque a operação continua acontecendo.
            </p>
            <Button asChild variant="ghost" size="sm">
              <Link href={ROUTES.dashboard}>
                Abrir o painel
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4 text-chart-1" aria-hidden />
              Relatório gerencial
            </p>
            <p className="text-xs text-muted-foreground">
              Fotografia de um período, com código de verificação e procedência de cada número. Não muda depois — é isso que permite levá-lo a uma reunião
              e voltar a ele meses depois.
            </p>
          </div>
        </div>
      </PanelFrame>

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelFrame
          panelId="reports-recent"
          title="Gerados recentemente"
          description="Os cinco últimos"
        >
          {recent.isPending ? (
            <PanelLoading rows={3} />
          ) : recent.error ? (
            <PanelError
              error={recent.error}
              onRetry={() => void recent.refetch()}
            />
          ) : (recent.data?.data.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum relatório ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.data?.data.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(report)}
                    className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {report.name}
                      </span>
                      <ReportStatusBadge status={report.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(report.period.from)} a{" "}
                      {formatDate(report.period.to)} ·{" "}
                      {report.generatedAt
                        ? formatDateTime(report.generatedAt)
                        : "aguardando"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PanelFrame>

        <PanelFrame
          panelId="reports-available-types"
          title="Tipos disponíveis"
          description="Cada tipo, com o que exige"
        >
          {catalog.isPending ? (
            <PanelLoading rows={4} />
          ) : catalog.error ? (
            <PanelError
              error={catalog.error}
              onRetry={() => void catalog.refetch()}
            />
          ) : (
            <ul className="space-y-2">
              {catalog.data?.types.map((type) => (
                <li
                  key={type.type}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{type.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {type.blockedReason ?? type.description}
                    </p>
                  </div>
                  {type.allowed ? null : (
                    <span className="shrink-0 text-xs text-warning">
                      sem acesso
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PanelFrame>
      </div>
    </div>
  );
}
