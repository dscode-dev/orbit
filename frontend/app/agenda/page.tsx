import { SchedulingTabs } from "@/components/scheduling/scheduling-tabs";
import { WorkspacePage } from "@/workspace";

/**
 * Agenda — Scheduling Workspace.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho.
 *
 * `contained={false}` porque o calendário ocupa a largura da tela.
 */
export default function SchedulingPage() {
  return (
    <WorkspacePage
      entity="scheduling-event"
      title="Agenda"
      description="Operações, visitas, manutenções, compromissos, bloqueios e lembretes da unidade ativa."
      contained={false}
      loadingRows={8}
    >
      <SchedulingTabs />
    </WorkspacePage>
  );
}
