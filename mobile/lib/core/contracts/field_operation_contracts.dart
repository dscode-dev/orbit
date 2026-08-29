import 'mobile_field_contracts.dart';

enum FieldOperationAllowedAction {
  view,
  openRoute,
  start,
  resume,
  complete,
  updateChecklist,
  addNote,
  registerMaterial,
  scanEquipment,
  viewDocument,
  downloadDocument,
}

class FieldOperationCommandContract {
  const FieldOperationCommandContract({
    required this.commandId,
    required this.idempotencyKey,
    required this.expectedVersion,
    required this.occurredAt,
  });
  final String commandId;
  final String idempotencyKey;
  final String expectedVersion;
  final DateTime occurredAt;
}

class FieldOperationChecklistItemContract {
  const FieldOperationChecklistItemContract({
    required this.id,
    required this.label,
    required this.type,
    required this.required,
    required this.options,
    this.answer,
  });
  final String id;
  final String label;
  final String type;
  final bool required;
  final List<String> options;
  final Object? answer;
}

class FieldOperationChecklistContract {
  const FieldOperationChecklistContract({
    required this.id,
    required this.name,
    required this.status,
    required this.progress,
    required this.version,
    required this.items,
    this.notes,
  });
  final String id;
  final String name;
  final String status;
  final int progress;
  final String version;
  final List<FieldOperationChecklistItemContract> items;
  final String? notes;
}

class FieldOperationMaterialPolicyContract {
  const FieldOperationMaterialPolicyContract({
    required this.enabled,
    required this.requiresAvailableStock,
    required this.idempotencyRequired,
  });
  final bool enabled;
  final bool requiresAvailableStock;
  final bool idempotencyRequired;
}

class FieldOperationStateContract {
  const FieldOperationStateContract({
    required this.id,
    required this.code,
    required this.title,
    required this.status,
    required this.priority,
    this.description,
    this.scheduledFor,
    this.startedAt,
    this.completedAt,
    this.startedBy,
    this.completedBy,
  });
  final String id;
  final String code;
  final String title;
  final String? description;
  final String status;
  final String priority;
  final DateTime? scheduledFor;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final MobilePartySummaryContract? startedBy;
  final MobilePartySummaryContract? completedBy;
}

class FieldOperationExecutionPreparationContract {
  const FieldOperationExecutionPreparationContract({
    required this.operation,
    required this.equipment,
    required this.auxiliaryTechnicians,
    required this.checklist,
    required this.materialPolicy,
    required this.allowedTransitions,
    required this.allowedActions,
    required this.version,
    required this.eligible,
    required this.blockers,
    this.customer,
    this.responsibleFieldTechnician,
    this.primaryAction,
  });
  final FieldOperationStateContract operation;
  final MobileCustomerSummaryContract? customer;
  final List<MobileEquipmentSummaryContract> equipment;
  final MobilePartySummaryContract? responsibleFieldTechnician;
  final List<MobilePartySummaryContract> auxiliaryTechnicians;
  final List<FieldOperationChecklistContract> checklist;
  final FieldOperationMaterialPolicyContract materialPolicy;
  final List<String> allowedTransitions;
  final List<FieldOperationAllowedAction> allowedActions;
  final FieldOperationAllowedAction? primaryAction;
  final String version;
  final bool eligible;
  final List<String> blockers;
}

class FieldOperationCommandResultContract {
  const FieldOperationCommandResultContract({
    required this.operationId,
    required this.status,
    required this.version,
    required this.allowedActions,
    required this.idempotentReplay,
    this.startedBy,
    this.startedAt,
    this.completedBy,
    this.completedAt,
  });
  final String operationId;
  final String status;
  final String version;
  final MobilePartySummaryContract? startedBy;
  final DateTime? startedAt;
  final MobilePartySummaryContract? completedBy;
  final DateTime? completedAt;
  final List<FieldOperationAllowedAction> allowedActions;
  final bool idempotentReplay;
}

class FieldOperationTimelineEntryContract {
  const FieldOperationTimelineEntryContract({
    required this.id,
    required this.type,
    required this.message,
    required this.occurredAt,
    this.actor,
  });
  final String id;
  final String type;
  final String message;
  final MobilePartySummaryContract? actor;
  final DateTime occurredAt;
}
