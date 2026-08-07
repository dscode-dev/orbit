/**
 * Esqueleto de uma página de Workspace.
 *
 * Nove páginas escreveram a mesma pilha à mão:
 *
 * ```tsx
 * <RequireAuth>
 *   <RequireActiveSubscription>
 *     <RequireCapability capability="…">
 *       <AppShell activeLabel="…" breadcrumb={…}>
 *         <ContentContainer size="wide">
 *           <header className="space-y-2 border-b border-border pb-6">…</header>
 * ```
 *
 * Nove vezes a mesma ordem de guards, a mesma classe de cabeçalho, o mesmo
 * `pb-6`. A ordem não é decorativa: `RequireActiveSubscription` precisa vir
 * antes de `RequireCapability` para que plano vencido mostre "assinatura
 * bloqueada", e não "recurso não incluído" — que é verdade mas confunde, porque
 * o recurso *está* no plano; o que venceu foi a assinatura.
 *
 * **Server Component.** Não tem estado nem dados; compõe guards, shell e
 * cabeçalho. O conteúdo é que decide se precisa de cliente.
 *
 * ```tsx
 * export default function AssetsPage() {
 *   return (
 *     <WorkspacePage entity="asset">
 *       <AssetsList />
 *     </WorkspacePage>
 *   );
 * }
 * ```
 */
import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelLoading } from "@/components/panels";
import { getEntity, type EntityId } from "@/entities";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
  RequirePermission,
} from "@/guards";

export interface WorkspacePageProps {
  /**
   * Entidade dona da tela.
   *
   * Quando informada, título, descrição, capability e rótulo do menu saem do
   * Entity Registry — a mesma fonte que o guard consulta e que o backend
   * exige. É o caminho preferido: uma renomeação no registry chega à página
   * sem passar por aqui.
   */
  readonly entity?: EntityId;
  /** Título próprio — para telas que não são de uma entidade. */
  readonly title?: string;
  readonly description?: string;
  /** Capability própria, quando não vem do registry. */
  readonly capability?: string;
  /**
   * Guarda por **permissão** em vez de capability.
   *
   * É o caso da Administração: `organization.read` distingue o Owner de um
   * operador, e não é um recurso de plano. As capabilities entram painel a
   * painel dentro da tela, que é como o backend também decide.
   */
  readonly permission?: string;
  /**
   * Exige assinatura ativa.
   *
   * `false` no Perfil: a conta é da pessoa, não da organização — se o plano
   * vencer, ela ainda precisa poder trocar a própria senha e encerrar sessões.
   * Cobrança da empresa não tranca a segurança de quem trabalha nela.
   */
  readonly subscription?: boolean;
  /** Rótulo do item ativo no menu; por padrão, o título. */
  readonly activeLabel?: string;
  /** Trilha no topo; por padrão, o título. */
  readonly breadcrumb?: ReactNode;
  /** Ação principal no canto do cabeçalho (ex.: "Novo template"). */
  readonly action?: ReactNode;
  /**
   * Desenha o cabeçalho.
   *
   * `false` nas telas de detalhe: o cabeçalho delas mostra o registro — nome,
   * status, ações — e só o cliente conhece esses dados. A entidade continua
   * sendo informada, porque dela vêm a capability e o item ativo do menu.
   */
  readonly header?: boolean;
  /** Espaçamento entre o cabeçalho e o conteúdo. */
  readonly spacing?: "tight" | "normal";
  /**
   * Envolve o conteúdo em `Suspense`.
   *
   * Ligado por padrão: todo Workspace carrega dados no cliente, e a fronteira
   * evita que a página inteira espere.
   */
  readonly suspense?: boolean;
  readonly loadingRows?: number;
  /**
   * O conteúdo fica dentro do `ContentContainer` do cabeçalho.
   *
   * `false` para telas que gerenciam a própria largura — o Execution Center e
   * a Agenda o fazem, porque suas abas ocupam a tela toda.
   */
  readonly contained?: boolean;
  readonly children: ReactNode;
}

export function WorkspacePage({
  entity,
  title,
  description,
  capability,
  permission,
  subscription = true,
  activeLabel,
  breadcrumb,
  action,
  spacing = "normal",
  header = true,
  suspense = true,
  loadingRows = 6,
  contained = true,
  children,
}: WorkspacePageProps) {
  const definition = entity ? getEntity(entity) : undefined;

  const heading = title ?? definition?.labelPlural ?? "";
  const subtitle = description ?? definition?.description;
  const required = capability ?? definition?.capability.read ?? "";
  const menuLabel = activeLabel ?? heading;

  const body = suspense ? (
    <Suspense fallback={<PanelLoading rows={loadingRows} />}>
      {children}
    </Suspense>
  ) : (
    children
  );

  /**
   * Tela sem título traz o próprio cabeçalho.
   *
   * É o caso do Dashboard, cujo cabeçalho carrega o seletor de período e por
   * isso precisa ser Client Component. Forçar uma moldura vazia acima dele
   * criaria dois cabeçalhos empilhados.
   */
  const chrome = header && heading ? (
    <>
      <ContentContainer
        size="wide"
        className={contained && spacing === "normal" ? "space-y-8" : undefined}
      >
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {heading}
            </h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </header>
        {contained ? body : null}
      </ContentContainer>
      {contained ? null : body}
    </>
  ) : (
    body
  );

  const shell = (
    <AppShell
      activeLabel={menuLabel}
      breadcrumb={breadcrumb ?? <span>{heading}</span>}
    >
      {chrome}
    </AppShell>
  );

  /**
   * Sem exigência declarada, `RequireCapability` receberia string vazia e
   * bloquearia — nenhuma sessão tem a capability `""`. Uma tela que não exige
   * nada precisa dizer isso explicitamente.
   */
  const guarded = permission ? (
    <RequirePermission permission={permission}>{shell}</RequirePermission>
  ) : required ? (
    <RequireCapability capability={required}>{shell}</RequireCapability>
  ) : (
    shell
  );

  return (
    <RequireAuth>
      {subscription ? (
        <RequireActiveSubscription>{guarded}</RequireActiveSubscription>
      ) : (
        guarded
      )}
    </RequireAuth>
  );
}
