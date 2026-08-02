/**
 * Modelo de árvore do Artifact Studio.
 *
 * O editor **não** trabalha com "seções e campos". Trabalha com uma árvore de
 * nós genéricos, onde seção e campo são apenas dois dos tipos possíveis:
 *
 * ```
 * root
 * └── section
 *     ├── group          (ainda não persistido — ver `serialize.ts`)
 *     │   └── field
 *     └── field
 * ```
 *
 * A razão é de custo de mudança. Um editor escrito contra `Section[]` e
 * `Field[]` precisa de uma função de mover seção, outra de mover campo, outra
 * de remover seção, outra de remover campo — e ganha mais um par a cada
 * elemento de layout que surgir (grupos, colunas, abas, acordeões). Um editor
 * escrito contra uma árvore tem **uma** função de mover, **uma** de remover, e
 * elementos novos entram declarando onde podem morar.
 *
 * O backend continua persistindo o que a PR-17 definiu: `sections[]` com
 * `fields[]` dentro, mais `signatureSlots[]`. A tradução entre os dois mundos
 * é responsabilidade exclusiva de `parse.ts` (entrada) e `serialize.ts`
 * (saída), que são a fronteira do contrato.
 *
 * Duas propriedades deste modelo importam:
 *
 * - **A posição no array é a ordem.** O campo `order` do contrato é derivado
 *   no momento de serializar, nunca editado à mão. Isso elimina de origem o
 *   "Duplicate section order values" que o validador do backend rejeita.
 * - **`nodeId` não é o `id` do contrato.** O primeiro é interno e estável
 *   durante a edição; o segundo é o identificador de negócio que o usuário
 *   escolhe e que o backend valida. Renomear o `id` não pode fazer o nó
 *   selecionado sumir da tela.
 */
import type {
  ArtifactField,
  ArtifactSection,
  ArtifactSignatureSlot,
} from "@/types/artifact-templates";

/** Tipos de nó que a árvore reconhece. */
export type StudioNodeKind =
  "root" | "section" | "group" | "field" | "signature";

interface StudioNodeBase {
  /** Identidade interna do editor. Não vai para o backend. */
  readonly nodeId: string;
  readonly kind: StudioNodeKind;
  readonly children: readonly StudioNode[];
}

export interface StudioRootNode extends StudioNodeBase {
  readonly kind: "root";
}

export interface StudioSectionNode extends StudioNodeBase {
  readonly kind: "section";
  /** `id` do contrato — escolhido pelo usuário, validado pelo backend. */
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly type: string;
  readonly required: boolean;
  readonly visibility: string;
  readonly permissions: readonly string[];
  readonly collapsible: boolean;
  readonly configuration: Record<string, unknown>;
}

/**
 * Agrupamento de layout.
 *
 * Já existe no modelo, ainda **não** no contrato: `serialize.ts` recusa
 * publicar uma árvore que contenha grupos, em vez de achatá-los em silêncio.
 * Achatar perderia a intenção do usuário sem avisar; recusar deixa explícito
 * que falta suporte no backend. Ver `docs/artifact-studio.md`.
 */
export interface StudioGroupNode extends StudioNodeBase {
  readonly kind: "group";
  readonly id: string;
  readonly title: string;
  readonly configuration: Record<string, unknown>;
}

export interface StudioFieldNode extends StudioNodeBase {
  readonly kind: "field";
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly type: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly hidden: boolean;
  readonly defaultValue?: unknown;
  readonly validations: readonly Record<string, unknown>[];
  readonly dependencies: readonly Record<string, unknown>[];
  readonly conditionalExpression?: unknown;
  readonly placeholder?: string;
  readonly mask?: string;
  readonly unit?: string;
  readonly configuration: Record<string, unknown>;
}

export interface StudioSignatureNode extends StudioNodeBase {
  readonly kind: "signature";
  readonly id: string;
  readonly label: string;
  readonly signerRole: string;
  readonly required: boolean;
  readonly visibility: string;
  readonly permissions: readonly string[];
  readonly configuration: Record<string, unknown>;
}

export type StudioNode =
  | StudioRootNode
  | StudioSectionNode
  | StudioGroupNode
  | StudioFieldNode
  | StudioSignatureNode;

/** Nó que carrega identificador e rótulo de negócio (tudo menos a raiz). */
export type StudioContentNode = Exclude<StudioNode, StudioRootNode>;

/**
 * Documento em edição.
 *
 * Duas árvores porque o contrato tem dois eixos independentes: a estrutura
 * (seções) e as assinaturas, que não vivem dentro de seção alguma.
 */
export interface StudioDocument {
  readonly structure: StudioRootNode;
  readonly signatures: StudioRootNode;
  /** `metadata` da versão — JSON livre, preservado tal como veio. */
  readonly metadata: Record<string, unknown>;
  /** `layout` da versão — idem. */
  readonly layout: Record<string, unknown>;
}

/** Onde cada tipo de nó pode ser inserido. */
const ALLOWED_PARENTS: Record<StudioNodeKind, readonly StudioNodeKind[]> = {
  root: [],
  section: ["root"],
  group: ["section", "group"],
  field: ["section", "group"],
  signature: ["root"],
};

export function canContain(
  parent: StudioNodeKind,
  child: StudioNodeKind,
): boolean {
  return ALLOWED_PARENTS[child].includes(parent);
}

let counter = 0;

/**
 * Identidade interna do nó.
 *
 * Contador de processo, não UUID: só precisa ser único dentro da sessão de
 * edição, e nada disso atravessa a rede.
 */
export function nextNodeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export const rootNode = (
  children: readonly StudioNode[] = [],
): StudioRootNode => ({
  nodeId: nextNodeId("root"),
  kind: "root",
  children,
});

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Percorre a árvore em profundidade, raiz primeiro. */
export function* walk(node: StudioNode): Generator<StudioNode> {
  yield node;
  for (const child of node.children) yield* walk(child);
}

export function findNode(
  root: StudioNode,
  nodeId: string,
): StudioNode | undefined {
  for (const node of walk(root)) if (node.nodeId === nodeId) return node;
  return undefined;
}

/** Caminho da raiz até o nó, inclusive — usado para trilhas e para o pai. */
export function pathTo(
  root: StudioNode,
  nodeId: string,
): readonly StudioNode[] | undefined {
  if (root.nodeId === nodeId) return [root];
  for (const child of root.children) {
    const found = pathTo(child, nodeId);
    if (found) return [root, ...found];
  }
  return undefined;
}

export function parentOf(
  root: StudioNode,
  nodeId: string,
): StudioNode | undefined {
  const path = pathTo(root, nodeId);
  return path && path.length >= 2 ? path[path.length - 2] : undefined;
}

export function countOf(root: StudioNode, kind: StudioNodeKind): number {
  let total = 0;
  for (const node of walk(root)) if (node.kind === kind) total += 1;
  return total;
}

/** Todos os `id` de contrato em uso, para checar colisão antes de enviar. */
export function usedIdentifiers(root: StudioNode): readonly string[] {
  const ids: string[] = [];
  for (const node of walk(root)) if (node.kind !== "root") ids.push(node.id);
  return ids;
}

// ---------------------------------------------------------------------------
// Transformações — todas puras, todas devolvem árvore nova
// ---------------------------------------------------------------------------

type NodeTransform = (node: StudioNode) => StudioNode;

function mapChildren(node: StudioNode, transform: NodeTransform): StudioNode {
  const children = node.children.map((child) =>
    transform(mapChildren(child, transform)),
  );
  return { ...node, children } as StudioNode;
}

/** Aplica uma alteração ao nó indicado, preservando o resto da árvore. */
export function updateNode<TNode extends StudioNode>(
  root: StudioRootNode,
  nodeId: string,
  patch: (node: TNode) => TNode,
): StudioRootNode {
  const apply: NodeTransform = (node) =>
    node.nodeId === nodeId ? patch(node as TNode) : node;
  return mapChildren(root, apply) as StudioRootNode;
}

/** Remove o nó e tudo abaixo dele. */
export function removeNode(
  root: StudioRootNode,
  nodeId: string,
): StudioRootNode {
  const prune = (node: StudioNode): StudioNode =>
    ({
      ...node,
      children: node.children
        .filter((child) => child.nodeId !== nodeId)
        .map(prune),
    }) as StudioNode;
  return prune(root) as StudioRootNode;
}

/**
 * Insere um nó dentro de um pai.
 *
 * `index` ausente significa "no fim". A inserção é recusada quando o pai não
 * aceita aquele tipo — a regra de aninhamento é do modelo, não de cada tela.
 */
export function insertNode(
  root: StudioRootNode,
  parentNodeId: string,
  node: StudioNode,
  index?: number,
): StudioRootNode {
  const parent = findNode(root, parentNodeId);
  if (!parent || !canContain(parent.kind, node.kind)) return root;

  const apply: NodeTransform = (current) => {
    if (current.nodeId !== parentNodeId) return current;
    const children = [...current.children];
    children.splice(index ?? children.length, 0, node);
    return { ...current, children } as StudioNode;
  };
  return mapChildren(root, apply) as StudioRootNode;
}

/**
 * Move o nó dentro do mesmo pai.
 *
 * É o suficiente para esta PR — a especificação exclui drag-and-drop, e mover
 * entre pais diferentes só faz sentido com ele. `moveNodeTo` cobre o caso
 * geral quando chegar a hora.
 */
export function moveNode(
  root: StudioRootNode,
  nodeId: string,
  offset: number,
): StudioRootNode {
  const parent = parentOf(root, nodeId);
  if (!parent) return root;

  const from = parent.children.findIndex((child) => child.nodeId === nodeId);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= parent.children.length) return root;

  const apply: NodeTransform = (current) => {
    if (current.nodeId !== parent.nodeId) return current;
    const children = [...current.children];
    const [moved] = children.splice(from, 1);
    children.splice(to, 0, moved);
    return { ...current, children } as StudioNode;
  };
  return mapChildren(root, apply) as StudioRootNode;
}

/** Move para outro pai, na posição indicada. Base de um futuro arrastar. */
export function moveNodeTo(
  root: StudioRootNode,
  nodeId: string,
  parentNodeId: string,
  index?: number,
): StudioRootNode {
  const node = findNode(root, nodeId);
  const parent = findNode(root, parentNodeId);
  if (!node || !parent || !canContain(parent.kind, node.kind)) return root;
  /** Impede mover um nó para dentro de si mesmo. */
  if (pathTo(node, parentNodeId)) return root;
  return insertNode(removeNode(root, nodeId), parentNodeId, node, index);
}

/** Cópia do nó (e descendentes) com identidades internas novas. */
export function cloneNode(node: StudioNode): StudioNode {
  return {
    ...node,
    nodeId: nextNodeId(node.kind),
    children: node.children.map(cloneNode),
  } as StudioNode;
}

// ---------------------------------------------------------------------------
// Construtores
// ---------------------------------------------------------------------------

export function sectionNode(
  source: Partial<ArtifactSection> & { id: string; title: string },
  children: readonly StudioNode[] = [],
): StudioSectionNode {
  return {
    nodeId: nextNodeId("section"),
    kind: "section",
    id: source.id,
    title: source.title,
    description: source.description,
    type: source.type ?? "FORM",
    required: source.required ?? false,
    visibility: source.visibility ?? "VISIBLE",
    permissions: source.permissions ? [...source.permissions] : [],
    collapsible: source.collapsible ?? false,
    configuration: { ...(source.configuration ?? {}) },
    children,
  };
}

export function fieldNode(
  source: Partial<ArtifactField> & { id: string; label: string },
): StudioFieldNode {
  return {
    nodeId: nextNodeId("field"),
    kind: "field",
    id: source.id,
    label: source.label,
    description: source.description,
    type: source.type ?? "TEXT",
    required: source.required ?? false,
    readOnly: source.readOnly ?? false,
    hidden: source.hidden ?? false,
    defaultValue: source.defaultValue,
    validations: source.validations ? [...source.validations] : [],
    dependencies: source.dependencies ? [...source.dependencies] : [],
    conditionalExpression: source.conditionalExpression,
    placeholder: source.placeholder,
    mask: source.mask,
    unit: source.unit,
    configuration: { ...(source.configuration ?? {}) },
    children: [],
  };
}

export function signatureNode(
  source: Partial<ArtifactSignatureSlot> & { id: string; label: string },
): StudioSignatureNode {
  return {
    nodeId: nextNodeId("signature"),
    kind: "signature",
    id: source.id,
    label: source.label,
    signerRole: source.signerRole ?? "OPERATOR",
    required: source.required ?? true,
    visibility: source.visibility ?? "VISIBLE",
    permissions: source.permissions ? [...source.permissions] : [],
    configuration: { ...(source.configuration ?? {}) },
    children: [],
  };
}

/** Rótulo do nó na interface — cada tipo guarda o seu em um campo diferente. */
export function nodeLabel(node: StudioNode): string {
  switch (node.kind) {
    case "root":
      return "Estrutura";
    case "section":
    case "group":
      return node.title;
    default:
      return node.label;
  }
}
