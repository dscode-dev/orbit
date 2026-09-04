"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  Bell,
  FileStack,
  SlidersHorizontal,
  UserCircle,
  PanelLeftClose,
  ChevronsUpDown,
} from "lucide-react";
import { motion } from "motion/react";
import { OrbitLogo } from "@/components/brand/orbit-logo";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getEntity, type EntityId } from "@/entities/entity-registry";
import { ROUTES } from "@/lib/routes";
import { SECTION_PARAM } from "@/lib/section-navigation";
import { cn } from "@/lib/utils";
import { useActiveScope } from "@/providers/use-active-scope";
import { useSession } from "@/providers/session-provider";

export type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  badge?: string;
};

/**
 * Item derivado do Entity Registry.
 *
 * Rótulo, ícone e rota base de uma entidade já têm dono — o registry. Repetir
 * aqui criaria duas verdades: renomear "Ativos" no registry deixaria o menu
 * desatualizado e, pior, quebraria o realce do item ativo, que compara o
 * rótulo do menu com o `activeLabel` da página (também vindo do registry).
 */
const fromEntity = (id: EntityId): NavItem => {
  const entity = getEntity(id);
  return {
    label: entity.labelPlural,
    icon: entity.icon,
    to: entity.basePath,
  };
};

/**
 * Não há mais item "em breve".
 *
 * "Relatórios" era o último — um botão inerte com a marca **em breve**, que o
 * `SidebarItem` ainda sabe renderizar quando um `NavItem` não tem `to`. O
 * suporte continua no componente para quando o próximo aparecer; o que sumiu
 * foi o ajudante que ninguém mais chamava.
 */

/**
 * Navegação por categoria de trabalho.
 *
 * Os grupos separam o que a pessoa faz: executar o dia (Operação), cuidar da
 * carteira (Comercial), configurar o que é preenchido em campo (Documentos) e
 * administrar a conta (Administração). Nada aqui muda aparência, animação ou
 * componente — só a organização dos itens.
 */
export const defaultNavigation: { group: string; items: NavItem[] }[] = [
  {
    group: "Operação",
    items: [
      { label: "Visão geral", icon: LayoutGrid, to: ROUTES.dashboard },
      fromEntity("scheduling-event"),
      fromEntity("operation"),
      fromEntity("artifact-execution"),
      fromEntity("pmoc-plan"),
      fromEntity("rvt-configuration"),
      { label: "Documentos", icon: FileStack, to: ROUTES.documents },
      /**
       * Relatórios gerenciais, e não os documentos de campo.
       *
       * Ficam em "Operação" porque é quem acompanha o mês que os abre — e ao
       * lado de "Documentos" de propósito: a proximidade deixa visível que são
       * coisas diferentes. Documento emitido pertence a uma execução; relatório
       * gerencial é o retrato de um período.
       */
      fromEntity("management-report"),
    ],
  },
  {
    group: "Comercial",
    items: [
      /**
       * Equipamentos não é item de menu.
       *
       * Eles pertencem a quem contratou o serviço, e a entrada é o cliente —
       * a aba **Equipamentos** do Customer Workspace. Um item paralelo aqui
       * sugeriria um parque instalado sem dono, que é o oposto de como a
       * operação funciona.
       *
       * A rota (`/ativos` e `/ativos/:id`) **continua existindo**: deep link,
       * QR Code lido em campo e navegação contextual dependem dela, e a
       * paleta de comandos ainda leva à listagem geral quando é isso que se
       * procura.
       */
      fromEntity("customer"),
      fromEntity("catalog-item"),
      fromEntity("quote"),
      /**
       * Financeiro é comercial, não administrativo.
       *
       * O que se faz aqui é acompanhar o dinheiro que a operação gera —
       * mesmo grupo de quem cuida da carteira. Em "Administração" ficaria ao
       * lado de configuração de conta, que é outra tarefa.
       */
      fromEntity("financial-entry"),
    ],
  },
  {
    group: "Documentos",
    items: [fromEntity("artifact-template")],
  },
  {
    group: "Administração",
    items: [
      fromEntity("team-member"),
      { label: "Notificações", icon: Bell, to: ROUTES.notifications },
      /**
       * Duas entradas, não três.
       *
       * "Organização" abria uma página que mostrava o mesmo que a seção
       * Organização das Configurações — plano, unidades, capabilities e dados
       * da empresa nas duas rotas. Ficou a seção; a rota antiga leva a ela.
       *
       * O que sobra são dois donos distintos, e o rótulo diz de quem é cada
       * um: o que a organização configura, e o que é da própria pessoa.
       */
      { label: "Configurações", icon: SlidersHorizontal, to: ROUTES.settings },
      { label: "Minha conta", icon: UserCircle, to: ROUTES.profile },
    ],
  },
];

/**
 * Onde a pessoa está trabalhando.
 *
 * Substitui um bloco que dizia "Acme Industries — Workspace produção" com um
 * `ChevronsUpDown` ao lado e nenhum `onClick`: nome inventado, unidade
 * inventada e um controle que prometia trocar de organização sem trocar nada.
 * Organização não se troca — o backend deriva uma das claims do token, e a
 * H05 já declarava isso na seção Contexto.
 *
 * O que fica é o que é verdade: a organização da sessão e a unidade em que as
 * consultas estão recortadas. Trocar de **unidade** existe de verdade, e o
 * bloco leva para onde isso se faz.
 */
/**
 * Como chamar a unidade ativa sob o nome da organização.
 *
 * A matriz costuma se chamar como a empresa — no ambiente de referência a
 * organização é "Orbit Owner" e a unidade também. Repetir a mesma palavra em
 * duas linhas parece defeito, então a razão social entra no lugar do nome
 * fantasia quando os dois coincidem: continua sendo a unidade, dita de outro
 * jeito, em vez de esconder qual está ativa.
 */
function unitLabel(
  unit: { tradeName: string | null; legalName: string } | null,
  organization: string,
): string {
  if (!unit) return "Todas as unidades";
  const trade = unit.tradeName ?? unit.legalName;
  return trade === organization ? unit.legalName : trade;
}

export function ActiveContext() {
  const session = useSession();
  const { businessUnit } = useActiveScope();

  const organization = session.organization?.displayName;
  if (!organization) return null;

  const initials = organization
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <div className="px-4 pb-3">
      <Link
        href={`${ROUTES.profile}?${SECTION_PARAM}=contexto`}
        className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-card px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/50"
      >
        <span
          className="bg-gradient-orbit flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-primary-foreground"
          aria-hidden
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground">
            {organization}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {unitLabel(businessUnit, organization)}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}

function SidebarItem({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  /** Avisa a gaveta que um destino foi escolhido, para ela se fechar. */
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <span
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active ? (
        <motion.span
          layoutId="sidebar-active-rail"
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="bg-gradient-orbit absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-r-full"
        />
      ) : null}
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-gradient-orbit text-primary-foreground shadow-glow"
            : "bg-surface-strong text-muted-foreground group-hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      {!collapsed ? (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <span className="ml-auto rounded-md bg-primary/12 px-1.5 py-0.5 font-mono text-[11px] text-primary">
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </span>
  );

  const node = item.to ? (
    /**
     * O item ativo é dito, não só pintado.
     *
     * O realce era só cor e sombra: quem navega por leitor de tela ouvia
     * dezessete links iguais, sem saber em qual página estava. `aria-current`
     * é a forma padrão de responder isso.
     */
    <Link
      href={item.to}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className="block"
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      aria-label={item.label}
      className="block w-full text-left"
    >
      {content}
    </button>
  );

  if (!collapsed) return node;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A lista de navegação — uma só, para o menu fixo e para a gaveta.
 *
 * O menu de largura estreita mostra os mesmos grupos e os mesmos itens porque
 * lê a mesma estrutura; não há uma segunda lista escrita à mão que envelheça
 * quando um módulo entra ou sai do registry.
 */
export function NavigationGroups({
  navigation,
  collapsed,
  activeLabel,
  onNavigate,
  className,
}: {
  navigation: { group: string; items: NavItem[] }[];
  collapsed: boolean;
  activeLabel?: string;
  /** A gaveta fecha quando se escolhe um destino. */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.to
      ? item.to === pathname && item.label === activeLabel
      : item.label === activeLabel;

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("scroll-panel flex-1 space-y-6 px-3 py-2", className)}
    >
      {navigation.map((group) => (
        <div key={group.group} className="space-y-1">
          {!collapsed ? (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
              {group.group}
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border" />
          )}
          {group.items.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              collapsed={collapsed}
              active={isActive(item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({
  navigation = defaultNavigation,
  activeLabel = "Visão geral",
  footer,
}: {
  navigation?: { group: string; items: NavItem[] }[];
  activeLabel?: string;
  footer?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <motion.aside
      animate={{ width: collapsed ? 84 : 276 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl lg:flex"
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link href="/" aria-label="Orbit — início">
          <OrbitLogo variant={collapsed ? "mark" : "full"} />
        </Link>
      </div>

      {!collapsed ? <ActiveContext /> : null}

      <NavigationGroups
        navigation={navigation}
        collapsed={collapsed}
        activeLabel={activeLabel}
      />

      <div className="space-y-2 border-t border-sidebar-border p-3">
        {footer}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={
            collapsed ? "Expandir menu lateral" : "Recolher menu lateral"
          }
          aria-expanded={!collapsed}
          className="w-full justify-center text-muted-foreground"
        >
          <PanelLeftClose
            className={cn(
              "size-4 transition-transform",
              collapsed && "rotate-180",
            )}
          />
          {!collapsed ? <span>Recolher</span> : null}
        </Button>
      </div>
    </motion.aside>
  );
}
