/// Typed public contracts for the server-authoritative Mobile Field projection.
enum MobileWorkItemKind { serviceOperation, pmoc, rvt }

enum MobileDueState { inProgress, overdue, dueToday, upcoming, unscheduled }

enum MobileFieldAction {
  view,
  openRoute,
  callContact,
  whatsappContact,
  start,
  resume,
  complete,
  addEvidence,
  viewDocument,
  downloadDocument,
  executePmoc,
  executeRvt,
  scanEquipment,
}

class MobilePartySummaryContract {
  const MobilePartySummaryContract({required this.id, required this.name});
  final String id;
  final String name;
}

class MobileContactSummaryContract {
  const MobileContactSummaryContract({required this.name, this.phone, this.email});
  final String name;
  final String? phone;
  final String? email;
}

class MobileCustomerSummaryContract extends MobilePartySummaryContract {
  const MobileCustomerSummaryContract({
    required super.id,
    required super.name,
    this.address,
    this.contact,
  });
  final Map<String, Object?>? address;
  final MobileContactSummaryContract? contact;
}

class MobileEquipmentSummaryContract {
  const MobileEquipmentSummaryContract({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    required this.qrAvailable,
    this.code,
    this.brand,
    this.model,
    this.sector,
  });
  final String id;
  final String? code;
  final String name;
  final String type;
  final String? brand;
  final String? model;
  final String? sector;
  final String status;
  final bool qrAvailable;
}

class MobileArtifactSummaryContract {
  const MobileArtifactSummaryContract({
    required this.id,
    required this.type,
    required this.status,
    required this.previewAvailable,
    required this.downloadAvailable,
  });
  final String id;
  final String type;
  final String status;
  final bool previewAvailable;
  final bool downloadAvailable;
}

class MobileNavigationContextContract {
  const MobileNavigationContextContract({
    required this.kind,
    required this.sourceId,
    this.executionId,
    this.occurrenceId,
    this.cycleId,
    this.equipmentId,
  });
  final MobileWorkItemKind kind;
  final String sourceId;
  final String? executionId;
  final String? occurrenceId;
  final String? cycleId;
  final String? equipmentId;
}

class MobileWorkItemContract {
  const MobileWorkItemContract({
    required this.id,
    required this.kind,
    required this.sourceId,
    required this.title,
    required this.businessUnit,
    required this.timezone,
    required this.dueState,
    required this.operationalStatus,
    required this.responsibleFieldTechnician,
    required this.auxiliaryTechnicians,
    required this.equipmentSummary,
    required this.artifacts,
    required this.allowedActions,
    required this.navigationContext,
    required this.updatedAt,
    this.schedulingId,
    this.description,
    this.customer,
    this.location,
    this.scheduledFor,
    this.scheduledEnd,
    this.priority,
    this.primaryAction,
  });
  final String id;
  final MobileWorkItemKind kind;
  final String sourceId;
  final String? schedulingId;
  final String title;
  final String? description;
  final MobilePartySummaryContract businessUnit;
  final MobileCustomerSummaryContract? customer;
  final Map<String, Object?>? location;
  final DateTime? scheduledFor;
  final DateTime? scheduledEnd;
  final String timezone;
  final MobileDueState dueState;
  final String operationalStatus;
  final String? priority;
  final MobilePartySummaryContract? responsibleFieldTechnician;
  final List<MobilePartySummaryContract> auxiliaryTechnicians;
  final List<MobileEquipmentSummaryContract> equipmentSummary;
  final List<MobileArtifactSummaryContract> artifacts;
  final List<MobileFieldAction> allowedActions;
  final MobileFieldAction? primaryAction;
  final MobileNavigationContextContract navigationContext;
  final DateTime updatedAt;
}

class MobileFieldCountersContract {
  const MobileFieldCountersContract({
    required this.today,
    required this.overdue,
    required this.inProgress,
    required this.upcoming,
  });
  final int today;
  final int overdue;
  final int inProgress;
  final int upcoming;
}

class MobileFieldDashboardContract {
  const MobileFieldDashboardContract({
    required this.counters,
    required this.today,
    required this.overdue,
    required this.inProgress,
    required this.canScanEquipment,
    required this.canCreateAdHocRvt,
    this.next,
  });
  final MobileWorkItemContract? next;
  final MobileFieldCountersContract counters;
  final List<MobileWorkItemContract> today;
  final List<MobileWorkItemContract> overdue;
  final List<MobileWorkItemContract> inProgress;
  final bool canScanEquipment;
  final bool canCreateAdHocRvt;
}

class MobileWorkQueuePageContract {
  const MobileWorkQueuePageContract({
    required this.data,
    required this.limit,
    required this.hasNextPage,
    this.nextCursor,
  });
  final List<MobileWorkItemContract> data;
  final int limit;
  final String? nextCursor;
  final bool hasNextPage;
}

class MobileFieldContextContract {
  const MobileFieldContextContract({
    required this.workItem,
    required this.artifacts,
    required this.snapshotVersion,
  });
  final MobileWorkItemContract workItem;
  final List<MobileArtifactSummaryContract> artifacts;
  final int snapshotVersion;
}
