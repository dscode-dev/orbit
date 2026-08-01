import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { OperationsList } from "@/components/operations/operations-list";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Lista de operações.
 *
 * Server Component: compõe guards e shell, sem estado nem dados. A lista é
 * Client Component porque filtros, paginação e seleção são interação.
 *
 * Não há prefetch no servidor: a consulta depende da unidade ativa e dos
 * filtros, ambos escolhas do cliente. Buscar no servidor duplicaria a
 * requisição ou serviria o escopo errado.
 *
 * `operations.read` é exigido pelo backend em `@Capabilities` e
 * `@Permissions`; os guards evitam abrir a tela para quem receberia 403.
 */
export default function OperationsPage() {
  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="operations.read">
          <AppShell activeLabel="Operações" breadcrumb={<span>Operações</span>}>
            <ContentContainer size="wide" className="space-y-8">
              <header className="space-y-2 border-b border-border pb-6">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  Operações
                </h1>
                <p className="text-sm text-muted-foreground">
                  Ordens de serviço da unidade ativa, com filtros aplicados pelo
                  backend.
                </p>
              </header>
              <OperationsList />
            </ContentContainer>
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
