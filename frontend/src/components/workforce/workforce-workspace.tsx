"use client";

/**
 * Workforce Management — gestão da equipe.
 *
 * ## Não substitui autenticação
 *
 * Aqui não há login, sessão, MFA nem troca de senha: `identity/me` e
 * `identity/sessions` continuam sendo do domínio de autenticação, e cada
 * pessoa administra o próprio perfil. Este módulo é **gestão operacional** —
 * quem faz parte, com que papel, em que unidade, e o que cada um tem para
 * fazer.
 *
 * ## Quatro abas, quatro origens
 *
 * ```
 * GET /organizations/current/members    usuários e técnicos
 * GET /organizations/current/roles      papéis e permissões
 * GET /identity/invitations             convites
 * GET /operations?assignedUserId=       carga por pessoa
 * GET /artifact-executions?responsibleUserId=
 * GET /scheduling/events?userId=
 * ```
 *
 * Cada aba tem `TabBoundary` próprio: uma falha em Papéis não derruba
 * Usuários.
 */
import { UsersRound } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelFrame } from "@/components/panels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabBoundary } from "@/workspace";
import { WorkforceKpis } from "./workforce-kpis";
import { InvitationsTab } from "./tabs/invitations.tab";
import { MembersTab } from "./tabs/members.tab";
import { RolesTab } from "./tabs/roles.tab";
import { TechniciansTab } from "./tabs/technicians.tab";

export function WorkforceWorkspace() {
  return (
    <ContentContainer size="wide" className="space-y-6">
      <TabBoundary id="workforce-kpis" label="os indicadores">
        <WorkforceKpis />
      </TabBoundary>

      <Tabs defaultValue="usuarios" className="space-y-5">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="tecnicos">Técnicos</TabsTrigger>
          <TabsTrigger value="convites">Convites</TabsTrigger>
          <TabsTrigger value="papeis">Papéis</TabsTrigger>
          <TabsTrigger value="inteligencia">Inteligência</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <TabBoundary id="workforce-members" label="os usuários">
            <MembersTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="tecnicos">
          <TabBoundary id="workforce-technicians" label="a equipe técnica">
            <TechniciansTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="convites">
          <TabBoundary id="workforce-invitations" label="os convites">
            <InvitationsTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="papeis">
          <TabBoundary id="workforce-roles" label="os papéis">
            <RolesTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="inteligencia">
          <TabBoundary id="workforce-intelligence" label="a inteligência">
            <IntelligenceTab />
          </TabBoundary>
        </TabsContent>
      </Tabs>
    </ContentContainer>
  );
}

/**
 * Orbit Intelligence — a ausência, declarada.
 *
 * `AiExecutionQueryDto` aceita `operationId` e `customerId`; **não aceita
 * `userId`** — verificado: `400 property userId should not exist`. Não há
 * execução de IA vinculada a uma pessoa.
 *
 * Mostrar aqui a IA da organização sugeriria que a análise é sobre a equipe, e
 * análise sobre pessoas é a que menos pode ser inventada.
 */
function IntelligenceTab() {
  return (
    <PanelFrame
      panelId="workforce-intelligence"
      title="Orbit Intelligence"
      description="Análises sobre a equipe"
    >
      <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-center">
        <UsersRound className="size-6 text-muted-foreground" aria-hidden />
        <div className="max-w-lg space-y-2">
          <p className="text-sm font-medium">Não há IA vinculada à equipe</p>
          <p className="text-sm text-muted-foreground">
            As execuções de IA aceitam operação e cliente como escopo, mas não
            uma pessoa. Quando o contrato aceitar, esta aba passa a consumi-lo.
          </p>
          <p className="text-xs text-muted-foreground">
            Nenhuma análise é gerada aqui. Conclusão automática sobre o
            desempenho de alguém é a que menos pode ser inventada.
          </p>
        </div>
      </div>
    </PanelFrame>
  );
}
