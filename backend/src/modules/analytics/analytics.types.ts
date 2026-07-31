export type AnalyticsGranularity = 'DAY' | 'WEEK' | 'MONTH';
export type AnalyticsRange = {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  granularity: AnalyticsGranularity;
  businessUnitId?: string;
};

export type AnalyticsOperation = {
  id: string;
  status: string;
  scheduledEnd: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  users: Array<{ user: { id: string; displayName: string } }>;
};

export type AnalyticsSnapshot = {
  organization: { id: string; segment: string };
  range: AnalyticsRange;
  operations: AnalyticsOperation[];
  previousOperations: AnalyticsOperation[];
  pmocs: Array<{ status: string; createdAt: Date; finalizedAt: Date | null }>;
  assets: Array<{ status: string }>;
  customers: Array<{ status: string }>;
};
