export type MobileWorkItemKind = 'SERVICE_OPERATION' | 'PMOC' | 'RVT';
export type MobileDueState =
  'IN_PROGRESS' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'UNSCHEDULED';
export type MobileFieldAction =
  | 'VIEW'
  | 'OPEN_ROUTE'
  | 'CALL_CONTACT'
  | 'WHATSAPP_CONTACT'
  | 'START'
  | 'RESUME'
  | 'COMPLETE'
  | 'ADD_EVIDENCE'
  | 'VIEW_DOCUMENT'
  | 'DOWNLOAD_DOCUMENT'
  | 'EXECUTE_PMOC'
  | 'EXECUTE_RVT'
  | 'SCAN_EQUIPMENT';

export interface MobilePartySummaryReadModel {
  id: string;
  name: string;
}
export interface MobileCustomerSummaryReadModel extends MobilePartySummaryReadModel {
  address: unknown;
  contact: { name: string; phone: string | null; email: string | null } | null;
}
export interface MobileEquipmentSummaryReadModel {
  id: string;
  code: string | null;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  sector: string | null;
  status: string;
  qrAvailable: boolean;
}
export interface MobileArtifactSummaryReadModel {
  id: string;
  type: string;
  status: string;
  previewAvailable: boolean;
  downloadAvailable: boolean;
}
export interface MobileNavigationContextReadModel {
  kind: MobileWorkItemKind;
  sourceId: string;
  executionId: string | null;
  occurrenceId: string | null;
  cycleId: string | null;
  equipmentId: string | null;
}
export interface MobileWorkItemReadModel {
  id: string;
  kind: MobileWorkItemKind;
  sourceId: string;
  schedulingId: string | null;
  title: string;
  description: string | null;
  businessUnit: MobilePartySummaryReadModel;
  customer: MobileCustomerSummaryReadModel | null;
  location: unknown;
  scheduledFor: string | null;
  scheduledEnd: string | null;
  timezone: string;
  dueState: MobileDueState;
  operationalStatus: string;
  priority: string | null;
  responsibleFieldTechnician: MobilePartySummaryReadModel | null;
  auxiliaryTechnicians: readonly MobilePartySummaryReadModel[];
  equipmentSummary: readonly MobileEquipmentSummaryReadModel[];
  artifacts: readonly MobileArtifactSummaryReadModel[];
  allowedActions: readonly MobileFieldAction[];
  primaryAction: MobileFieldAction | null;
  navigationContext: MobileNavigationContextReadModel;
  updatedAt: string;
}
export interface MobileWorkQueueReadModel {
  data: readonly MobileWorkItemReadModel[];
  meta: { limit: number; nextCursor: string | null; hasNextPage: boolean };
}
export interface MobileFieldSummaryReadModel {
  today: number;
  overdue: number;
  inProgress: number;
  upcoming: number;
}
export interface MobileFieldDashboardReadModel {
  next: MobileWorkItemReadModel | null;
  counters: MobileFieldSummaryReadModel;
  today: readonly MobileWorkItemReadModel[];
  overdue: readonly MobileWorkItemReadModel[];
  inProgress: readonly MobileWorkItemReadModel[];
  capabilities: { canScanEquipment: boolean; canCreateAdHocRvt: boolean };
}
export interface MobileAgendaReadModel {
  date: string;
  timezone: string;
  items: readonly MobileWorkItemReadModel[];
}
export interface MobileFieldContextReadModel {
  workItem: MobileWorkItemReadModel;
  request: { description: string | null };
  procedures: readonly { id: string; title: string; status: string }[];
  documentContext: readonly MobileArtifactSummaryReadModel[];
  financialSummary?: {
    currency: string;
    approvedAmount: string | null;
    paymentStatus: string | null;
  };
  snapshotVersion: 1;
}
