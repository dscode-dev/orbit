"use client";

/**
 * Vocabulário de cache das leituras.
 *
 * Oito arquivos de hooks declararam `const MINUTE = 60_000` e escolheram
 * `staleTime` e `refetchInterval` em números soltos. Os números eram razoáveis
 * — o problema é que **eram só números**: ninguém conseguia dizer por que a
 * agenda revalidava a cada dois minutos e a listagem de execuções a cada um,
 * nem se a diferença era intencional.
 *
 * Aqui as políticas têm nome. Escolher passa a ser responder uma pergunta
 * sobre o dado — "isto muda sozinho no servidor?" — em vez de inventar um
 * intervalo.
 *
 * ```ts
 * const POLICY = {
 *   list: CACHE.live,       // muda sozinho: outra pessoa cria uma operação
 *   detail: CACHE.fresh,    // muda por ação de quem está olhando
 *   catalog: CACHE.stable,  // muda quando alguém configura
 * } as const;
 * ```
 */

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;

/** `staleTime` e `refetchInterval` de uma leitura. */
export interface CachePolicy {
  readonly staleTime: number;
  readonly refetchInterval: number | false;
}

/**
 * As cinco políticas, da mais volátil à mais estável.
 *
 * A escolha do intervalo segue uma regra só: **revalidar sozinho apenas o que
 * muda sem o usuário fazer nada.** Um formulário não se recarrega — recarregar
 * o que alguém está preenchendo é o pior tipo de "atualização".
 */
export const CACHE = {
  /**
   * Muda a todo momento, e a mudança importa agora.
   *
   * Filas, contadores, o que outra pessoa altera enquanto esta tela está
   * aberta.
   */
  live: { staleTime: 15 * SECOND, refetchInterval: MINUTE },

  /**
   * Muda com frequência, mas quem olha quase sempre é quem muda.
   *
   * Revalida ao voltar para a aba; não fica perguntando sozinho.
   */
  fresh: { staleTime: 30 * SECOND, refetchInterval: false },

  /** Muda de vez em quando: cadastros, listas de referência. */
  stable: { staleTime: MINUTE, refetchInterval: false },

  /** Muda quando alguém configura: catálogos, planos, calendários. */
  catalog: { staleTime: 10 * MINUTE, refetchInterval: false },

  /**
   * Não muda mais.
   *
   * Uma versão publicada de template é imutável por definição — pedi-la de
   * novo devolveria byte por byte o mesmo conteúdo.
   */
  immutable: { staleTime: Infinity, refetchInterval: false },
} as const satisfies Readonly<Record<string, CachePolicy>>;

export type CachePolicyName = keyof typeof CACHE;

/**
 * Uma política com revalidação automática em outro ritmo.
 *
 * Para o caso legítimo de "é `live`, mas de cinco em cinco minutos basta" —
 * clima, saúde da organização. Evita reescrever a política inteira só para
 * mudar o intervalo.
 */
export function every(policy: CachePolicy, interval: number): CachePolicy {
  return { staleTime: policy.staleTime, refetchInterval: interval };
}

/**
 * Revalida enquanto o servidor estiver trabalhando, e para quando terminar.
 *
 * O TanStack Query aceita função em `refetchInterval` e a chama com o último
 * dado recebido. É assim que a renderização de documento é acompanhada sem
 * WebSocket e sem um laço próprio: enquanto o backend diz que está em curso,
 * pergunta de novo; quando ele conclui, para.
 *
 * ```ts
 * refetchInterval: pollWhile<RenderState>(
 *   (state) => state.renderStatus === "PENDING",
 *   3 * SECOND,
 * )
 * ```
 */
export function pollWhile<TData>(
  isInFlight: (data: TData) => boolean,
  interval: number,
): (query: { state: { data: TData | undefined } }) => number | false {
  return (query) => {
    const data = query.state.data;
    return data !== undefined && isInFlight(data) ? interval : false;
  };
}
