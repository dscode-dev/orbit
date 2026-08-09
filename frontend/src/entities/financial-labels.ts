/**
 * Rótulos e cores dos literais financeiros.
 *
 * Ficam separados do módulo de tipos porque o Entity Registry precisa deles e
 * não deve depender da árvore de componentes — a mesma razão de
 * `catalog-labels.ts`. Os mapas de rótulo em si são os de `@/types/financial`;
 * aqui só se acrescenta a cor, que é decisão de apresentação.
 */
import {
  FINANCIAL_SOURCE_LABELS,
  FINANCIAL_STATUS_LABELS,
  FINANCIAL_TYPE_LABELS,
} from "@/types/financial";

export {
  FINANCIAL_SOURCE_LABELS,
  FINANCIAL_STATUS_LABELS,
  FINANCIAL_TYPE_LABELS,
};

/**
 * Receita e despesa nunca compartilham cor.
 *
 * É a distinção que a tela inteira depende: um número verde e um vermelho
 * lado a lado dizem o que uma legenda levaria uma linha para explicar.
 */
export const FINANCIAL_TYPE_CLASSES: Readonly<Record<string, string>> = {
  INCOME: "bg-emerald-500/15 text-emerald-400",
  EXPENSE: "bg-rose-500/15 text-rose-400",
};

/**
 * Realizado, previsto e cancelado.
 *
 * `CONFIRMED` recebe a cor cheia porque é o que de fato aconteceu; `PENDING`
 * fica em âmbar, a cor de "ainda não"; `CANCELLED` é neutro e apagado — existe
 * para explicar o passado, não para competir por atenção.
 */
export const FINANCIAL_STATUS_CLASSES: Readonly<Record<string, string>> = {
  CONFIRMED: "bg-primary/15 text-primary",
  PENDING: "bg-amber-500/15 text-amber-400",
  CANCELLED: "bg-surface-strong text-muted-foreground line-through",
};

/**
 * Procedência.
 *
 * `MANUAL` é neutro: é o caso comum. As origens automáticas ganham cor porque
 * mudam o que se pode fazer com o lançamento — e a pessoa precisa perceber
 * isso antes de tentar editar.
 */
export const FINANCIAL_SOURCE_CLASSES: Readonly<Record<string, string>> = {
  MANUAL: "bg-surface-strong text-muted-foreground",
  RECEIPT: "bg-sky-500/15 text-sky-400",
  QUOTE: "bg-violet-500/15 text-violet-400",
  SYSTEM: "bg-surface-strong text-muted-foreground",
};
