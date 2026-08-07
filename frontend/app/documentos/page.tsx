import { Suspense } from "react";

import { DocumentCenter } from "@/components/documents/document-center";
import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelLoading } from "@/components/panels";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Document Center.
 *
 * Server Component: compõe guards e shell, sem estado nem dados. A central é
 * Client Component porque abas, busca, paginação e o visualizador são
 * interação.
 *
 * Não há prefetch no servidor: a consulta depende da unidade ativa, que é
 * escolha do cliente — buscar no servidor serviria o escopo errado.
 *
 * `artifact_manifests.read` é exigido pelo backend nas rotas de manifest; o
 * guard evita abrir a tela para quem receberia 403 em tudo.
 */
export default function DocumentsPage() {
  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="artifact_manifests.read">
          <AppShell activeLabel="Documentos" breadcrumb={<span>Documentos</span>}>
            <ContentContainer size="wide">
              <header className="space-y-2 border-b border-border pb-6">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  Documentos
                </h1>
                <p className="text-sm text-muted-foreground">
                  Documentos emitidos pela plataforma: revisões, conteúdo,
                  histórico e estado da renderização.
                </p>
              </header>
            </ContentContainer>
            <Suspense fallback={<PanelLoading rows={6} />}>
              <DocumentCenter />
            </Suspense>
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
