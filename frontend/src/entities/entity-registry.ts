/**
 * Entity Registry — definição única de como cada entidade da plataforma se
 * apresenta e o que se pode fazer com ela.
 *
 * Mesma filosofia do Metric Registry, do Widget Registry e do Field Registry:
 * o backend publica **dados e autorização**; o que ele não publica é rótulo,
 * ícone, cor, rota, quais ações a interface oferece e como um status vira
 * texto. Sem um lugar para isso, a decisão se espalha — e é exatamente o
 * `switch (entidade)` que esta camada existe para eliminar.
 *
 * Regras, iguais às dos outros registries:
 *
 * - **Nenhum componente decide apresentação de entidade.** Ele resolve pelo
 *   registry e renderiza o que voltar.
 * - **O registry não autoriza nada.** Ele declara qual capability e qual
 *   permissão o backend exige; quem decide continua sendo o servidor, e a
 *   sessão só evita oferecer o que seria recusado.
 * - **Entidade desconhecida não quebra a tela.** `resolveEntity` devolve uma
 *   definição derivada, com aviso em desenvolvimento.
 *
 * Os mapas de rótulo de status **não são copiados** para cá: cada módulo já
 * tem o seu, e o registry aponta para ele. Duas fontes divergiriam no primeiro
 * status novo.
 *
 * Para registrar uma entidade nova, ver `docs/entity-registry.md`.
 */
import type { ComponentType } from "react";
import {
  Boxes,
  CalendarClock,
  ClipboardCheck,
  Handshake,
  LayoutTemplate,
  Workflow,
  type LucideProps,
} from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { OPERATION_STATUS_LABELS } from "@/types/operations";
import { ARTIFACT_EXECUTION_STATUS_LABELS } from "@/components/artifact-executions/execution-badges";
import { SCHEDULING_STATUS_LABELS } from "@/components/scheduling/event-badges";
import { ASSET_STATUS_LABELS, ASSET_CATEGORY_LABELS } from "./asset-labels";

export type EntityIcon = ComponentType<LucideProps>;

/**
 * Identificadores das entidades registradas.
 *
 * São chaves internas de apresentação — não vêm do backend e não viajam pela
 * rede.
 */
export const ENTITY_IDS = [
  "asset",
  "operation",
  "customer",
  "artifact-template",
  "artifact-execution",
  "scheduling-event",
] as const;
export type EntityId = (typeof ENTITY_IDS)[number];

/** Ação que a interface pode oferecer sobre a entidade. */
export interface EntityAction {
  readonly id: string;
  readonly label: string;
  /** Permissão exigida pelo backend (`@Permissions`). */
  readonly permission?: string;
  /** Capability exigida pelo plano (`@Capabilities`). */
  readonly capability?: string;
  /** Ação destrutiva — a interface pede confirmação. */
  readonly destructive?: boolean;
}

/**
 * Conjunto de rótulos de um atributo categórico da entidade (status,
 * categoria, criticidade…).
 *
 * `labels` aponta para o mapa que o módulo dono já mantém. Valor fora do mapa
 * é exibido cru: um status novo do backend precisa aparecer, não sumir.
 */
export interface EntityBadgeSet {
  readonly label: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly classes?: Readonly<Record<string, string>>;
}

export interface EntityDefinition {
  readonly id: EntityId;
  readonly label: string;
  readonly labelPlural: string;
  readonly description: string;
  readonly icon: EntityIcon;
  /** Classe de cor sobre tokens do Design System. */
  readonly color: string;
  /** Rota base da entidade; `href` monta o caminho do registro. */
  readonly basePath: string;
  readonly capability: { readonly read: string; readonly manage: string };
  readonly permissions: {
    readonly read: string;
    readonly create?: string;
    readonly update?: string;
    readonly delete?: string;
  };
  readonly badges: Readonly<Record<string, EntityBadgeSet>>;
  readonly actions: readonly EntityAction[];
  /** Caminho do registro. Ausente quando a entidade não tem tela própria. */
  readonly href?: (id: string) => string;
}

const OPERATION_STATUS_CLASSES: Readonly<Record<string, string>> = {
  SCHEDULED: "bg-surface-strong text-muted-foreground",
  IN_PROGRESS: "bg-primary/15 text-primary",
  PAUSED: "bg-amber-500/15 text-amber-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-400",
  CANCELLED: "bg-surface-strong text-muted-foreground",
};

const ASSET_STATUS_CLASSES: Readonly<Record<string, string>> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  MAINTENANCE: "bg-amber-500/15 text-amber-400",
  INACTIVE: "bg-surface-strong text-muted-foreground",
  RETIRED: "bg-destructive/15 text-destructive",
};

const DEFINITIONS: readonly EntityDefinition[] = [
  {
    id: "asset",
    label: "Ativo",
    labelPlural: "Ativos",
    description:
      "Equipamentos, veículos, ferramentas e instalações da organização.",
    icon: Boxes,
    color: "text-sky-400",
    basePath: ROUTES.assets,
    capability: { read: "assets.read", manage: "assets.manage" },
    permissions: {
      read: "assets.read",
      create: "assets.create",
      update: "assets.update",
      delete: "assets.delete",
    },
    badges: {
      status: {
        label: "Status",
        labels: ASSET_STATUS_LABELS,
        classes: ASSET_STATUS_CLASSES,
      },
      category: { label: "Categoria", labels: ASSET_CATEGORY_LABELS },
    },
    actions: [
      {
        id: "create",
        label: "Novo ativo",
        permission: "assets.create",
        capability: "assets.manage",
      },
      {
        id: "update",
        label: "Editar",
        permission: "assets.update",
        capability: "assets.manage",
      },
      {
        id: "delete",
        label: "Excluir",
        permission: "assets.delete",
        capability: "assets.manage",
        destructive: true,
      },
    ],
    href: (id) => `${ROUTES.assets}/${id}`,
  },
  {
    id: "operation",
    label: "Operação",
    labelPlural: "Operações",
    description: "Ordens de serviço executadas em campo.",
    icon: Workflow,
    color: "text-primary",
    basePath: ROUTES.operations,
    capability: { read: "operations.read", manage: "operations.manage" },
    permissions: {
      read: "operations.read",
      create: "operations.create",
      update: "operations.update",
    },
    badges: {
      status: {
        label: "Status",
        labels: OPERATION_STATUS_LABELS,
        classes: OPERATION_STATUS_CLASSES,
      },
    },
    actions: [],
    href: (id) => `${ROUTES.operations}/${id}`,
  },
  {
    id: "scheduling-event",
    label: "Agendamento",
    labelPlural: "Agenda",
    description: "Visitas, manutenções, compromissos e bloqueios.",
    icon: CalendarClock,
    color: "text-violet-400",
    basePath: ROUTES.scheduling,
    capability: { read: "scheduling.read", manage: "scheduling.manage" },
    permissions: {
      read: "scheduling.read",
      create: "scheduling.events.create",
      update: "scheduling.events.update",
      delete: "scheduling.events.delete",
    },
    badges: {
      status: { label: "Status", labels: SCHEDULING_STATUS_LABELS },
    },
    actions: [],
    /**
     * A agenda não tem rota por evento: o detalhe abre em painel lateral
     * dentro do Workspace. `href` leva ao Workspace.
     */
    href: () => ROUTES.scheduling,
  },
  {
    id: "artifact-execution",
    label: "Execução de artefato",
    labelPlural: "Execuções",
    description: "Preenchimento e acompanhamento de um artefato em campo.",
    icon: ClipboardCheck,
    color: "text-emerald-400",
    basePath: ROUTES.executions,
    capability: {
      read: "artifact_executions.read",
      manage: "artifact_executions.manage",
    },
    permissions: {
      read: "artifact_executions.read",
      create: "artifact_executions.create",
      update: "artifact_executions.update",
    },
    badges: {
      status: { label: "Status", labels: ARTIFACT_EXECUTION_STATUS_LABELS },
    },
    actions: [],
    href: (id) => `${ROUTES.executions}/${id}`,
  },
  {
    id: "artifact-template",
    label: "Template de artefato",
    labelPlural: "Artefatos",
    description: "Estrutura versionada que dá origem às execuções.",
    icon: LayoutTemplate,
    color: "text-amber-400",
    basePath: ROUTES.artifacts,
    capability: {
      read: "artifact_templates.read",
      manage: "artifact_templates.manage",
    },
    permissions: {
      read: "artifact_templates.read",
      create: "artifact_templates.create",
      update: "artifact_templates.update",
      delete: "artifact_templates.delete",
    },
    badges: {},
    actions: [],
    href: (id) => `${ROUTES.artifacts}/${id}`,
  },
  {
    id: "customer",
    label: "Cliente",
    labelPlural: "Clientes",
    description: "Contratantes dos serviços da organização.",
    icon: Handshake,
    color: "text-fuchsia-400",
    basePath: "/clientes",
    capability: { read: "crm.read", manage: "crm.manage" },
    permissions: {
      read: "customers.read",
      create: "customers.create",
      update: "customers.update",
    },
    badges: {},
    actions: [],
    /**
     * Sem tela de cliente até hoje — a entidade é registrada porque outras
     * telas precisam do rótulo, do ícone e da capability para decidir o que
     * mostrar. `href` ausente significa "não navegável".
     */
  },
];

const BY_ID = new Map(DEFINITIONS.map((entity) => [entity.id, entity]));

const reportedUnknown = new Set<string>();

/**
 * Resolve a definição de uma entidade.
 *
 * Entidade não registrada não quebra a tela: devolve uma definição derivada do
 * próprio identificador e avisa no console em desenvolvimento, uma vez por id.
 */
export function resolveEntity(id: string): EntityDefinition {
  const known = BY_ID.get(id as EntityId);
  if (known) return known;

  if (process.env.NODE_ENV !== "production" && !reportedUnknown.has(id)) {
    reportedUnknown.add(id);
    console.warn(
      `[entities] entidade "${id}" não registrada — usando apresentação derivada. ` +
        `Registre-a em src/entities/entity-registry.ts.`,
    );
  }

  return {
    id: id as EntityId,
    label: id,
    labelPlural: id,
    description: "Entidade publicada pelo backend e ainda não registrada.",
    icon: Boxes,
    color: "text-muted-foreground",
    basePath: "/",
    capability: { read: "", manage: "" },
    permissions: { read: "" },
    badges: {},
    actions: [],
  };
}

export function getEntity(id: EntityId): EntityDefinition {
  return resolveEntity(id);
}

export const allEntities = (): readonly EntityDefinition[] => DEFINITIONS;

/**
 * Rótulo de um valor categórico da entidade.
 *
 * Valor fora do conjunto volta cru — um status novo do backend precisa
 * aparecer, não virar "Outro".
 */
export function entityBadgeLabel(
  entity: EntityId,
  group: string,
  value: string,
): string {
  return resolveEntity(entity).badges[group]?.labels[value] ?? value;
}

export function entityBadgeClass(
  entity: EntityId,
  group: string,
  value: string,
): string {
  return (
    resolveEntity(entity).badges[group]?.classes?.[value] ??
    "bg-surface-strong text-muted-foreground"
  );
}

/** Caminho do registro, ou `null` quando a entidade não tem tela própria. */
export function entityHref(entity: EntityId, id: string): string | null {
  return resolveEntity(entity).href?.(id) ?? null;
}

export function entityAction(
  entity: EntityId,
  actionId: string,
): EntityAction | undefined {
  return resolveEntity(entity).actions.find((action) => action.id === actionId);
}
