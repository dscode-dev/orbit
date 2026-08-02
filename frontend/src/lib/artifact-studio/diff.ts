/**
 * Comparação estrutural entre duas versões.
 *
 * O backend não expõe rota de diferença — versões são payloads imutáveis, e
 * comparar dois estados já recebidos é apresentação, não regra. Nada aqui
 * decide o que é válido; só descreve o que mudou.
 *
 * O pareamento é por `id` de contrato, não por posição: é o identificador que
 * atravessa versões. Um campo que trocou de lugar aparece como **movido**, e
 * não como um removido mais um adicionado — o que seria ruído em toda
 * reordenação.
 */
import type { ArtifactTemplateVersion } from "@/types/artifact-templates";

export type ChangeKind = "added" | "removed" | "changed" | "moved";
export type ChangeScope = "section" | "field" | "signature";

export interface AttributeChange {
  readonly attribute: string;
  readonly label: string;
  readonly from: unknown;
  readonly to: unknown;
}

export interface StructureChange {
  readonly kind: ChangeKind;
  readonly scope: ChangeScope;
  readonly id: string;
  /** Rótulo legível: "Seção" ou "Seção › Campo". */
  readonly path: string;
  readonly attributes: readonly AttributeChange[];
}

export interface VersionComparison {
  readonly changes: readonly StructureChange[];
  readonly summary: Readonly<Record<ChangeKind, number>>;
  readonly identical: boolean;
}

/** Rótulos dos atributos comparados — usados direto na interface. */
const ATTRIBUTE_LABELS: Readonly<Record<string, string>> = {
  title: "Título",
  label: "Rótulo",
  description: "Descrição",
  type: "Tipo",
  required: "Obrigatório",
  readOnly: "Somente leitura",
  hidden: "Oculto",
  visibility: "Visibilidade",
  collapsible: "Recolhível",
  permissions: "Permissões",
  configuration: "Configuração",
  validations: "Validações",
  dependencies: "Dependências",
  conditionalExpression: "Expressão condicional",
  defaultValue: "Valor padrão",
  placeholder: "Texto de apoio",
  mask: "Máscara",
  unit: "Unidade",
  signerRole: "Papel do signatário",
};

const SECTION_ATTRIBUTES = [
  "title",
  "description",
  "type",
  "required",
  "visibility",
  "collapsible",
  "permissions",
  "configuration",
] as const;

const FIELD_ATTRIBUTES = [
  "label",
  "description",
  "type",
  "required",
  "readOnly",
  "hidden",
  "defaultValue",
  "placeholder",
  "mask",
  "unit",
  "validations",
  "dependencies",
  "conditionalExpression",
  "configuration",
] as const;

const SIGNATURE_ATTRIBUTES = [
  "label",
  "signerRole",
  "required",
  "visibility",
  "permissions",
  "configuration",
] as const;

export function compareVersions(
  left: ArtifactTemplateVersion,
  right: ArtifactTemplateVersion,
): VersionComparison {
  const changes: StructureChange[] = [];

  const leftSections = ordered(left.sections);
  const rightSections = ordered(right.sections);

  changes.push(
    ...comparePeers({
      left: leftSections,
      right: rightSections,
      scope: "section",
      attributes: SECTION_ATTRIBUTES,
      path: (section) => section.title,
    }),
  );

  const leftById = new Map(leftSections.map((s) => [s.id, s]));
  for (const section of rightSections) {
    const previous = leftById.get(section.id);
    changes.push(
      ...comparePeers({
        left: previous ? ordered(previous.fields) : [],
        right: ordered(section.fields),
        scope: "field",
        attributes: FIELD_ATTRIBUTES,
        path: (field) => `${section.title} › ${field.label}`,
        /** Seção nova: os campos entram junto com ela, sem duplicar o ruído. */
        skipAdded: !previous,
      }),
    );
  }
  /** Campos de seções removidas. */
  const rightSectionIds = new Set(rightSections.map((section) => section.id));
  for (const section of leftSections) {
    if (rightSectionIds.has(section.id)) continue;
    changes.push(
      ...comparePeers({
        left: ordered(section.fields),
        right: [],
        scope: "field",
        attributes: FIELD_ATTRIBUTES,
        path: (field) => `${section.title} › ${field.label}`,
        skipRemoved: true,
      }),
    );
  }

  changes.push(
    ...comparePeers({
      left: ordered(left.signatureSlots),
      right: ordered(right.signatureSlots),
      scope: "signature",
      attributes: SIGNATURE_ATTRIBUTES,
      path: (slot) => slot.label,
    }),
  );

  const summary = { added: 0, removed: 0, changed: 0, moved: 0 };
  for (const change of changes) summary[change.kind] += 1;

  return { changes, summary, identical: changes.length === 0 };
}

interface Comparable {
  id: string;
  order: number;
}

function comparePeers<T extends Comparable>(input: {
  left: readonly T[];
  right: readonly T[];
  scope: ChangeScope;
  attributes: readonly string[];
  path: (item: T) => string;
  skipAdded?: boolean;
  skipRemoved?: boolean;
}): readonly StructureChange[] {
  const { left, right, scope, attributes, path } = input;
  const changes: StructureChange[] = [];
  const leftById = new Map(left.map((item) => [item.id, item]));
  const leftIndex = new Map(left.map((item, index) => [item.id, index]));

  right.forEach((item, index) => {
    const previous = leftById.get(item.id);
    if (!previous) {
      if (!input.skipAdded) {
        changes.push({
          kind: "added",
          scope,
          id: item.id,
          path: path(item),
          attributes: [],
        });
      }
      return;
    }

    const attributeChanges = attributes
      .map((attribute) => ({
        attribute,
        label: ATTRIBUTE_LABELS[attribute] ?? attribute,
        from: (previous as Record<string, unknown>)[attribute],
        to: (item as Record<string, unknown>)[attribute],
      }))
      .filter((change) => !equals(change.from, change.to));

    if (attributeChanges.length > 0) {
      changes.push({
        kind: "changed",
        scope,
        id: item.id,
        path: path(item),
        attributes: attributeChanges,
      });
    }

    if (leftIndex.get(item.id) !== index) {
      changes.push({
        kind: "moved",
        scope,
        id: item.id,
        path: path(item),
        attributes: [
          {
            attribute: "order",
            label: "Posição",
            from: (leftIndex.get(item.id) ?? 0) + 1,
            to: index + 1,
          },
        ],
      });
    }
  });

  if (!input.skipRemoved) {
    const rightIds = new Set(right.map((item) => item.id));
    for (const item of left) {
      if (rightIds.has(item.id)) continue;
      changes.push({
        kind: "removed",
        scope,
        id: item.id,
        path: path(item),
        attributes: [],
      });
    }
  }

  return changes;
}

function ordered<T extends { order: number }>(
  items: readonly T[],
): readonly T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * Igualdade estrutural.
 *
 * `configuration`, `validations` e `dependencies` são JSON livre definido pelo
 * tenant — não há esquema para comparar campo a campo, e serializar é o único
 * critério honesto de "mudou". A ordem das chaves é normalizada para que
 * reserializações do backend não apareçam como diferença.
 */
function equals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return a === b;
  return stable(a) === stable(b);
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      return Object.keys(record)
        .sort()
        .reduce<Record<string, unknown>>((accumulator, key) => {
          accumulator[key] = record[key];
          return accumulator;
        }, {});
    }
    return item;
  });
}

/** Apresentação de um valor de atributo na tabela de comparação. */
export function describeValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (typeof value === "string") return value.trim() === "" ? "—" : value;
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : `${value.length} item(ns)`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length === 0 ? "—" : `{ ${keys.join(", ")} }`;
  }
  return String(value);
}
