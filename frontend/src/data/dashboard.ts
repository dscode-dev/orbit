"use client";

/**
 * Mocks do Dashboard — Orbit V2
 *
 * A forma dos objetos abaixo espelha os contratos previstos para o backend
 * (`GET /api/v1/dashboard/*`), de modo que a integração futura seja apenas a
 * troca da origem dos dados, sem alterar componentes.
 *
 * Convenções de contrato:
 * - `id` sempre string (uuid no backend)
 * - datas em ISO 8601 (UTC)
 * - enums em snake_case
 * - valores numéricos crus (formatação é responsabilidade da UI)
 */

/* ------------------------------------------------------------------ */
/* Tipos de contrato                                                   */
/* ------------------------------------------------------------------ */

export type DashboardRange = "today" | "7d" | "30d";

export type Trend = "up" | "down" | "neutral";

export type OperationStatus = "open" | "in_progress" | "done" | "blocked" | "cancelled";

export type Severity = "critical" | "warning" | "info" | "success";

/** GET /api/v1/dashboard/summary */
export type DashboardSummary = {
  organization: { id: string; name: string; plan: string };
  user: { id: string; name: string; firstName: string };
  generatedAt: string;
  range: DashboardRange;
};

/** GET /api/v1/dashboard/kpis */
export type KpiMetric = {
  id: "operations_open" | "operations_in_progress" | "operations_done_today" | "operations_pending";
  label: string;
  value: number;
  previousValue: number;
  deltaPercent: number;
  trend: Trend;
  hint: string;
};

/** GET /api/v1/dashboard/attention */
export type AttentionItem = {
  id: string;
  severity: Severity;
  label: string;
  value: number;
  unit: "count" | "percent";
  description: string;
  actionLabel: string;
  href: string;
};

/** GET /api/v1/dashboard/charts/operations-evolution */
export type OperationsEvolutionPoint = {
  date: string;
  label: string;
  created: number;
  completed: number;
  backlog: number;
};

/** GET /api/v1/dashboard/charts/productivity */
export type ProductivityRow = {
  userId: string;
  name: string;
  initials: string;
  completed: number;
  inProgress: number;
  efficiency: number;
};

/** GET /api/v1/dashboard/charts/status-distribution */
export type StatusSlice = {
  status: OperationStatus;
  label: string;
  value: number;
  colorToken: string;
};

/** GET /api/v1/dashboard/events */
export type AgendaEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timeLabel: string;
  dayLabel: string;
  owner: { id: string; name: string; initials: string };
  location: string | null;
  type: "task" | "meeting" | "deadline" | "maintenance";
};

/** GET /api/v1/dashboard/alerts */
export type AlertItem = {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  createdAt: string;
  timeAgo: string;
  source: string;
  acknowledged: boolean;
};

/** GET /api/v1/dashboard/activities */
export type ActivityItem = {
  id: string;
  actor: { id: string; name: string };
  action: string;
  target: string;
  createdAt: string;
  timeLabel: string;
  tone: "default" | "success" | "warning" | "destructive";
};

export type DashboardPayload = {
  summary: DashboardSummary;
  kpis: KpiMetric[];
  attention: AttentionItem[];
  operationsEvolution: OperationsEvolutionPoint[];
  productivity: ProductivityRow[];
  statusDistribution: StatusSlice[];
  events: AgendaEvent[];
  alerts: AlertItem[];
  activities: ActivityItem[];
};

/* ------------------------------------------------------------------ */
/* Dados mockados                                                      */
/* ------------------------------------------------------------------ */

export const rangeOptions: { value: DashboardRange; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

const summary: DashboardSummary = {
  organization: { id: "org_001", name: "Orbit Operações", plan: "PRO" },
  user: { id: "usr_001", name: "Marina Alves", firstName: "Marina" },
  generatedAt: "2026-07-30T12:00:00.000Z",
  range: "7d",
};

const kpisByRange: Record<DashboardRange, KpiMetric[]> = {
  today: [
    { id: "operations_open", label: "Operações abertas", value: 34, previousValue: 30, deltaPercent: 13.3, trend: "up", hint: "vs. ontem" },
    { id: "operations_in_progress", label: "Em execução", value: 18, previousValue: 21, deltaPercent: -14.3, trend: "down", hint: "vs. ontem" },
    { id: "operations_done_today", label: "Concluídas hoje", value: 12, previousValue: 9, deltaPercent: 33.3, trend: "up", hint: "meta diária: 15" },
    { id: "operations_pending", label: "Pendências", value: 7, previousValue: 7, deltaPercent: 0, trend: "neutral", hint: "sem variação" },
  ],
  "7d": [
    { id: "operations_open", label: "Operações abertas", value: 128, previousValue: 112, deltaPercent: 14.3, trend: "up", hint: "vs. período anterior" },
    { id: "operations_in_progress", label: "Em execução", value: 46, previousValue: 52, deltaPercent: -11.5, trend: "down", hint: "vs. período anterior" },
    { id: "operations_done_today", label: "Concluídas hoje", value: 19, previousValue: 14, deltaPercent: 35.7, trend: "up", hint: "meta diária: 15" },
    { id: "operations_pending", label: "Pendências", value: 23, previousValue: 27, deltaPercent: -14.8, trend: "down", hint: "7 atrasadas" },
  ],
  "30d": [
    { id: "operations_open", label: "Operações abertas", value: 512, previousValue: 480, deltaPercent: 6.7, trend: "up", hint: "vs. período anterior" },
    { id: "operations_in_progress", label: "Em execução", value: 174, previousValue: 168, deltaPercent: 3.6, trend: "up", hint: "vs. período anterior" },
    { id: "operations_done_today", label: "Concluídas hoje", value: 19, previousValue: 16, deltaPercent: 18.8, trend: "up", hint: "meta diária: 15" },
    { id: "operations_pending", label: "Pendências", value: 61, previousValue: 74, deltaPercent: -17.6, trend: "down", hint: "12 atrasadas" },
  ],
};

const attention: AttentionItem[] = [
  {
    id: "att_001",
    severity: "critical",
    label: "Operações atrasadas",
    value: 7,
    unit: "count",
    description: "Prazo excedido há mais de 24h",
    actionLabel: "Revisar",
    href: "/operations?filter=overdue",
  },
  {
    id: "att_002",
    severity: "warning",
    label: "Documentos aguardando assinatura",
    value: 3,
    unit: "count",
    description: "Bloqueando o fechamento de 2 operações",
    actionLabel: "Assinar",
    href: "/documents?status=pending_signature",
  },
  {
    id: "att_003",
    severity: "info",
    label: "Integrações com erro",
    value: 2,
    unit: "count",
    description: "Última sincronização falhou",
    actionLabel: "Diagnosticar",
    href: "/settings/integrations",
  },
  {
    id: "att_004",
    severity: "success",
    label: "Cota de usuários do plano PRO",
    value: 82,
    unit: "percent",
    description: "41 de 50 licenças ativas",
    actionLabel: "Gerenciar",
    href: "/settings/billing",
  },
];

const evolutionByRange: Record<DashboardRange, OperationsEvolutionPoint[]> = {
  today: [
    { date: "2026-07-30T06:00:00.000Z", label: "06h", created: 3, completed: 1, backlog: 22 },
    { date: "2026-07-30T09:00:00.000Z", label: "09h", created: 7, completed: 4, backlog: 25 },
    { date: "2026-07-30T12:00:00.000Z", label: "12h", created: 5, completed: 6, backlog: 24 },
    { date: "2026-07-30T15:00:00.000Z", label: "15h", created: 6, completed: 8, backlog: 22 },
    { date: "2026-07-30T18:00:00.000Z", label: "18h", created: 2, completed: 5, backlog: 19 },
  ],
  "7d": [
    { date: "2026-07-24", label: "24/07", created: 22, completed: 18, backlog: 96 },
    { date: "2026-07-25", label: "25/07", created: 26, completed: 21, backlog: 101 },
    { date: "2026-07-26", label: "26/07", created: 15, completed: 19, backlog: 97 },
    { date: "2026-07-27", label: "27/07", created: 31, completed: 24, backlog: 104 },
    { date: "2026-07-28", label: "28/07", created: 28, completed: 30, backlog: 102 },
    { date: "2026-07-29", label: "29/07", created: 34, completed: 27, backlog: 109 },
    { date: "2026-07-30", label: "30/07", created: 24, completed: 33, backlog: 100 },
  ],
  "30d": [
    { date: "2026-07-02", label: "Sem 1", created: 118, completed: 104, backlog: 88 },
    { date: "2026-07-09", label: "Sem 2", created: 132, completed: 121, backlog: 95 },
    { date: "2026-07-16", label: "Sem 3", created: 127, completed: 138, backlog: 84 },
    { date: "2026-07-23", label: "Sem 4", created: 141, completed: 129, backlog: 97 },
    { date: "2026-07-30", label: "Sem 5", created: 96, completed: 112, backlog: 100 },
  ],
};

const productivity: ProductivityRow[] = [
  { userId: "usr_002", name: "Ana Ribeiro", initials: "AR", completed: 42, inProgress: 6, efficiency: 94 },
  { userId: "usr_003", name: "Bruno Costa", initials: "BC", completed: 37, inProgress: 9, efficiency: 88 },
  { userId: "usr_004", name: "Carla Dias", initials: "CD", completed: 31, inProgress: 4, efficiency: 91 },
  { userId: "usr_005", name: "Diego Souza", initials: "DS", completed: 27, inProgress: 11, efficiency: 76 },
  { userId: "usr_006", name: "Elisa Prado", initials: "EP", completed: 22, inProgress: 5, efficiency: 83 },
  { userId: "usr_007", name: "Felipe Nunes", initials: "FN", completed: 18, inProgress: 8, efficiency: 71 },
];

const statusDistribution: StatusSlice[] = [
  { status: "open", label: "Abertas", value: 128, colorToken: "var(--color-chart-1)" },
  { status: "in_progress", label: "Em execução", value: 46, colorToken: "var(--color-chart-2)" },
  { status: "done", label: "Concluídas", value: 174, colorToken: "var(--color-chart-3)" },
  { status: "blocked", label: "Bloqueadas", value: 23, colorToken: "var(--color-chart-4)" },
  { status: "cancelled", label: "Canceladas", value: 9, colorToken: "var(--color-chart-5)" },
];

const events: AgendaEvent[] = [
  {
    id: "evt_001",
    title: "Revisão de operações críticas",
    startsAt: "2026-07-30T13:30:00.000Z",
    endsAt: "2026-07-30T14:15:00.000Z",
    timeLabel: "10:30",
    dayLabel: "Hoje",
    owner: { id: "usr_002", name: "Ana Ribeiro", initials: "AR" },
    location: "Sala Órbita",
    type: "meeting",
  },
  {
    id: "evt_002",
    title: "Fechamento do ciclo semanal",
    startsAt: "2026-07-30T18:00:00.000Z",
    endsAt: "2026-07-30T19:00:00.000Z",
    timeLabel: "15:00",
    dayLabel: "Hoje",
    owner: { id: "usr_001", name: "Marina Alves", initials: "MA" },
    location: null,
    type: "deadline",
  },
  {
    id: "evt_003",
    title: "Checklist de conformidade",
    startsAt: "2026-07-31T11:00:00.000Z",
    endsAt: "2026-07-31T12:00:00.000Z",
    timeLabel: "08:00",
    dayLabel: "Amanhã",
    owner: { id: "usr_004", name: "Carla Dias", initials: "CD" },
    location: "Unidade Centro",
    type: "task",
  },
  {
    id: "evt_004",
    title: "Janela de manutenção programada",
    startsAt: "2026-08-01T03:00:00.000Z",
    endsAt: "2026-08-01T05:00:00.000Z",
    timeLabel: "00:00",
    dayLabel: "Sáb, 01/08",
    owner: { id: "usr_003", name: "Bruno Costa", initials: "BC" },
    location: "Infraestrutura",
    type: "maintenance",
  },
];

const alerts: AlertItem[] = [
  {
    id: "alr_001",
    severity: "critical",
    title: "7 operações com prazo excedido",
    description: "Concentradas em 2 responsáveis. Requer redistribuição.",
    createdAt: "2026-07-30T11:12:00.000Z",
    timeAgo: "há 48 min",
    source: "Motor de SLA",
    acknowledged: false,
  },
  {
    id: "alr_002",
    severity: "warning",
    title: "Estoque abaixo do mínimo em 4 itens",
    description: "Reposição sugerida antes do próximo ciclo.",
    createdAt: "2026-07-30T09:40:00.000Z",
    timeAgo: "há 2 h",
    source: "Inventário",
    acknowledged: false,
  },
  {
    id: "alr_003",
    severity: "info",
    title: "Integração de dados falhou 2 vezes",
    description: "Retentativa automática agendada para 14:00.",
    createdAt: "2026-07-30T08:05:00.000Z",
    timeAgo: "há 4 h",
    source: "Integrações",
    acknowledged: true,
  },
  {
    id: "alr_004",
    severity: "success",
    title: "Backup diário concluído",
    description: "Todos os registros replicados com sucesso.",
    createdAt: "2026-07-30T04:00:00.000Z",
    timeAgo: "há 8 h",
    source: "Plataforma",
    acknowledged: true,
  },
];

const activities: ActivityItem[] = [
  {
    id: "act_001",
    actor: { id: "usr_002", name: "Ana Ribeiro" },
    action: "concluiu a operação",
    target: "OP-2451",
    createdAt: "2026-07-30T11:52:00.000Z",
    timeLabel: "08:52",
    tone: "success",
  },
  {
    id: "act_002",
    actor: { id: "usr_005", name: "Diego Souza" },
    action: "reabriu a operação",
    target: "OP-2418",
    createdAt: "2026-07-30T11:20:00.000Z",
    timeLabel: "08:20",
    tone: "warning",
  },
  {
    id: "act_003",
    actor: { id: "usr_004", name: "Carla Dias" },
    action: "anexou 3 documentos em",
    target: "OP-2440",
    createdAt: "2026-07-30T10:44:00.000Z",
    timeLabel: "07:44",
    tone: "default",
  },
  {
    id: "act_004",
    actor: { id: "usr_003", name: "Bruno Costa" },
    action: "marcou como bloqueada",
    target: "OP-2399",
    createdAt: "2026-07-30T09:58:00.000Z",
    timeLabel: "06:58",
    tone: "destructive",
  },
  {
    id: "act_005",
    actor: { id: "usr_006", name: "Elisa Prado" },
    action: "criou a operação",
    target: "OP-2460",
    createdAt: "2026-07-30T09:12:00.000Z",
    timeLabel: "06:12",
    tone: "default",
  },
];

/**
 * Substituto do futuro `GET /api/v1/dashboard?range=...`.
 * Síncrono de propósito: nenhuma chamada de API nesta fase.
 */
export function getDashboardData(range: DashboardRange): DashboardPayload {
  return {
    summary: { ...summary, range },
    kpis: kpisByRange[range],
    attention,
    operationsEvolution: evolutionByRange[range],
    productivity,
    statusDistribution,
    events,
    alerts,
    activities,
  };
}
