/**
 * Registry Kernel — a infraestrutura comum dos registries do Orbit.
 *
 * Seis registries nasceram separados e chegaram ao mesmo desenho, cada um com
 * sua cópia: um índice por id, um `Set` de ids já reclamados, um `console.warn`
 * guardado por `NODE_ENV`, e um objeto derivado quando o id não é conhecido.
 * Seis cópias que precisavam ser corrigidas seis vezes.
 *
 * O Kernel guarda **só isso**. Ele não sabe o que é uma entidade, uma métrica
 * ou um formato — sabe indexar, resolver e degradar. Cada registry continua
 * dono do seu vocabulário e da sua API pública.
 *
 * ```ts
 * const registry = createRegistry({
 *   name: "entities",
 *   source: "src/entities/entity-registry.ts",
 *   entries: DEFINITIONS,
 *   derive: (id) => ({ id, label: id, … }),
 * });
 *
 * registry.resolve("asset"); // conhecido
 * registry.resolve("nave");  // derivado, avisado uma vez, memoizado
 * ```
 *
 * ## Por que o derivado é memoizado
 *
 * Antes, cada `resolve` de um id desconhecido construía um objeto novo. Duas
 * chamadas devolviam valores `!==`, o que derrota `useMemo`, `React.memo` e
 * qualquer comparação por referência — o caminho de erro era justamente o que
 * causava re-render em cascata. O cache interno resolve isso: o mesmo id
 * desconhecido devolve sempre a mesma referência.
 *
 * Ver `docs/registry-kernel.md`.
 */

/** Todo registro tem um identificador. É a única exigência do Kernel. */
export interface RegistryEntry {
  readonly id: string;
}

export interface RegistryOptions<TEntry extends RegistryEntry> {
  /** Nome curto usado nas mensagens de desenvolvimento (ex.: `"entities"`). */
  readonly name: string;
  /** Arquivo a editar, dito na mensagem — o aviso deve levar ao conserto. */
  readonly source: string;
  readonly entries: readonly TEntry[];
  /**
   * Apresentação derivada de um id desconhecido.
   *
   * Recebe o id **já normalizado**. Deve sempre devolver algo exibível: a
   * regra da plataforma é que valor novo do backend aparece, não some.
   */
  readonly derive: (id: string) => TEntry;
  /**
   * Normalização do id antes de qualquer busca (ex.: caixa alta em formatos).
   *
   * Sem isso cada registry repetia `id.trim().toUpperCase()` nos seus dois ou
   * três pontos de entrada.
   */
  readonly normalizeId?: (id: string) => string;
  /**
   * Validação de cada registro, executada uma vez, só em desenvolvimento.
   *
   * Devolve a mensagem do problema, ou `null` quando está tudo certo.
   */
  readonly validate?: (entry: TEntry) => string | null;
}

export interface Registry<TEntry extends RegistryEntry> {
  /** Registros declarados, na ordem em que foram escritos. */
  all(): readonly TEntry[];
  /** Ids declarados, normalizados. */
  ids(): readonly string[];
  /** O registro, ou `undefined` quando não é declarado. */
  get(id: string): TEntry | undefined;
  has(id: string): boolean;
  /**
   * O registro, sempre.
   *
   * Id desconhecido não quebra a tela: devolve o derivado (memoizado) e avisa
   * uma vez em desenvolvimento.
   */
  resolve(id: string): TEntry;
  /** Índice auxiliar por outro campo — ex.: template oficial por `key`. */
  index<TKey extends string>(
    keyOf: (entry: TEntry) => TKey | undefined,
  ): ReadonlyMap<TKey, TEntry>;
}

const isDev = () => process.env.NODE_ENV !== "production";

/** Ids já reclamados, por registry. Um aviso por id, não um por render. */
const reported = new Map<string, Set<string>>();

/**
 * Avisa uma única vez sobre um identificador não registrado.
 *
 * Exportado porque nem todo aviso vem de um `resolve`: o Widget Registry
 * reclama de um widget publicado sem componente, que é a mesma classe de
 * problema com outra chave.
 */
export function warnUnknown(
  registryName: string,
  kind: string,
  id: string,
  source: string,
): void {
  if (!isDev()) return;

  let seen = reported.get(registryName);
  if (!seen) {
    seen = new Set();
    reported.set(registryName, seen);
  }
  const key = `${kind}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);

  console.warn(
    `[${registryName}] ${kind} "${id}" não registrado — usando apresentação derivada. ` +
      `Registre-o em ${source}.`,
  );
}

/**
 * Transforma um identificador em rótulo legível.
 *
 * `pdf.default` → `Pdf Default`; `NOT_RENDERED` → `Not Rendered`. Serve ao
 * caminho degradado: melhor que mostrar o id cru, e explicitamente pior que
 * registrar o valor de verdade.
 *
 * O resto da palavra vai para minúscula de propósito. Os ids que chegam aqui
 * são de duas famílias — `pdf.default` e `PMOC_SIMPLES` — e sem isso a segunda
 * viraria `PMOC SIMPLES`, que grita numa tabela. Era exatamente por isso que o
 * Template Type Registry mantinha a própria versão da função.
 */
export function humanizeId(id: string): string {
  return id
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Ordena pela ordem declarada no registry; não declarado vai para o fim. */
export function sortByRegistryOrder<TItem>(
  items: readonly TItem[],
  order: readonly string[],
  idOf: (item: TItem) => string,
): readonly TItem[] {
  const rank = new Map(order.map((id, position) => [id, position]));
  return [...items].sort(
    (left, right) =>
      (rank.get(idOf(left)) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(idOf(right)) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function createRegistry<TEntry extends RegistryEntry>(
  options: RegistryOptions<TEntry>,
): Registry<TEntry> {
  const { name, source, entries, derive, normalizeId, validate } = options;
  const normalize = normalizeId ?? ((id: string) => id);

  const byId = new Map<string, TEntry>();

  for (const entry of entries) {
    const id = normalize(entry.id);

    /**
     * Id duplicado é erro de programação, não de dado.
     *
     * Em desenvolvimento ele grita, porque a segunda declaração venceria em
     * silêncio e a tela mostraria o rótulo errado sem nenhuma pista. Em
     * produção não derruba a aplicação: o primeiro registro prevalece, que é
     * o comportamento estável.
     */
    if (byId.has(id)) {
      const message = `[${name}] id duplicado "${id}" em ${source} — a primeira declaração prevalece.`;
      if (isDev()) console.error(message);
      continue;
    }

    if (isDev() && validate) {
      const problem = validate(entry);
      if (problem) {
        console.error(`[${name}] registro "${id}" inválido: ${problem}`);
      }
    }

    byId.set(id, entry);
  }

  /** Derivados já construídos — mantém a referência estável entre chamadas. */
  const derived = new Map<string, TEntry>();

  const resolve = (rawId: string): TEntry => {
    const id = normalize(rawId);

    const known = byId.get(id);
    if (known) return known;

    const cached = derived.get(id);
    if (cached) return cached;

    warnUnknown(name, "id", id, source);
    const fallback = derive(id);
    derived.set(id, fallback);
    return fallback;
  };

  return {
    all: () => entries,
    ids: () => [...byId.keys()],
    get: (id) => byId.get(normalize(id)),
    has: (id) => byId.has(normalize(id)),
    resolve,
    index<TKey extends string>(keyOf: (entry: TEntry) => TKey | undefined) {
      const map = new Map<TKey, TEntry>();
      for (const entry of entries) {
        const key = keyOf(entry);
        if (key !== undefined && !map.has(key)) map.set(key, entry);
      }
      return map;
    },
  };
}
