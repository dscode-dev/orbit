/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

/**
 * Read Models do Inventory Engine.
 *
 * ## Quantidade viaja como string
 *
 * Pela mesma razão do dinheiro no Financeiro: `Decimal(14,3)` não cabe em
 * ponto flutuante sem risco de arredondamento, e estoque em HVAC-R se mede em
 * fração — quilos de gás, metros de tubo. Três casas, sempre.
 *
 * ## Nada aqui tem valor financeiro
 *
 * Não existe campo de custo, valor total ou preço. `costPrice` do Catálogo é o
 * preço de hoje, não o custo das unidades que estão na prateleira; sem FIFO ou
 * custo médio, qualquer valoração seria um número inventado com aparência de
 * contabilidade. Quantidade física e métrica financeira não se misturam.
 */

import type {
  InventoryMovementType,
  InventoryStockStatus,
} from '../..';

export interface InventoryActorReadModel {
  id: string;
  displayName: string;
}

export interface InventoryItemRefReadModel {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  /** `PRODUCT` ou `PART` — `SERVICE` não tem estoque. */
  kind: string;
}

/**
 * Saldo de um item numa unidade.
 *
 * `available` já é `onHand − reserved`. Hoje `reserved` é sempre `0` porque
 * **nenhum caminho reserva** — o campo existe para que a interface já fale a
 * linguagem certa quando a reserva chegar, e não para sugerir que ela existe.
 */
export interface InventoryBalanceReadModel {
  id: string;
  item: InventoryItemRefReadModel;
  businessUnit: { id: string; name: string };
  /** Quantidade física. Nunca negativa. */
  onHand: string;
  reserved: string;
  available: string;
  /** `0` significa "sem mínimo definido". */
  minimumStock: string;
  /** `OK` · `LOW` · `OUT_OF_STOCK`, decidido pelo servidor. */
  status: InventoryStockStatus;
  lastMovementAt: string | null;
  updatedAt: string;
}

/**
 * Um fato do livro.
 *
 * `balanceAfter` é o saldo da unidade logo depois deste movimento, gravado na
 * mesma instrução que o produziu. É o que permite reconstituir o histórico e
 * detectar divergência entre livro e projeção.
 */
export interface InventoryMovementReadModel {
  id: string;
  type: InventoryMovementType;
  /** `IN` ou `OUT` — a direção que o tipo implica, resolvida no servidor. */
  direction: 'IN' | 'OUT';
  quantity: string;
  balanceAfter: string;
  reason: string | null;
  notes: string | null;
  item: InventoryItemRefReadModel;
  businessUnit: { id: string; name: string };
  operation: { id: string; code: string; title: string } | null;
  origin: { source: string; entityId: string | null };
  /**
   * Identidade compartilhada pelas duas pontas de uma transferência.
   *
   * A contraparte vem só como **id**. Publicar o nome exigiria carregar a
   * outra unidade em toda listagem de movimento, e quem lê o extrato de uma
   * filial quase nunca precisa dele — a resposta da transferência traz os dois
   * lados completos. Um nome vazio no lugar seria pior: o contrato passaria a
   * carregar um campo que nunca vale nada.
   */
  transfer: { id: string; counterpartUnitId: string } | null;
  createdBy: InventoryActorReadModel;
  createdAt: string;
}

/** As duas pontas de uma transferência, como um fato só. */
export interface InventoryTransferReadModel {
  transferId: string;
  out: InventoryMovementReadModel;
  in: InventoryMovementReadModel;
}

/* -------------------------------------------------------------------- */
/* Analytics                                                             */
/* -------------------------------------------------------------------- */

/**
 * Panorama do estoque.
 *
 * Contagens e somas de quantidade — **nenhum valor monetário**, pela razão
 * explicada no topo. Entradas e saídas são somas de quantidade por período, e
 * elas só são comparáveis entre si dentro do mesmo item: somar quilos de gás
 * com unidades de filtro produziria um número sem significado, e por isso os
 * totais vêm acompanhados da contagem de movimentos, não apresentados como
 * "volume do estoque".
 */
export interface InventorySummaryReadModel {
  period: { from: string; to: string };
  /** Itens com saldo registrado — o que a organização de fato controla. */
  trackedItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  /** Movimentos do período, por direção. */
  movements: {
    entries: { count: number; quantity: string };
    exits: { count: number; quantity: string };
    consumption: { count: number; quantity: string };
    transfers: { count: number };
    adjustments: { count: number };
  };
}

/** Consumo por item no período — o que mais sai da prateleira. */
export interface InventoryConsumptionPointReadModel {
  item: InventoryItemRefReadModel;
  quantity: string;
  movements: number;
}
