/**
 * O catálogo do Automation Engine.
 *
 * Tudo o que uma regra pode dizer está aqui: os gatilhos que existem, os
 * operadores que o interpretador entende, os campos que cada evento oferece e
 * as ações que o servidor sabe executar.
 *
 * **É uma lista fechada, e isso é a funcionalidade.** Sem script, sem
 * expressão, sem template: uma regra que só pode dizer o que este arquivo
 * declara é uma regra que nunca executa o que ninguém previu. A superfície de
 * automação de um ERP multi-tenant é exatamente a superfície de ataque dele.
 */

import {
  AutomationActionType,
  AutomationConditionOperator,
  AutomationDelayUnit,
  AutomationNotificationTarget,
} from '../../contracts';

/* -------------------------------------------------------------------- */
/* Gatilhos                                                              */
/* -------------------------------------------------------------------- */

/**
 * Um gatilho declarado.
 *
 * `fields` é o que as condições podem examinar naquele evento — e é também o
 * que o payload precisa carregar. Um campo fora desta lista não é avaliável, e
 * a regra que o cite é recusada na criação em vez de falhar em silêncio meses
 * depois.
 */
export interface TriggerDefinition {
  readonly type: string;
  readonly label: string;
  readonly description: string;
  /** Entidade que originou o fato — usada na navegação e no log. */
  readonly entityType: string;
  readonly fields: readonly string[];
}

export const TRIGGERS: readonly TriggerDefinition[] = [
  {
    type: 'operation.created',
    label: 'Operação criada',
    description: 'Uma ordem de serviço foi aberta.',
    entityType: 'OPERATION',
    fields: ['kind', 'status', 'priority', 'businessUnitId', 'customerId'],
  },
  {
    type: 'operation.status.changed',
    label: 'Situação da operação mudou',
    description:
      'Qualquer transição de status. `fromStatus` e `status` estão disponíveis.',
    entityType: 'OPERATION',
    fields: [
      'kind',
      'status',
      'fromStatus',
      'priority',
      'businessUnitId',
      'customerId',
    ],
  },
  {
    /**
     * Concluída é um caso de `status.changed`, publicado à parte.
     *
     * Não é redundância: "quando concluir" é a regra que a operação de campo
     * mais escreve, e obrigá-la a condicionar `status == COMPLETED` num gatilho
     * genérico convidaria ao erro de esquecer a condição — e a regra dispararia
     * em toda pausa.
     */
    type: 'operation.completed',
    label: 'Operação concluída',
    description: 'A ordem de serviço foi finalizada.',
    entityType: 'OPERATION',
    fields: ['kind', 'priority', 'businessUnitId', 'customerId', 'assetId'],
  },
  {
    type: 'artifact.execution.completed',
    label: 'Execução de artefato concluída',
    description: 'Um formulário de campo foi finalizado.',
    entityType: 'ARTIFACT_EXECUTION',
    fields: [
      'artifactType',
      'templateKey',
      'businessUnitId',
      'customerId',
      'operationId',
    ],
  },
  {
    type: 'artifact.manifest.issued',
    label: 'Documento emitido',
    description: 'Uma revisão de documento foi oficialmente emitida.',
    entityType: 'ARTIFACT_MANIFEST',
    fields: ['artifactType', 'businessUnitId', 'executionId'],
  },
  {
    type: 'quote.approved',
    label: 'Orçamento aprovado',
    description: 'O cliente aceitou a proposta.',
    entityType: 'QUOTE',
    fields: ['businessUnitId', 'customerId', 'total', 'currency'],
  },
  {
    type: 'inventory.low_stock',
    label: 'Estoque baixo',
    description:
      'Um saldo cruzou o mínimo configurado, ou zerou, depois de uma saída.',
    entityType: 'INVENTORY_BALANCE',
    fields: ['catalogItemId', 'businessUnitId', 'status', 'kind'],
  },
];

export const TRIGGER_TYPES: readonly string[] = TRIGGERS.map(
  (trigger) => trigger.type,
);

export const findTrigger = (type: string): TriggerDefinition | undefined =>
  TRIGGERS.find((trigger) => trigger.type === type);

/* -------------------------------------------------------------------- */
/* Condições                                                             */
/* -------------------------------------------------------------------- */

/**
 * Quatro operadores. Nenhum deles executa nada.
 *
 * `equals` e `notEquals` comparam texto; `in` testa pertinência a uma lista
 * fechada; `exists` pergunta se o campo veio preenchido. Não há `contains`
 * nem comparação numérica — os dois convidam à expressão, e expressão é o
 * começo de linguagem.
 *
 * O conjunto mora em `contracts/literals` — é contrato público, sincronizado
 * com os clientes. Aqui fica só a forma de lista, que o DTO e o catálogo usam.
 */
export const CONDITION_OPERATORS: readonly ConditionOperator[] = Object.values(
  AutomationConditionOperator,
);
export type ConditionOperator = AutomationConditionOperator;

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  /** Texto para `equals`/`notEquals`, lista para `in`, ausente em `exists`. */
  value?: string | readonly string[];
}

/* -------------------------------------------------------------------- */
/* Ações                                                                 */
/* -------------------------------------------------------------------- */

export const ACTION_TYPES: readonly ActionType[] =
  Object.values(AutomationActionType);
export type ActionType = AutomationActionType;

export const DELAY_UNITS: readonly DelayUnit[] =
  Object.values(AutomationDelayUnit);
export type DelayUnit = AutomationDelayUnit;

export interface ActionDelay {
  amount: number;
  unit: DelayUnit;
}

/**
 * Quem recebe uma notificação.
 *
 * `OWNER` é quem criou o registro que gerou o evento; `ACTOR` é quem provocou
 * o evento; `USER` é alguém escolhido na regra. **Não há e-mail livre nem
 * destinatário fora da organização** — o alvo é sempre um usuário do tenant,
 * resolvido no momento da execução.
 */
export const NOTIFICATION_TARGETS: readonly NotificationTarget[] =
  Object.values(AutomationNotificationTarget);
export type NotificationTarget = AutomationNotificationTarget;

/**
 * Filas que uma regra pode acionar.
 *
 * Lista fechada e curta: `TRIGGER_JOB` existe para trabalho **interno e
 * conhecido**, não para chamar qualquer coisa. Não há URL, webhook nem
 * requisição HTTP — nesta PR, por decisão explícita.
 */
export const ALLOWED_JOB_QUEUES: readonly string[] = ['artifact.render'];

export interface RuleAction {
  /** Identidade estável dentro da regra — parte da chave de idempotência. */
  id: string;
  type: ActionType;
  delay?: ActionDelay;
  /** Configuração específica do tipo, validada por ele. */
  config: Record<string, unknown>;
}

export interface ActionDefinition {
  readonly type: ActionType;
  readonly label: string;
  readonly description: string;
  /** Campos de configuração aceitos, para a interface montar o formulário. */
  readonly config: readonly {
    readonly key: string;
    readonly required: boolean;
    readonly description: string;
    /**
     * Valores aceitos, quando o campo tem conjunto fechado.
     *
     * Publicado porque a alternativa é o cliente pedir que alguém **digite**
     * o nome interno de uma fila, ou manter uma lista própria que diverge no
     * primeiro valor novo. A descrição em prosa não serve para montar um
     * seletor.
     */
    readonly options?: readonly string[];
  }[];
  /** `false` quando o motor ainda não sabe executar — declarado, não oculto. */
  readonly available: boolean;
  readonly unavailableReason?: string;
}

export const ACTIONS: readonly ActionDefinition[] = [
  {
    type: 'CREATE_REMINDER',
    label: 'Criar lembrete na agenda',
    description:
      'Cria um evento futuro no calendário padrão da unidade. É o que fecha "concluiu preventiva, lembrar em seis meses".',
    config: [
      { key: 'title', required: true, description: 'Título do lembrete.' },
      {
        key: 'description',
        required: false,
        description: 'Texto do lembrete.',
      },
      {
        key: 'durationMinutes',
        required: false,
        description: 'Duração do bloco na agenda. Uma hora por padrão.',
      },
    ],
    available: true,
  },
  {
    type: 'SEND_NOTIFICATION',
    label: 'Enviar notificação',
    description:
      'Cria uma notificação para o dono do registro, para quem provocou o evento, ou para um usuário escolhido.',
    config: [
      { key: 'title', required: true, description: 'Título da notificação.' },
      { key: 'body', required: true, description: 'Corpo da notificação.' },
      {
        key: 'target',
        required: true,
        description: '`OWNER`, `ACTOR` ou `USER`.',
        options: NOTIFICATION_TARGETS,
      },
      {
        key: 'userId',
        required: false,
        description: 'Destinatário, obrigatório quando `target` é `USER`.',
      },
    ],
    available: true,
  },
  {
    /**
     * Operação de acompanhamento — **preparada, não ligada**.
     *
     * `Operation` exige `code` único por organização, e gerar código em nome de
     * alguém é decisão de numeração que o domínio de operações não delega. Criar
     * uma sequência aqui produziria uma segunda regra de numeração, divergente
     * da que a equipe usa na mão.
     *
     * O caminho limpo é o domínio de operações publicar uma criação com código
     * derivado — como o Commercial Engine fez ao converter orçamento. Até lá, a
     * ação é declarada indisponível em vez de improvisada.
     */
    type: 'CREATE_FOLLOW_UP_OPERATION',
    label: 'Abrir operação de acompanhamento',
    description:
      'Abriria uma nova ordem de serviço derivada do evento, para retorno ou revisão.',
    config: [],
    available: false,
    unavailableReason:
      'Operação exige código único por organização, e não há contrato que o derive automaticamente. Criar uma numeração aqui competiria com a que a equipe já usa.',
  },
  {
    type: 'TRIGGER_JOB',
    label: 'Acionar trabalho interno',
    description:
      'Enfileira um trabalho conhecido da plataforma. Sem URL, webhook ou requisição externa.',
    config: [
      {
        key: 'queue',
        required: true,
        description: `Uma de: ${ALLOWED_JOB_QUEUES.join(', ')}.`,
        options: ALLOWED_JOB_QUEUES,
      },
      {
        key: 'payload',
        required: false,
        description: 'Objeto simples repassado ao trabalho.',
      },
    ],
    available: true,
  },
];

export const findAction = (type: string): ActionDefinition | undefined =>
  ACTIONS.find((action) => action.type === type);
