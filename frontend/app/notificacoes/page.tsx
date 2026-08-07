import { NotificationCenter } from "@/components/notifications/notification-center";
import { WorkspacePage } from "@/workspace";

/**
 * Notification Center.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho.
 */
export default function NotificationsPage() {
  return (
    <WorkspacePage
      title="Notificações"
      description="Avisos de operações, agenda, artefatos, plano e sistema."
      capability="notifications.read"
    >
      <NotificationCenter />
    </WorkspacePage>
  );
}
