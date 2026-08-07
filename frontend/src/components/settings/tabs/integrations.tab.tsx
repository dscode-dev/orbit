"use client";

/**
 * Integrações.
 *
 * Reusa a `IntegrationsSection` do Organization Workspace (PR-09) — o contrato
 * é o mesmo (`/integrations`), e uma segunda tela divergiria no primeiro
 * provedor novo.
 *
 * A seção declara o que o contrato tem: provedores conhecidos, credenciais
 * guardadas pelo servidor e `POST /:id/validate`. Nenhuma integração é
 * simulada.
 */
import { Plug, Webhook } from "lucide-react";

import { IntegrationsSection } from "@/components/organization/integrations.section";
import { PanelFrame } from "@/components/panels";
import { useSession } from "@/providers/session-provider";

export function IntegrationsSettingsTab() {
  const session = useSession();
  const canManage = session.hasCapability("integrations.manage");

  return (
    <div className="max-w-3xl space-y-6">
      <IntegrationsSection canManage={canManage} />

      <PanelFrame
        panelId="settings-integrations-future"
        title="O que ainda não existe"
        description="Superfícies de extensão da plataforma"
      >
        <ul className="space-y-3">
          <li className="flex items-start gap-2">
            <Webhook
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">Webhooks</strong> — não há
              modelo nem rota (<span className="font-mono">/webhooks</span> →
              404). A plataforma já tem fila de jobs em background, que é a
              infraestrutura sobre a qual a entrega assíncrona seria construída.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Plug
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">API Keys</strong> — não
              existem (<span className="font-mono">/api-keys</span> → 404). Hoje
              todo acesso passa por sessão de usuário; uma chave de serviço
              exigiria um portador que não é pessoa, com escopo próprio.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Plug
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">SSO</strong> — não há provedor
              de identidade externo em contrato. `Credential` é senha local, e
              federar exigiria um segundo caminho de autenticação.
            </span>
          </li>
        </ul>

        <p className="mt-3 text-xs text-muted-foreground">
          Nada disso é simulado aqui. Quando os contratos existirem, entram como
          seções desta aba consumindo o mesmo Workspace Core — sem tela nova e
          sem tipo paralelo.
        </p>
      </PanelFrame>
    </div>
  );
}
