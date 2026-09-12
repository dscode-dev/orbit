/**
 * Read Models do domínio PMOC.
 *
 * O detalhe de um plano responde, **sem que o cliente calcule nada**: em que
 * estado ele está, se a manutenção está em dia, quando foi a última, quando é a
 * próxima, quantos dias faltam, quem é o responsável, quais equipamentos estão
 * cobertos e qual ordem de serviço e qual documento cumpriram cada ciclo.
 *
 * Datas de vigência e de vencimento viajam como `YYYY-MM-DD`: são **dias**, e
 * um instante com fuso faria o mesmo vencimento parecer diferente conforme
 * quem consulta. Momentos reais — execução, criação — viajam como ISO completo.
 */
import type { PmocComplianceStatus, PmocFrequencyUnit } from '../../contracts';

export interface PmocFrequencyReadModel {
  amount: number;
  unit: PmocFrequencyUnit;
  /** "a cada 6 meses" — pronto para exibir, resolvido no servidor. */
  label: string;
}

export interface PmocComplianceReadModel {
  status: PmocComplianceStatus;
  /** Negativo quando venceu; `null` quando não há vencimento definido. */
  daysUntilDue: number | null;
  overdue: boolean;
  /** Antecedência configurada para `DUE_SOON`, em dias. */
  dueSoonDays: number;
  lastExecutedAt: string | null;
  nextDueOn: string | null;
  /** Instante do servidor em que a avaliação foi feita. */
  evaluatedAt: string;
}

export interface PmocCoverageReadModel {
  id: string;
  startsOn: string;
  endsOn: string | null;
  notes: string | null;
  /**
   * O equipamento, por referência.
   *
   * Nome, modelo e série continuam sendo do cadastro de equipamentos — aqui
   * viaja o suficiente para exibir a linha e navegar até ele.
   */
  asset: {
    id: string;
    name: string;
    category: string;
    identifier: string | null;
    serialNumber: string | null;
    status: string;
  };
}

export interface PmocCursorPageReadModel<T> {
  data: readonly T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface PmocTimelineItemReadModel {
  id: string;
  type: string;
  message: string;
  occurredAt: string;
  actor: { id: string; displayName: string } | null;
  equipment: { id: string; name: string } | null;
  data: Record<string, unknown>;
}

export interface PmocExecutionReadModel {
  id: string;
  sequenceNumber: number;
  dueOn: string;
  status: string;
  performedAt: string | null;
  notes: string | null;
  completedBy: { id: string; displayName: string } | null;
  /** A ordem de serviço que cumpriu a execução. */
  operation: { id: string; code: string; status: string } | null;
  /** A evidência documental — execução real, nunca fabricada. */
  artifactExecution: { id: string; code: string; status: string } | null;
  /** O compromisso na Agenda existente. */
  schedulingEventId: string | null;
  createdAt: string;
}

export interface PmocEquipmentExecutionReadModel {
  id: string;
  status: string;
  performedAt: string | null;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  asset: {
    id: string;
    name: string;
    category: string;
    identifier: string | null;
    serialNumber: string | null;
  };
  responsibleFieldTechnician: { id: string; displayName: string };
  auxiliaryTechnicians: readonly { id: string; displayName: string }[];
  operation: { id: string; code: string; status: string } | null;
  artifactExecution: { id: string; code: string; status: string } | null;
  evidence: readonly {
    id: string;
    kind: string;
    caption: string | null;
    file: {
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: string;
      status: string;
    };
    createdAt: string;
  }[];
}

export interface PmocPlanSummaryReadModel {
  id: string;
  code: string;
  name: string;
  status: string;
  validity: { startsOn: string; endsOn: string | null };
  frequency: PmocFrequencyReadModel;
  compliance: PmocComplianceReadModel;
  businessUnit: { id: string; name: string };
  customer: { id: string; name: string };
  technician: { id: string; displayName: string } | null;
  coveredEquipment: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Uma unidade atendida pelo plano.
 *
 * "Unidade" é a parte do sistema que recebe manutenção — condensadora,
 * evaporadora, dutos —, não a máquina sob contrato: essa é o equipamento da
 * cobertura. É por unidade que o relatório final descreve o serviço, e
 * `checklist` é o que ele tem a descrever.
 */
export interface PmocPlanUnitReadModel {
  id: string;
  key: string;
  name: string;
  description: string | null;
  checklist: {
    id: string;
    name: string;
    items: readonly { key: string; label: string }[];
  } | null;
}

/**
 * Uma unidade no cadastro da organização.
 *
 * Sobrepõe-se a `PmocPlanUnitReadModel` de propósito e não é a mesma coisa: lá
 * a unidade aparece **como um plano a declarou**, para o relatório; aqui ela
 * aparece como cadastro — com `isActive` e `sortOrder`, que são decisões de
 * catálogo e não dizem nada sobre plano nenhum.
 */
export interface PmocUnitReadModel extends PmocPlanUnitReadModel {
  sortOrder: number;
  isActive: boolean;
}

export interface PmocPlanReadModel extends PmocPlanSummaryReadModel {
  notes: string | null;
  technicalResponsible: { id: string; displayName: string } | null;
  configuration: {
    serviceLocation: unknown;
    scope: unknown;
    serviceTypes: unknown;
    procedure: unknown;
    schedulingPaused: boolean;
    reviewRequired: boolean;
  };
  activatedAt: string | null;
  createdBy: { id: string; displayName: string };
  coverages: readonly PmocCoverageReadModel[];
  /** As unidades que este plano atende — o detalhamento do relatório final. */
  units: readonly PmocPlanUnitReadModel[];
  /** A execução aberta — a próxima manutenção prevista. */
  currentExecution: PmocExecutionReadModel | null;
  /** As últimas execuções, da mais recente para a mais antiga. */
  recentExecutions: readonly PmocExecutionReadModel[];
  /** Transições que **este** plano aceita agora. */
  allowedTransitions: readonly string[];
}

/**
 * O painel de conformidade da organização.
 *
 * Contagens, não índice. A fórmula de cada número está na documentação e no
 * `pmoc.domain.ts`; não há score composto, porque um número único esconde qual
 * plano venceu — que é a única informação acionável.
 */
export interface PmocComplianceSummaryReadModel {
  period: { from: string; to: string };
  plans: {
    total: number;
    draft: number;
    active: number;
    suspended: number;
    expired: number;
    cancelled: number;
  };
  compliance: {
    upToDate: number;
    dueSoon: number;
    overdue: number;
    /**
     * Percentual **explícito**: em dia ÷ (em dia + próximos + vencidos), sobre
     * planos ativos. `null` quando não há plano ativo — "100%" de nada afirmaria
     * uma conformidade que ninguém mantém.
     */
    upToDateRate: string | null;
  };
  equipment: { covered: number };
  executions: { completedInPeriod: number; pending: number; overdue: number };
  generatedAt: string;
}

/** Uma manutenção prevista, na visão de agenda do domínio. */
export interface PmocUpcomingReadModel {
  planId: string;
  planCode: string;
  planName: string;
  executionId: string | null;
  dueOn: string;
  daysUntilDue: number | null;
  compliance: PmocComplianceStatus;
  businessUnit: { id: string; name: string };
  customer: { id: string; name: string };
  coveredEquipment: number;
}

/* ------------------------------------------------------------------ */
/* PR-FX-03 — configuração do plano                                    */
/* ------------------------------------------------------------------ */

/**
 * O código que a tela preenche ao escolher o cliente.
 *
 * `reserved` é `false` de propósito: a sugestão não queima número. Quem
 * consome a sequência é o create, atomicamente — duas telas abertas ao mesmo
 * tempo veem o mesmo `003` e salvam como `003` e `004`, sem erro.
 */
export interface PmocCodeSuggestionReadModel {
  readonly customerId: string;
  readonly customerName: string;
  readonly suggestedCode: string;
  readonly sequence: number;
  readonly reserved: boolean;
}

/** Um atendimento previsto do plano, antes de o plano existir. */
export interface PmocPreviewCycleReadModel {
  readonly sequence: number;
  readonly dueOn: string;
}

/** A linha da matriz: um equipamento e as execuções que ele terá. */
export interface PmocPreviewMatrixRowReadModel {
  readonly equipment: {
    readonly id: string;
    readonly name: string;
    readonly model: string | null;
    readonly manufacturer: string | null;
    readonly status: string;
  };
  readonly executions: readonly {
    readonly executionNumber: number;
    readonly dueOn: string;
  }[];
}

/**
 * O que o plano vai gerar — projeção, sem efeito colateral.
 *
 * `projectedExecutions` é `cycleCount × equipmentCount`, calculado aqui e não
 * na tela: a aritmética de calendário que satura o fim do mês mora no domínio
 * e no banco, e uma terceira cópia em JavaScript de formulário divergiria na
 * primeira vigência que começa dia 31.
 */
export interface PmocPreviewReadModel {
  readonly customer: { readonly id: string; readonly name: string };
  readonly timezone: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly frequency: PmocFrequencyReadModel;
  readonly cycles: readonly PmocPreviewCycleReadModel[];
  readonly cycleCount: number;
  /** `true` quando a vigência é aberta e a lista foi truncada pelo teto. */
  readonly truncated: boolean;
  readonly equipmentCount: number;
  readonly matrix: readonly PmocPreviewMatrixRowReadModel[];
  readonly projectedExecutions: number;
}
