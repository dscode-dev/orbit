/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

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
import type { PmocComplianceStatus, PmocFrequencyUnit } from '../..';

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

export interface PmocExecutionReadModel {
  id: string;
  sequenceNumber: number;
  dueOn: string;
  status: string;
  performedAt: string | null;
  notes: string | null;
  completedBy: { id: string; displayName: string } | null;
  /** A ordem de serviço que cumpriu o ciclo. */
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
  asset: { id: string; name: string; category: string; identifier: string | null; serialNumber: string | null };
  responsibleFieldTechnician: { id: string; displayName: string };
  auxiliaryTechnicians: readonly { id: string; displayName: string }[];
  operation: { id: string; code: string; status: string } | null;
  artifactExecution: { id: string; code: string; status: string } | null;
  evidence: readonly { id: string; kind: string; caption: string | null; file: { id: string; fileName: string; mimeType: string; sizeBytes: string; status: string }; createdAt: string }[];
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
  /** O ciclo aberto — a próxima manutenção prevista. */
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
