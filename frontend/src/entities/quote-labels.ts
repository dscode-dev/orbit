/**
 * Rótulos e cores dos literais comerciais.
 *
 * Separados do módulo de tipos porque o Entity Registry precisa deles e não
 * deve depender da árvore de componentes — a mesma razão de `catalog-labels`
 * e `financial-labels`.
 */
import { QUOTE_STATUS_LABELS } from "@/types/quotes";

export { QUOTE_STATUS_LABELS };

/**
 * As cores separam três coisas diferentes.
 *
 * Em elaboração é neutro — ainda não aconteceu nada. Enviado é âmbar, a cor de
 * "aguardando". Aprovado é a cor cheia do sistema. E os três desfechos
 * negativos **não compartilham cor**: recusa é decisão do cliente, expiração é
 * prazo que passou, cancelamento é desistência de quem propôs — tratá-los como
 * um só apagaria a informação comercial que mais falta depois.
 */
export const QUOTE_STATUS_CLASSES: Readonly<Record<string, string>> = {
  DRAFT: "bg-surface-strong text-muted-foreground",
  SENT: "bg-amber-500/15 text-amber-400",
  APPROVED: "bg-emerald-500/15 text-emerald-400",
  REJECTED: "bg-rose-500/15 text-rose-400",
  EXPIRED: "bg-orange-500/15 text-orange-400",
  CANCELLED: "bg-surface-strong text-muted-foreground line-through",
};
