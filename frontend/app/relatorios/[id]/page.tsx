import { ReportPage } from "@/components/management-reports/report-page";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Um relatório.
 *
 * Server Component: resolve o parâmetro. `header={false}` porque o cabeçalho
 * mostra o registro — nome, situação, período —, e só o cliente conhece esses
 * dados depois de carregá-los.
 */
export default async function ManagementReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage
      entity="management-report"
      header={false}
      suspense={false}
      breadcrumb={
        <Breadcrumbs items={entityCrumbs("management-report", "Relatório")} />
      }
    >
      <ReportPage reportId={id} />
    </WorkspacePage>
  );
}
