"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  Bell,
  FileBarChart,
  FileStack,
  Settings,
  SlidersHorizontal,
  UserCircle,
  PanelLeftClose,
  ChevronsUpDown,
  Sparkles,
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
import { cn } from "@/lib/utils";

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
 * Item ainda sem tela.
 *
 * O `SidebarItem` já renderiza um botão inerte quando não há `to` — era o caso
 * de "Relatórios" e "Suporte" antes desta PR. A diferença é a marca **em
 * breve**: um item que não leva a lugar nenhum precisa dizer isso, em vez de
 * parecer quebrado.
 */
const planned = (label: string, icon: NavItem["icon"]): NavItem => ({
  label,
  icon,
  badge: "em breve",
});

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
      { label: "Documentos", icon: FileStack, to: ROUTES.documents },
      planned("Relatórios", FileBarChart),
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
      { label: "Organização", icon: Settings, to: ROUTES.organization },
      fromEntity("team-member"),
      { label: "Notificações", icon: Bell, to: ROUTES.notifications },
      { label: "Configurações", icon: SlidersHorizontal, to: ROUTES.settings },
      { label: "Perfil", icon: UserCircle, to: ROUTES.profile },
    ],
  },
];

function SidebarItem({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
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
    <Link href={item.to} aria-label={item.label} className="block">
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
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.to
      ? item.to === pathname && item.label === activeLabel
      : item.label === activeLabel;

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

      {!collapsed ? (
        <div className="px-4 pb-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-card px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/50"
          >
            <span className="bg-gradient-orbit flex size-7 items-center justify-center rounded-lg text-[11px] font-bold text-primary-foreground">
              AC
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">
                Acme Industries
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Workspace produção
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </div>
      ) : null}

      <nav
        aria-label="Navegação principal"
        className="scroll-panel flex-1 space-y-6 px-3 py-2"
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
              />
            ))}
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="mx-3 mb-2 rounded-xl border border-sidebar-border bg-gradient-to-br from-primary/10 to-accent/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Orbit Copilot
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Automatize rotinas operacionais com sugestões inteligentes.
          </p>
          <Button size="sm" className="mt-2 h-7 w-full text-xs">
            Ativar
          </Button>
        </div>
      ) : null}

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
