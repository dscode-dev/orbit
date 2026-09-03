"use client";

/**
 * Settings Workspace — governança da plataforma.
 *
 * ## A fronteira com Perfil
 *
 * **Configurações** administram o que vale para toda a organização;
 * **Perfil** administra o usuário autenticado. A linha divisória é o `userId`:
 * tudo em `identity/me` é perfil, tudo em `organizations/current` é
 * configuração.
 *
 * A exceção declarada são as **preferências de notificação**: o contrato as
 * guarda por `(organizationId, userId, type)`, ou seja, são pessoais dentro de
 * uma organização. Aparecem aqui porque é onde se administra o canal, e a aba
 * diz de quem elas são.
 *
 * ## Configuração vive junto do que ela configura
 *
 * O que já tem Workspace próprio — templates, catálogo, equipe, agenda — é
 * **alcançado** daqui, não duplicado. As abas reusam as seções que já existem
 * (`GeneralSection`, `PlanSection`, `IntegrationsSection`, `CalendarSetup`,
 * `OperationAuthorizationSection`); nenhuma foi reescrita.
 */
import { ContentContainer } from "@/components/layout/page-primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabBoundary } from "@/workspace";
import { AutomationsSettingsTab } from "./tabs/automations.tab";
import { DocumentsSettingsTab } from "./tabs/documents.tab";
import { FinancialSettingsTab } from "./tabs/financial.tab";
import { IntegrationsSettingsTab } from "./tabs/integrations.tab";
import { NotificationsSettingsTab } from "./tabs/notifications.tab";
import { OperationsSettingsTab } from "./tabs/operations.tab";
import { OrganizationTab } from "./tabs/organization.tab";
import { SchedulingSettingsTab } from "./tabs/scheduling.tab";
import { SecuritySettingsTab } from "./tabs/security.tab";

export function SettingsWorkspace() {
  return (
    <ContentContainer size="wide" className="space-y-6">
      <Tabs defaultValue="organizacao">
        <TabsList>
          <TabsTrigger value="organizacao">Organização</TabsTrigger>
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="organizacao">
          <TabBoundary id="settings-organization" label="a organização">
            <OrganizationTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="operacao">
          <TabBoundary id="settings-operations" label="a operação">
            <OperationsSettingsTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="agenda">
          <TabBoundary id="settings-scheduling" label="a agenda">
            <SchedulingSettingsTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="documentos">
          <TabBoundary id="settings-documents" label="os documentos">
            <DocumentsSettingsTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="financeiro">
          <TabBoundary id="settings-financial" label="o financeiro">
            <FinancialSettingsTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="notificacoes">
          <TabBoundary id="settings-notifications" label="as notificações">
            <NotificationsSettingsTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="automacoes">
          <TabBoundary id="settings-automations" label="as automações">
            <AutomationsSettingsTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="seguranca">
          <TabBoundary id="settings-security" label="a segurança">
            <SecuritySettingsTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="integracoes">
          <TabBoundary id="settings-integrations" label="as integrações">
            <IntegrationsSettingsTab />
          </TabBoundary>
        </TabsContent>
      </Tabs>
    </ContentContainer>
  );
}
