/**
 * Resource Reference — o contrato de "isto aponta para aquilo".
 *
 * Uma notificação sabe **o que** aconteceu, não **onde fica** a tela. Guardar
 * uma URL na notificação faria o backend decidir a navegação do frontend: uma
 * rota renomeada quebraria notificações antigas, e cada cliente (web, mobile)
 * precisaria de caminhos diferentes para o mesmo registro.
 *
 * A referência carrega apenas identidade — `entityType` e `entityId` — e a
 * navegação é resolvida pelo **Entity Registry**, que já é a autoridade sobre
 * rota, rótulo, ícone e capability de cada entidade.
 *
 * ```
 * payload: { entityType: "operation", entityId: "…" }
 *                        │
 *              readResourceReference()
 *                        │
 *                 Entity Registry
 *                        │
 *                  /operacoes/…
 * ```
 *
 * É um contrato **reutilizável**: qualquer coisa que aponte para um registro —
 * notificação hoje, item de auditoria ou resultado de busca amanhã — pode usar
 * a mesma leitura.
 *
 * ## Tolerância deliberada
 *
 * `payload` é `Json?` no backend, sem esquema. O leitor aceita as grafias
 * usuais e **não quebra** quando não reconhece nada: devolve `null`, e quem
 * chamou decide o que fazer. Uma entidade desconhecida também não quebra —
 * `resolveEntity` já devolve definição derivada, e a ausência de `href`
 * significa "não navegável".
 */
import { entityHref, resolveEntity, type EntityId } from "./entity-registry";

export interface ResourceReference {
  /** Chave da entidade no Entity Registry. Pode não estar registrada. */
  readonly entityType: string;
  readonly entityId: string;
  /** Contexto extra do emissor — apresentação apenas, nunca navegação. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Chaves aceitas para o tipo e o id.
 *
 * O produtor da notificação não é padronizado hoje — cada módulo escreve o
 * `payload` como acha melhor. Aceitar as grafias correntes é o que permite
 * navegar a partir do que já existe, em vez de exigir uma migração antes de a
 * central funcionar.
 */
const TYPE_KEYS = ["entityType", "resourceType", "targetType", "type"] as const;
const ID_KEYS = ["entityId", "resourceId", "targetId", "id"] as const;

/**
 * Apelidos do emissor para chaves do Entity Registry.
 *
 * O backend usa o nome do módulo (`operations`, `artifact-executions`); o
 * registry usa o nome da entidade no singular. O mapa é a tradução, e o que
 * não estiver aqui passa direto — entidade desconhecida é tratada, não é erro.
 */
const TYPE_ALIASES: Readonly<Record<string, EntityId>> = {
  operation: "operation",
  operations: "operation",
  asset: "asset",
  assets: "asset",
  customer: "customer",
  customers: "customer",
  artifact_template: "artifact-template",
  "artifact-template": "artifact-template",
  artifact_templates: "artifact-template",
  "artifact-templates": "artifact-template",
  artifact_execution: "artifact-execution",
  "artifact-execution": "artifact-execution",
  artifact_executions: "artifact-execution",
  "artifact-executions": "artifact-execution",
  scheduling_event: "scheduling-event",
  "scheduling-event": "scheduling-event",
  scheduling: "scheduling-event",
  event: "scheduling-event",
};

/** Lê uma referência de um `payload` livre. `null` quando não há uma. */
export function readResourceReference(
  payload: unknown,
): ResourceReference | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  /** Referência aninhada é a forma preferida quando existir. */
  const nested = record.resource ?? record.reference ?? record.target;
  if (nested && typeof nested === "object" && nested !== record) {
    const inner = readResourceReference(nested);
    if (inner) return inner;
  }

  const entityType = firstString(record, TYPE_KEYS);
  const entityId = firstString(record, ID_KEYS);
  if (!entityType || !entityId) return null;

  return {
    entityType,
    entityId,
    metadata: extractMetadata(record),
  };
}

/** Chave do Entity Registry correspondente ao tipo bruto da referência. */
export function referenceEntityId(reference: ResourceReference): EntityId {
  const normalized = reference.entityType.trim().toLowerCase();
  return TYPE_ALIASES[normalized] ?? (normalized as EntityId);
}

/**
 * Destino da referência, resolvido pelo Entity Registry.
 *
 * `null` quando a entidade não tem tela — o chamador apresenta a notificação
 * sem link, em vez de oferecer uma navegação que não leva a lugar nenhum.
 */
export function resourceHref(reference: ResourceReference): string | null {
  return entityHref(referenceEntityId(reference), reference.entityId);
}

/** Rótulo da entidade referida, para o texto de apoio da notificação. */
export function resourceLabel(reference: ResourceReference): string {
  return resolveEntity(referenceEntityId(reference)).label;
}

/** A entidade referida está registrada? Usado só para diagnóstico. */
export function isKnownResource(reference: ResourceReference): boolean {
  const entity = referenceEntityId(reference);
  return resolveEntity(entity).href !== undefined;
}

function firstString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/** Tudo que não é identidade vira metadado de contexto. */
function extractMetadata(
  record: Record<string, unknown>,
): Readonly<Record<string, unknown>> | undefined {
  const identity = new Set<string>([...TYPE_KEYS, ...ID_KEYS]);
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (identity.has(key)) continue;
    if (value === null || value === undefined) continue;
    metadata[key] = value;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
