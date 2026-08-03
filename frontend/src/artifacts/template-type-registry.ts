/**
 * Template Type Registry — o catálogo de tipos de artefato do Orbit.
 *
 * O backend trata `artifactType` como **texto livre** (`@Matches(/^[A-Z][A-Z0-9_.-]*$/)`,
 * sem `@IsIn`): qualquer organização pode inventar um tipo. O que ele não
 * publica é o que a interface precisa para tratar um tipo como algo conhecido —
 * rótulo legível, descrição, categoria, ícone, cor, a entidade que o tipo
 * descreve, qual template oficial serve de ponto de partida e quais ações fazem
 * sentido.
 *
 * Sem um lugar para isso, essa decisão vira `template.artifactType === "PMOC"`
 * espalhado por componentes. É exatamente o que este registry existe para
 * impedir.
 *
 * Regras — as mesmas dos demais registries da plataforma:
 *
 * - **Nenhum componente compara `artifactType` com string.** Ele resolve pelo
 *   registry e renderiza o que voltar.
 * - **O registry não decide o que o backend decide.** Ele não valida, não
 *   cria template, não autoriza: descreve apresentação e aponta para os
 *   contratos que já existem.
 * - **Tipo desconhecido não quebra a tela.** `resolveTemplateType` devolve uma
 *   definição derivada do próprio identificador.
 *
 * ## Ligação com o catálogo oficial
 *
 * `officialKey` é a `key` do template **global** semeado no backend
 * (`ORBIT_*`, `organizationId` nulo, `visibility: 'GLOBAL'`). É por essa chave
 * que a interface encontra o oficial na mesma listagem que já recebe — sem
 * endpoint novo, porque o repositório de templates já devolve os globais junto
 * com os da organização.
 *
 * Ver `docs/template-type-registry.md`.
 */
import type { ComponentType } from "react";
import {
  ClipboardCheck,
  FileCheck2,
  FileSignature,
  FileText,
  Receipt,
  Wind,
  Wrench,
  type LucideProps,
} from "lucide-react";

import type { EntityId } from "@/entities/entity-registry";

export type TemplateTypeIcon = ComponentType<LucideProps>;

/** Agrupamento editorial dos tipos, usado para organizar listas e filtros. */
export const TEMPLATE_TYPE_CATEGORIES = [
  "OPERACIONAL",
  "CONFORMIDADE",
  "COMERCIAL",
  "DOCUMENTO",
] as const;
export type TemplateTypeCategory = (typeof TEMPLATE_TYPE_CATEGORIES)[number];

export const TEMPLATE_TYPE_CATEGORY_LABELS: Readonly<
  Record<TemplateTypeCategory, string>
> = {
  OPERACIONAL: "Operacional",
  CONFORMIDADE: "Conformidade",
  COMERCIAL: "Comercial",
  DOCUMENTO: "Documento",
};

/**
 * Ação que a interface pode oferecer sobre um artefato deste tipo.
 *
 * `permission` e `capability` são as **exigidas pelo backend** — a interface as
 * usa para não oferecer o que resultaria em 403. Quem autoriza continua sendo o
 * servidor.
 *
 * `available: false` significa "o contrato ainda não existe": a ação aparece
 * declarada como indisponível, em vez de sumir sem explicação.
 */
export interface TemplateTypeAction {
  readonly id: string;
  readonly label: string;
  readonly permission?: string;
  readonly capability?: string;
  readonly available: boolean;
  /** Por que está indisponível, quando `available` é falso. */
  readonly unavailableReason?: string;
}

/**
 * Renderer do artefato — **referência apenas**.
 *
 * O backend publica `renderStatus` em toda execução e responde sempre
 * `NOT_RENDERED`: não existe motor de renderização. O registry nomeia o
 * renderer que cada tipo usará para que a ligação já esteja declarada quando
 * ele existir, sem prometer nada agora.
 */
export interface TemplateTypeRenderer {
  readonly id: string;
  readonly available: false;
  readonly note: string;
}

export interface TemplateTypeDefinition {
  /** Igual ao `artifactType` publicado pelo backend. */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: TemplateTypeCategory;
  readonly icon: TemplateTypeIcon;
  /** Classe de cor sobre tokens existentes do Design System. */
  readonly color: string;
  /** Entidade que o artefato descreve — resolvida no Entity Registry. */
  readonly primaryEntity: EntityId;
  /** `key` do template oficial global que serve de ponto de partida. */
  readonly officialKey?: string;
  readonly actions: readonly TemplateTypeAction[];
  readonly renderer: TemplateTypeRenderer;
  /** Menor aparece primeiro. */
  readonly priority: number;
}

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ações comuns a todo tipo de artefato.
 *
 * Cada uma corresponde a um endpoint real; a exceção declarada é a
 * renderização, que não tem contrato.
 */
const COMMON_ACTIONS: readonly TemplateTypeAction[] = [
  {
    id: "duplicate",
    label: "Duplicar",
    permission: "artifact_templates.create",
    capability: "artifact_templates.manage",
    available: true,
  },
  {
    id: "publish-version",
    label: "Publicar versão",
    permission: "artifact_templates.update",
    capability: "artifact_templates.manage",
    available: true,
  },
  {
    id: "execute",
    label: "Executar em campo",
    permission: "artifact_executions.create",
    capability: "artifact_executions.execute",
    available: true,
  },
  {
    id: "sign",
    label: "Assinar",
    permission: "artifact_executions.update",
    capability: "artifact_executions.manage",
    available: true,
  },
  {
    id: "render",
    label: "Gerar documento",
    available: false,
    unavailableReason:
      "Não há motor de renderização: `renderStatus` é sempre `NOT_RENDERED` e não existe endpoint de geração.",
  },
];

const renderer = (id: string): TemplateTypeRenderer => ({
  id,
  available: false,
  note: "Referência para quando o motor de renderização existir.",
});

/* ------------------------------------------------------------------ */
/* Definições                                                          */
/* ------------------------------------------------------------------ */

interface TemplateTypeInput extends Omit<
  TemplateTypeDefinition,
  "actions" | "renderer" | "color"
> {
  actions?: readonly TemplateTypeAction[];
  renderer?: TemplateTypeRenderer;
  color?: string;
}

const CATEGORY_COLORS: Readonly<Record<TemplateTypeCategory, string>> = {
  OPERACIONAL: "text-primary",
  CONFORMIDADE: "text-emerald-400",
  COMERCIAL: "text-amber-400",
  DOCUMENTO: "text-sky-400",
};

function define(input: TemplateTypeInput): TemplateTypeDefinition {
  return {
    ...input,
    color: input.color ?? CATEGORY_COLORS[input.category],
    actions: input.actions ?? COMMON_ACTIONS,
    renderer: input.renderer ?? renderer(`${input.id.toLowerCase()}.default`),
  };
}

/**
 * Tipos oficiais.
 *
 * Os `id` são exatamente os `artifactType` dos templates globais semeados no
 * backend — é a chave de ligação entre catálogo e apresentação.
 */
const DEFINITIONS: readonly TemplateTypeDefinition[] = [
  define({
    id: "ORDEM_SERVICO",
    name: "Ordem de Serviço",
    description:
      "Registro do serviço executado em campo, com aceite de quem contratou.",
    category: "OPERACIONAL",
    icon: Wrench,
    primaryEntity: "operation",
    officialKey: "ORBIT_ORDEM_SERVICO",
    priority: 10,
  }),
  define({
    id: "PMOC",
    name: "PMOC",
    description:
      "Plano de Manutenção, Operação e Controle de sistemas de climatização.",
    category: "CONFORMIDADE",
    icon: ClipboardCheck,
    primaryEntity: "asset",
    officialKey: "ORBIT_PMOC",
    priority: 20,
  }),
  define({
    id: "RELATORIO_VISITA",
    name: "Relatório de Visita Técnica",
    description: "Motivo, constatações e encaminhamentos de uma visita.",
    category: "OPERACIONAL",
    icon: FileCheck2,
    primaryEntity: "customer",
    officialKey: "ORBIT_RELATORIO_VISITA",
    priority: 30,
  }),
  define({
    id: "RELATORIO_TECNICO",
    name: "Relatório Técnico",
    description:
      "Laudo descritivo com objeto, metodologia, análise e conclusão.",
    category: "DOCUMENTO",
    icon: FileText,
    primaryEntity: "asset",
    officialKey: "ORBIT_RELATORIO_TECNICO",
    priority: 40,
  }),
  define({
    id: "QUALIDADE_AR",
    name: "Análise da Qualidade do Ar",
    description:
      "Parâmetros medidos em ambientes climatizados e o parecer correspondente.",
    category: "CONFORMIDADE",
    icon: Wind,
    primaryEntity: "asset",
    officialKey: "ORBIT_QUALIDADE_AR",
    priority: 50,
  }),
  define({
    id: "RECIBO",
    name: "Recibo",
    description: "Comprovante de pagamento recebido.",
    category: "COMERCIAL",
    icon: Receipt,
    primaryEntity: "customer",
    officialKey: "ORBIT_RECIBO",
    priority: 60,
  }),
  define({
    id: "ORCAMENTO",
    name: "Orçamento",
    description: "Proposta comercial com escopo, itens, condições e validade.",
    category: "COMERCIAL",
    icon: FileSignature,
    primaryEntity: "customer",
    officialKey: "ORBIT_ORCAMENTO",
    priority: 70,
  }),
];

const BY_ID = new Map(DEFINITIONS.map((type) => [type.id, type]));
const BY_OFFICIAL_KEY = new Map(
  DEFINITIONS.flatMap((type) =>
    type.officialKey ? [[type.officialKey, type] as const] : [],
  ),
);

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export function allTemplateTypes(): readonly TemplateTypeDefinition[] {
  return DEFINITIONS;
}

export function getTemplateType(
  id: string,
): TemplateTypeDefinition | undefined {
  return BY_ID.get(id.trim().toUpperCase());
}

/** `true` quando a chave é a de um template oficial do catálogo. */
export function isOfficialTemplateKey(key: string): boolean {
  return BY_OFFICIAL_KEY.has(key.trim().toUpperCase());
}

export function templateTypeByOfficialKey(
  key: string,
): TemplateTypeDefinition | undefined {
  return BY_OFFICIAL_KEY.get(key.trim().toUpperCase());
}

const reportedUnknown = new Set<string>();

/**
 * Resolve a definição de um tipo.
 *
 * Tipo não registrado não quebra a tela: o registry deriva uma definição do
 * próprio identificador e avisa no console em desenvolvimento, uma vez por id.
 * O rótulo derivado é o identificador humanizado — um tipo novo precisa
 * aparecer, não virar "Outro".
 */
export function resolveTemplateType(id: string): TemplateTypeDefinition {
  const normalized = id.trim().toUpperCase();
  const known = BY_ID.get(normalized);
  if (known) return known;

  if (
    process.env.NODE_ENV !== "production" &&
    !reportedUnknown.has(normalized)
  ) {
    reportedUnknown.add(normalized);
    console.warn(
      `[artifacts] tipo "${normalized}" não registrado — usando apresentação derivada. ` +
        `Registre-o em src/artifacts/template-type-registry.ts.`,
    );
  }

  return define({
    id: normalized,
    name: humanize(normalized),
    description: "Tipo criado pela organização, ainda não registrado.",
    category: "DOCUMENTO",
    icon: FileText,
    primaryEntity: "artifact-template",
    priority: 1000,
  });
}

function humanize(id: string): string {
  return id
    .split(/[_.-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/** Rótulo curto do tipo, para tabelas e crachás. */
export function templateTypeLabel(id: string): string {
  return resolveTemplateType(id).name;
}

/** Ação do tipo, quando ela existe no catálogo. */
export function templateTypeAction(
  id: string,
  actionId: string,
): TemplateTypeAction | undefined {
  return resolveTemplateType(id).actions.find(
    (action) => action.id === actionId,
  );
}

/** `true` quando o plano e o papel liberam a ação — e ela existe. */
export function isTemplateActionEnabled(
  action: TemplateTypeAction,
  access: {
    hasPermission: (permission: string) => boolean;
    hasCapability: (capability: string) => boolean;
  },
): boolean {
  if (!action.available) return false;
  if (action.permission && !access.hasPermission(action.permission))
    return false;
  if (action.capability && !access.hasCapability(action.capability))
    return false;
  return true;
}

/** Ordena qualquer coisa que carregue `artifactType` pela ordem do registry. */
export function sortByTemplateType<T extends { artifactType: string }>(
  items: readonly T[],
): readonly T[] {
  return [...items].sort(
    (left, right) =>
      resolveTemplateType(left.artifactType).priority -
      resolveTemplateType(right.artifactType).priority,
  );
}
