import { Suspense } from "react";

import { CreateTemplateDialog } from "@/components/artifact-studio/create-template-dialog";
import { TemplatesList } from "@/components/artifact-studio/templates-list";
import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelLoading } from "@/components/panels";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Artifact Studio — listagem.
 *
 * Server Component: compõe guards e shell, sem estado nem dados. A lista é
 * Client Component porque filtros, paginação e diálogos são interação.
 *
 * Não há prefetch no servidor: a consulta depende de filtros escolhidos no
 * cliente, e buscar no servidor duplicaria a requisição.
 *
 * `artifact_templates.read` é exigido pelo backend em `@Capabilities` e
 * `@Permissions`; o guard evita abrir a tela para quem receberia 403.
 */
export default function ArtifactTemplatesPage() {
  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="artifact_templates.read">
          <AppShell
            activeLabel="Artefatos"
            breadcrumb={<span>Artifact Studio</span>}
          >
            <ContentContainer size="wide" className="space-y-8">
              <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
                <div className="space-y-2">
                  <h1 className="font-display text-3xl font-bold tracking-tight">
                    Artifact Studio
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Templates de artefatos da organização e da plataforma.
                    Estrutura, versões e publicação.
                  </p>
                </div>
                <CreateTemplateDialog />
              </header>
              <Suspense fallback={<PanelLoading rows={6} />}>
                <TemplatesList />
              </Suspense>
            </ContentContainer>
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
