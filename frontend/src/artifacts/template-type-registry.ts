/**
 * Template Type Registry — o catálogo de tipos de artefato do Orbit.
 *
 * O backend trata `artifactType` como **texto livre** (`@Matches(/^[A-Z][A-Z0-9_.-]*$/)`,
 * sem `@IsIn`): qualquer organização pode inventar um tipo. O que ele não
 * publica é o que a interface precisa para tratar um tipo como algo conhecido —
 * rótulo legível, descrição, categoria, ícone, cor, a entidade que o tipo
 * descreve e qual template oficial serve de ponto de partida.
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

import { createRegistry, humanizeId } from "@/registry";
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
  /** Menor aparece primeiro. */
  readonly priority: number;
}

/* ------------------------------------------------------------------ */
/* Definições                                                          */
/* ------------------------------------------------------------------ */

interface TemplateTypeInput extends Omit<TemplateTypeDefinition, "color"> {
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

/**
 * Índice, aviso e fallback ficam com o Registry Kernel.
 *
 * O índice por `officialKey` é o segundo eixo de busca do catálogo — "esta
 * chave é de um template oficial?" — e o Kernel o constrói a partir da mesma
 * lista, sem uma segunda declaração para desincronizar.
 */
const registry = createRegistry<TemplateTypeDefinition>({
  name: "artifacts",
  source: "src/artifacts/template-type-registry.ts",
  entries: DEFINITIONS,
  normalizeId: (id) => id.trim().toUpperCase(),
  derive: (id) =>
    define({
      id,
      name: humanizeId(id),
      description: "Tipo criado pela organização, ainda não registrado.",
      category: "DOCUMENTO",
      icon: FileText,
      primaryEntity: "artifact-template",
      priority: 1000,
    }),
});

const BY_OFFICIAL_KEY = registry.index((type) => type.officialKey);

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export function allTemplateTypes(): readonly TemplateTypeDefinition[] {
  return registry.all();
}

export function getTemplateType(
  id: string,
): TemplateTypeDefinition | undefined {
  return registry.get(id);
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

/**
 * Resolve a definição de um tipo.
 *
 * Tipo não registrado não quebra a tela: o registry deriva uma definição do
 * próprio identificador e avisa no console em desenvolvimento, uma vez por id.
 * O rótulo derivado é o identificador humanizado — um tipo novo precisa
 * aparecer, não virar "Outro".
 */
export function resolveTemplateType(id: string): TemplateTypeDefinition {
  return registry.resolve(id);
}

/** Rótulo curto do tipo, para tabelas e crachás. */
export function templateTypeLabel(id: string): string {
  return resolveTemplateType(id).name;
}

/**
 * Ações de artefato vivem no **Action Registry**.
 *
 * `import { useAction, actionsFor } from "@/actions";`
 *
 * Elas moravam aqui como `COMMON_ACTIONS`, com uma declaração que envelheceu:
 * "gerar documento" seguia marcada como indisponível por "não há motor de
 * renderização" — verdade quando foi escrita, falsa desde a PR-20. Nenhuma
 * tela consumia a lista, então o erro passou despercebido. Um catálogo só, e
 * consumido, não envelhece em silêncio.
 */

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
